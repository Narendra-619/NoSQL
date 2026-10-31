from __future__ import annotations

import argparse
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app  # noqa: F401
from app.core.config import get_settings
from app.domain.academics import (
    ACADEMIC_YEAR,
    GENERATED_AT,
    SEED_VERSION,
    generate_dataset,
    timestamp_now,
)

from cassandra.cluster import Cluster
from cassandra.concurrent import execute_concurrent
from cassandra.query import BatchStatement, BatchType
from pymongo import MongoClient, ReplaceOne
from pymongo.errors import PyMongoError

INSERT_STUDENT_RESULT = """
INSERT INTO results_by_student_semester (
    student_id, semester, subject_code, subject_name, department_code, roll_number,
    academic_year, credits, internal_marks, external_marks, total_marks, grade,
    grade_points, result_status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

INSERT_DEPARTMENT_RESULT = """
INSERT INTO results_by_department_semester (
    department_code, semester, subject_code, result_status, roll_number, student_id,
    student_name, subject_name, academic_year, credits, internal_marks, external_marks,
    total_marks, grade, grade_points
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def reset_cassandra(settings) -> None:
    cluster = Cluster(
        [settings.cassandra_host],
        port=settings.cassandra_port,
        connect_timeout=settings.cassandra_timeout_seconds,
    )
    try:
        session = cluster.connect(settings.cassandra_keyspace)
        session.execute("TRUNCATE results_by_department_semester")
        session.execute("TRUNCATE results_by_student_semester")
        print("Cassandra tables truncated")
    finally:
        cluster.shutdown()


def reset_mongo(settings) -> None:
    client = MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=settings.mongo_timeout_ms,
        appname="academic-system-seed-reset",
    )
    try:
        db = client[settings.mongodb_database]
        client.admin.command("ping")
        for collection in (
            "students",
            "student_semester_summaries",
            "subjects",
            "departments",
            "admin_audit_log",
            "app_metadata",
        ):
            db[collection].delete_many({})
        print("MongoDB demo collections cleared")
    finally:
        client.close()


def seed_cassandra(dataset: dict, settings) -> int:
    cluster = Cluster(
        [settings.cassandra_host],
        port=settings.cassandra_port,
        connect_timeout=settings.cassandra_timeout_seconds,
    )
    started = time.perf_counter()
    try:
        session = cluster.connect(settings.cassandra_keyspace)
        student_stmt = session.prepare(INSERT_STUDENT_RESULT)
        department_stmt = session.prepare(INSERT_DEPARTMENT_RESULT)
        student_batches: dict[str, BatchStatement] = {}
        for row in dataset["student_results"]:
            batch = student_batches.setdefault(
                row["student_id"], BatchStatement(batch_type=BatchType.UNLOGGED)
            )
            batch.add(
                student_stmt,
                (
                    uuid.UUID(row["student_id"]), row["semester"], row["subject_code"],
                    row["subject_name"], row["department_code"], row["roll_number"],
                    row["academic_year"], row["credits"], row["internal_marks"],
                    row["external_marks"], row["total_marks"], row["grade"],
                    row["grade_points"], row["result_status"],
                ),
            )
        department_batches: dict[tuple[str, int, str], BatchStatement] = {}
        for row in dataset["department_results"]:
            key = (row["department_code"], row["semester"], row["student_id"])
            batch = department_batches.setdefault(
                key, BatchStatement(batch_type=BatchType.UNLOGGED)
            )
            batch.add(
                department_stmt,
                (
                    row["department_code"], row["semester"], row["subject_code"],
                    row["result_status"], row["roll_number"], uuid.UUID(row["student_id"]),
                    row["student_name"], row["subject_name"], row["academic_year"],
                    row["credits"], row["internal_marks"], row["external_marks"],
                    row["total_marks"], row["grade"], row["grade_points"],
                ),
            )
        statements = list(student_batches.values()) + list(department_batches.values())
        execute_concurrent(
            session,
            [(batch, ()) for batch in statements],
            concurrency=32,
            raise_on_first_error=True,
        )
        return round((time.perf_counter() - started) * 1000, 2)
    finally:
        cluster.shutdown()


def seed_mongo(dataset: dict, settings, cassandra_ms: float, generation_ms: float) -> int:
    client = MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=settings.mongo_timeout_ms,
        appname="academic-system-seed",
    )
    started = time.perf_counter()
    try:
        db = client[settings.mongodb_database]
        client.admin.command("ping")
        db.departments.bulk_write(
            [ReplaceOne({"_id": doc["_id"]}, doc, upsert=True) for doc in dataset["departments"]],
            ordered=False,
        )
        db.subjects.bulk_write(
            [ReplaceOne({"_id": doc["_id"]}, doc, upsert=True) for doc in dataset["subjects"]],
            ordered=False,
        )
        db.students.bulk_write(
            [ReplaceOne({"_id": doc["_id"]}, doc, upsert=True) for doc in dataset["students"]],
            ordered=False,
        )
        db.student_semester_summaries.bulk_write(
            [ReplaceOne({"_id": doc["_id"]}, doc, upsert=True) for doc in dataset["summaries"]],
            ordered=False,
        )
        mongo_ms = round((time.perf_counter() - started) * 1000, 2)
        total_ms = round(generation_ms + cassandra_ms + mongo_ms, 2)
        metadata = {
            "_id": "dataset",
            "seed_version": SEED_VERSION,
            "generated_at": GENERATED_AT,
            "seeded_at": timestamp_now(),
            "academic_year": ACADEMIC_YEAR,
            "student_count": dataset["student_count"],
            "department_count": len(dataset["departments"]),
            "subject_count": len(dataset["subjects"]),
            "summary_count": dataset["summary_count"],
            "cassandra_result_count_per_table": dataset["result_count"],
            "generation_ms": generation_ms,
            "cassandra_write_ms": cassandra_ms,
            "mongo_write_ms": mongo_ms,
            "seed_duration_ms": total_ms,
            "cgpa_method": "Credit-weighted grade points over semesters 1 through 4; rounded to 2 decimals.",
            "backlog_method": "Cumulative failed subject records up to and including the selected semester.",
        }
        db.app_metadata.replace_one({"_id": "dataset"}, metadata, upsert=True)
        return mongo_ms
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--cassandra-only",
        action="store_true",
        help="Write Cassandra rows only for local development checks.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Clear the MongoDB demo collections and both Cassandra tables before seeding.",
    )
    args = parser.parse_args()
    settings = get_settings()

    if args.reset:
        reset_cassandra(settings)
        if not args.cassandra_only:
            reset_mongo(settings)

    generation_started = time.perf_counter()
    dataset = generate_dataset()
    generation_ms = round((time.perf_counter() - generation_started) * 1000, 2)
    print(
        f"Generated {dataset['student_count']} students, {dataset['summary_count']} summaries, "
        f"{dataset['result_count']} results per Cassandra table in {generation_ms:.0f} ms"
    )

    cassandra_ms = seed_cassandra(dataset, settings)
    print(f"Cassandra seeded in {cassandra_ms:.0f} ms")

    mongo_ms = None
    if not args.cassandra_only:
        try:
            mongo_ms = seed_mongo(dataset, settings, cassandra_ms, generation_ms)
            print(f"MongoDB seeded in {mongo_ms:.0f} ms")
        except PyMongoError as exc:
            print(f"MongoDB seed failed: {type(exc).__name__}")
            print("Cassandra rows remain valid and the seed is idempotent; rerun after fixing Atlas.")
            raise SystemExit(2)

    if not args.cassandra_only:
        client = MongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=settings.mongo_timeout_ms,
            appname="academic-system-seed-count",
        )
        try:
            db = client[settings.mongodb_database]
            print(
                "MongoDB counts:",
                {name: db[name].count_documents({}) for name in [
                    "departments", "subjects", "students", "student_semester_summaries",
                ]},
            )
        except PyMongoError as exc:
            print(f"MongoDB count check skipped: {type(exc).__name__}")
        finally:
            client.close()


if __name__ == "__main__":
    main()
