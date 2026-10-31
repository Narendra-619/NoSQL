from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app  # noqa: F401
from app.core.config import get_settings
from app.domain.academics import (
    DEPARTMENTS,
    SEMESTERS,
    generate_dataset,
    recalculate_summaries,
    round2,
)

from cassandra.cluster import Cluster
from pymongo import MongoClient
from pymongo.errors import PyMongoError

RESULT_COLUMNS = (
    "student_id, semester, subject_code, subject_name, department_code, roll_number, "
    "academic_year, credits, internal_marks, external_marks, total_marks, grade, "
    "grade_points, result_status"
)


def fail(message: str) -> None:
    print(f"VERIFY FAILED: {message}")
    raise SystemExit(1)


def verify_cassandra(settings) -> dict:
    cluster = Cluster(
        [settings.cassandra_host],
        port=settings.cassandra_port,
        connect_timeout=settings.cassandra_timeout_seconds,
    )
    try:
        session = cluster.connect(settings.cassandra_keyspace)
        rows = list(
            session.execute(
                f"SELECT {RESULT_COLUMNS} FROM results_by_student_semester"
            )
        )
        by_student: dict[str, dict[int, list[dict]]] = defaultdict(
            lambda: {semester: [] for semester in SEMESTERS}
        )
        for row in rows:
            by_student[str(row.student_id)][row.semester].append(
                {
                    "student_id": str(row.student_id),
                    "semester": row.semester,
                    "subject_code": row.subject_code,
                    "subject_name": row.subject_name,
                    "department_code": row.department_code,
                    "roll_number": row.roll_number,
                    "academic_year": row.academic_year,
                    "credits": row.credits,
                    "internal_marks": row.internal_marks,
                    "external_marks": row.external_marks,
                    "total_marks": row.total_marks,
                    "grade": row.grade,
                    "grade_points": row.grade_points,
                    "result_status": row.result_status,
                }
            )

        if len(rows) != 10000:
            fail(f"results_by_student_semester has {len(rows)} rows, expected 10000")
        if len(by_student) != 500:
            fail(f"expected 500 student partitions, found {len(by_student)}")

        for student_id, semesters in by_student.items():
            for semester in SEMESTERS:
                if len(semesters[semester]) != 5:
                    fail(f"student {student_id} semester {semester} has {len(semesters[semester])} subjects")

        department_totals = {}
        failed_total = 0
        for department in DEPARTMENTS:
            code = department["code"]
            for semester in SEMESTERS:
                partition = list(
                    session.execute(
                        """
                        SELECT roll_number, subject_code, result_status
                        FROM results_by_department_semester
                        WHERE department_code = %s AND semester = %s
                        """,
                        (code, semester),
                    )
                )
                if len(partition) != 500:
                    fail(f"{code} semester {semester} partition has {len(partition)} rows, expected 500")
                department_totals[(code, semester)] = len(partition)
                failed_total += sum(1 for row in partition if row.result_status == "FAIL")

        return {
            "student_results": rows,
            "by_student": by_student,
            "department_totals": department_totals,
            "failed_total": failed_total,
        }
    finally:
        cluster.shutdown()


def verify_mongo(settings, dataset: dict, by_student: dict) -> dict:
    client = MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=settings.mongo_timeout_ms,
        appname="academic-system-verify",
    )
    try:
        db = client[settings.mongodb_database]
        client.admin.command("ping")
        counts = {
            "departments": db.departments.count_documents({}),
            "subjects": db.subjects.count_documents({}),
            "students": db.students.count_documents({}),
            "student_semester_summaries": db.student_semester_summaries.count_documents({}),
        }
        expected = {
            "departments": 5,
            "subjects": 100,
            "students": 500,
            "student_semester_summaries": 2000,
        }
        if counts != expected:
            fail(f"MongoDB counts {counts}, expected {expected}")

        generated_by_id = {item["_id"]: item for item in dataset["summaries"]}
        mismatches = 0
        for student_id, semesters in by_student.items():
            recomputed = recalculate_summaries(semesters)
            for item in recomputed:
                key = f"{student_id}:{item['semester']}"
                stored = db.student_semester_summaries.find_one({"_id": key})
                generated = generated_by_id[key]
                if not stored:
                    fail(f"missing summary {key}")
                for field in (
                    "sgpa", "cgpa", "backlog_count", "semester_backlog_count",
                    "result_status", "failed_subject_count", "credits_registered",
                    "credits_earned", "subject_count",
                ):
                    stored_value = stored[field]
                    expected_value = item[field]
                    if isinstance(expected_value, float):
                        ok = abs(stored_value - expected_value) <= 0.011
                    else:
                        ok = stored_value == expected_value
                    if not ok:
                        mismatches += 1
                        print(
                            f"summary mismatch {key} {field}: stored={stored_value} "
                            f"recomputed={expected_value}"
                        )
                if generated["cgpa"] != item["cgpa"]:
                    mismatches += 1
                    print(
                        f"generator mismatch {key} cgpa: generated={generated['cgpa']} "
                        f"recomputed={item['cgpa']}"
                    )
        if mismatches:
            fail(f"{mismatches} summary mismatches")

        metadata = db.app_metadata.find_one({"_id": "dataset"})
        if not metadata:
            fail("dataset metadata missing")
        return {"counts": counts, "metadata": metadata}
    except PyMongoError as exc:
        fail(f"MongoDB verification unavailable: {type(exc).__name__}")
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cassandra-only", action="store_true")
    args = parser.parse_args()
    settings = get_settings()
    dataset = generate_dataset()
    cassandra = verify_cassandra(settings)
    print(f"Cassandra rows: {len(cassandra['student_results'])}; partitions: {len(cassandra['by_student'])}")
    print(f"Cassandra failed results: {cassandra['failed_total']}")

    if not args.cassandra_only:
        mongo = verify_mongo(settings, dataset, cassandra["by_student"])
        print(f"MongoDB counts: {mongo['counts']}")
        print(f"Dataset seed time recorded: {mongo['metadata'].get('seed_duration_ms')} ms")
    else:
        recomputed = []
        for semesters in cassandra["by_student"].values():
            recomputed.extend(recalculate_summaries(semesters))
        average_cgpa = round2(sum(item["cgpa"] for item in recomputed if item["semester"] == 4) / 500)
        pass_rate = round2(
            sum(1 for item in recomputed if item["semester"] == 4 and item["result_status"] == "PASS")
            / 500 * 100
        )
        print(f"Recomputed semester 4 average CGPA: {average_cgpa}")
        print(f"Recomputed semester 4 pass percentage: {pass_rate}%")
    print("Data verification passed")


if __name__ == "__main__":
    main()
