from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app  # noqa: F401
from app.core.config import get_settings

from cassandra.cluster import Cluster
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import CollectionInvalid, PyMongoError

DEPARTMENT_CODES = ["CSE", "ECE", "EEE", "MECH", "CIVIL"]

STUDENT_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": [
            "_id", "roll_number", "name", "department_code", "section",
            "admission_year", "year_of_study", "current_semester", "status",
            "created_at", "updated_at",
        ],
        "properties": {
            "_id": {"bsonType": "string", "pattern": "^[0-9a-f-]{36}$"},
            "roll_number": {
                "bsonType": "string",
                "pattern": "^[0-9]{2}(CSE|ECE|EEE|MECH|CIVIL)[0-9]{3}$",
            },
            "name": {"bsonType": "string", "minLength": 2, "maxLength": 100},
            "department_code": {"enum": DEPARTMENT_CODES},
            "section": {"enum": ["A", "B"]},
            "admission_year": {"bsonType": "int", "minimum": 2000, "maximum": 2100},
            "year_of_study": {"bsonType": "int", "minimum": 1, "maximum": 4},
            "current_semester": {"bsonType": "int", "minimum": 1, "maximum": 4},
            "email": {"bsonType": ["string", "null"]},
            "status": {"enum": ["ACTIVE", "GRADUATED", "INACTIVE"]},
            "created_at": {"bsonType": "string"},
            "updated_at": {"bsonType": "string"},
        },
    }
}

SUMMARY_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": [
            "_id", "student_id", "roll_number", "student_name", "department_code",
            "semester", "academic_year", "sgpa", "cgpa", "credits_registered",
            "credits_earned", "subject_count", "failed_subject_count",
            "semester_backlog_count", "backlog_count", "result_status",
            "computed_at", "source_version",
        ],
        "properties": {
            "_id": {"bsonType": "string"},
            "student_id": {"bsonType": "string", "pattern": "^[0-9a-f-]{36}$"},
            "roll_number": {"bsonType": "string"},
            "student_name": {"bsonType": "string"},
            "department_code": {"enum": DEPARTMENT_CODES},
            "section": {"enum": ["A", "B"]},
            "semester": {"bsonType": "int", "minimum": 1, "maximum": 4},
            "academic_year": {"bsonType": "string"},
            "sgpa": {"bsonType": "double", "minimum": 0, "maximum": 10},
            "cgpa": {"bsonType": "double", "minimum": 0, "maximum": 10},
            "credits_registered": {"bsonType": "int", "minimum": 0},
            "credits_earned": {"bsonType": "int", "minimum": 0},
            "subject_count": {"bsonType": "int", "minimum": 0},
            "failed_subject_count": {"bsonType": "int", "minimum": 0},
            "semester_backlog_count": {"bsonType": "int", "minimum": 0},
            "backlog_count": {"bsonType": "int", "minimum": 0},
            "result_status": {"enum": ["PASS", "FAIL"]},
            "computed_at": {"bsonType": "string"},
            "source_version": {"bsonType": "string"},
        },
    }
}

SUBJECT_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "code", "name", "department_code", "semester", "credits"],
        "properties": {
            "_id": {"bsonType": "string"},
            "code": {"bsonType": "string"},
            "name": {"bsonType": "string"},
            "department_code": {"enum": DEPARTMENT_CODES},
            "semester": {"bsonType": "int", "minimum": 1, "maximum": 4},
            "credits": {"bsonType": "int", "minimum": 0, "maximum": 10},
            "internal_max": {"bsonType": "int"},
            "external_max": {"bsonType": "int"},
            "pass_marks": {"bsonType": "int"},
            "difficulty": {"bsonType": "int"},
        },
    }
}

DEPARTMENT_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "code", "name", "short_name", "hod", "established_year", "intake"],
        "properties": {
            "_id": {"bsonType": "string"},
            "code": {"enum": DEPARTMENT_CODES},
            "name": {"bsonType": "string"},
            "short_name": {"bsonType": "string"},
            "hod": {"bsonType": "string"},
            "established_year": {"bsonType": "int"},
            "intake": {"bsonType": "int"},
        },
    }
}

META_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "seed_version", "generated_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "seed_version": {"bsonType": "string"},
            "generated_at": {"bsonType": "string"},
        },
    }
}

ADMIN_AUDIT_VALIDATOR = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "action", "entity_type", "entity_id", "summary", "created_at"],
        "properties": {
            "_id": {"bsonType": "string"},
            "action": {"bsonType": "string"},
            "entity_type": {"bsonType": "string"},
            "entity_id": {"bsonType": "string"},
            "roll_number": {"bsonType": "string"},
            "summary": {"bsonType": "string"},
            "record_source": {"bsonType": "string"},
            "before": {"bsonType": "object"},
            "after": {"bsonType": "object"},
            "created_at": {"bsonType": "string"},
        },
    }
}

CASSANDRA_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS results_by_student_semester (
        student_id uuid,
        semester int,
        subject_code text,
        subject_name text,
        department_code text,
        roll_number text,
        academic_year text,
        credits int,
        internal_marks int,
        external_marks int,
        total_marks int,
        grade text,
        grade_points double,
        result_status text,
        PRIMARY KEY ((student_id), semester, subject_code)
    ) WITH CLUSTERING ORDER BY (semester ASC, subject_code ASC)
    """,
    """
    CREATE TABLE IF NOT EXISTS results_by_department_semester (
        department_code text,
        semester int,
        subject_code text,
        result_status text,
        roll_number text,
        student_id uuid,
        student_name text,
        subject_name text,
        academic_year text,
        credits int,
        internal_marks int,
        external_marks int,
        total_marks int,
        grade text,
        grade_points double,
        PRIMARY KEY ((department_code, semester), subject_code, result_status, roll_number)
    ) WITH CLUSTERING ORDER BY (subject_code ASC, result_status ASC, roll_number ASC)
    """,
]


def init_cassandra() -> None:
    settings = get_settings()
    cluster = Cluster(
        [settings.cassandra_host],
        port=settings.cassandra_port,
        connect_timeout=settings.cassandra_timeout_seconds,
    )
    try:
        session = cluster.connect()
        session.execute(
            f"""
            CREATE KEYSPACE IF NOT EXISTS {settings.cassandra_keyspace}
            WITH replication = {{'class': 'SimpleStrategy', 'replication_factor': 1}}
            """
        )
        session.set_keyspace(settings.cassandra_keyspace)
        for statement in CASSANDRA_TABLES:
            session.execute(statement)
        print(
            f"Cassandra ready: keyspace={settings.cassandra_keyspace}, "
            f"tables=results_by_student_semester,results_by_department_semester"
        )
        print("Replication: SimpleStrategy RF=1 (single-node development only)")
    finally:
        cluster.shutdown()


def ensure_collection(database, name: str, validator: dict) -> None:
    try:
        database.create_collection(name, validator=validator, validationLevel="strict")
        print(f"MongoDB collection created: {name}")
    except CollectionInvalid:
        database.command(
            "collMod",
            name,
            validator=validator,
            validationLevel="strict",
            validationAction="error",
        )
        print(f"MongoDB collection verified: {name}")


def init_mongo() -> None:
    settings = get_settings()
    client = MongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=settings.mongo_timeout_ms,
        appname="academic-system-init",
    )
    try:
        database = client[settings.mongodb_database]
        client.admin.command("ping")
        ensure_collection(database, "students", STUDENT_VALIDATOR)
        ensure_collection(database, "departments", DEPARTMENT_VALIDATOR)
        ensure_collection(database, "subjects", SUBJECT_VALIDATOR)
        ensure_collection(database, "student_semester_summaries", SUMMARY_VALIDATOR)
        ensure_collection(database, "app_metadata", META_VALIDATOR)
        ensure_collection(database, "admin_audit_log", ADMIN_AUDIT_VALIDATOR)

        database.students.create_index("roll_number", unique=True, name="uniq_roll_number")
        database.students.create_index(
            [("department_code", ASCENDING), ("roll_number", ASCENDING)],
            name="department_roll",
        )
        database.student_semester_summaries.create_index(
            [("student_id", ASCENDING), ("semester", ASCENDING)],
            unique=True,
            name="uniq_student_semester",
        )
        database.student_semester_summaries.create_index(
            [("semester", ASCENDING), ("department_code", ASCENDING), ("roll_number", ASCENDING)],
            name="semester_department_roll",
        )
        database.student_semester_summaries.create_index(
            [
                ("semester", ASCENDING),
                ("department_code", ASCENDING),
                ("cgpa", DESCENDING),
                ("backlog_count", ASCENDING),
                ("result_status", ASCENDING),
            ],
            name="semester_department_cgpa_backlog_status",
        )
        database.student_semester_summaries.create_index(
            [
                ("semester", ASCENDING),
                ("cgpa", DESCENDING),
                ("backlog_count", ASCENDING),
                ("result_status", ASCENDING),
            ],
            name="semester_cgpa_backlog_status",
        )
        database.subjects.create_index("code", unique=True, name="uniq_subject_code")
        database.subjects.create_index(
            [("department_code", ASCENDING), ("semester", ASCENDING), ("code", ASCENDING)],
            name="department_semester_code",
        )
        database.admin_audit_log.create_index(
            [("created_at", DESCENDING)], name="audit_created_at"
        )
        database.admin_audit_log.create_index(
            [("entity_type", ASCENDING), ("entity_id", ASCENDING)],
            name="audit_entity",
        )
        print(f"MongoDB ready: database={settings.mongodb_database}, indexes created")
    finally:
        client.close()


def main() -> None:
    init_cassandra()
    mongo_error = None
    try:
        init_mongo()
    except PyMongoError as exc:
        mongo_error = exc
        print(f"MongoDB schema not initialized: {type(exc).__name__}")
        print("Check Atlas Network Access and credentials; secrets are not logged.")
    if mongo_error:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
