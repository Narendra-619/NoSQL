from __future__ import annotations

import json
import os
import platform
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from cassandra.cluster import Cluster
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import app  # noqa: F401,E402
from app.core.config import get_settings  # noqa: E402

WARMUP = 8
ITERATIONS = 30
SEMESTERS = (1, 2, 3, 4)
DEPARTMENTS = ("CSE", "ECE", "EEE", "MECH", "CIVIL")


def mongo_operation(database, department_code: str, semester: int) -> dict:
    result = list(
        database.student_semester_summaries.aggregate(
            [
                {"$match": {"department_code": department_code, "semester": semester}},
                {
                    "$group": {
                        "_id": None,
                        "students": {"$sum": 1},
                        "pass": {
                            "$sum": {
                                "$cond": [{"$eq": ["$result_status", "PASS"]}, 1, 0]
                            }
                        },
                    }
                },
            ]
        )
    )
    row = result[0] if result else {"students": 0, "pass": 0}
    return {
        "students": int(row["students"]),
        "pass": int(row["pass"]),
        "fail": int(row["students"] - row["pass"]),
    }


def cassandra_operation(session, department_code: str, semester: int) -> dict:
    rows = session.execute(
        """
        SELECT student_id, subject_code, result_status
        FROM results_by_department_semester
        WHERE department_code = %s AND semester = %s
        """,
        (department_code, semester),
    )
    students: dict[str, bool] = {}
    for row in rows:
        current = students.get(str(row.student_id), True)
        students[str(row.student_id)] = current and row.result_status == "PASS"
    pass_count = sum(1 for passed in students.values() if passed)
    return {
        "students": len(students),
        "pass": pass_count,
        "fail": len(students) - pass_count,
    }


def timed(function, *args) -> tuple[float, dict]:
    started = time.perf_counter()
    value = function(*args)
    return (time.perf_counter() - started) * 1000, value


def summarize(samples: list[float]) -> dict:
    ordered = sorted(samples)
    return {
        "median_ms": round(statistics.median(samples), 3),
        "p95_ms": round(ordered[int(len(ordered) * 0.95) - 1], 3),
        "min_ms": round(ordered[0], 3),
        "max_ms": round(ordered[-1], 3),
    }


def main() -> None:
    settings = get_settings()
    mongo_client = MongoClient(settings.mongodb_uri, appname="academic-benchmark")
    database = mongo_client[settings.mongodb_database]
    cluster = Cluster([settings.cassandra_host], port=settings.cassandra_port)
    session = cluster.connect(settings.cassandra_keyspace)

    mongo_samples: list[float] = []
    cassandra_samples: list[float] = []
    verified: list[dict] = []

    try:
        for semester in SEMESTERS:
            for department_code in DEPARTMENTS:
                mongo_value = mongo_operation(database, department_code, semester)
                cassandra_value = cassandra_operation(session, department_code, semester)
                if mongo_value != cassandra_value:
                    raise RuntimeError(
                        f"Aggregation mismatch for {department_code} semester {semester}: "
                        f"{mongo_value} != {cassandra_value}"
                    )
                verified.append(
                    {
                        "department_code": department_code,
                        "semester": semester,
                        **mongo_value,
                    }
                )

        for _ in range(WARMUP):
            for semester in SEMESTERS:
                for department_code in DEPARTMENTS:
                    mongo_operation(database, department_code, semester)
                    cassandra_operation(session, department_code, semester)

        for _ in range(ITERATIONS):
            for semester in SEMESTERS:
                for department_code in DEPARTMENTS:
                    elapsed, value = timed(mongo_operation, database, department_code, semester)
                    mongo_samples.append(elapsed)
                    cassandra_elapsed, cassandra_value = timed(
                        cassandra_operation, session, department_code, semester
                    )
                    cassandra_samples.append(cassandra_elapsed)
                    if value != cassandra_value:
                        raise RuntimeError("Benchmark result changed between systems.")
    finally:
        mongo_client.close()
        cluster.shutdown()

    mongo_summary = summarize(mongo_samples)
    cassandra_summary = summarize(cassandra_samples)
    ratio = round(cassandra_summary["median_ms"] / mongo_summary["median_ms"], 2)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "operation": (
            "Student pass/fail aggregation for one department and one semester "
            "(100 students, 500 subject rows in Cassandra)."
        ),
        "environment": {
            "label": os.getenv(
                "BENCHMARK_LABEL", "local MongoDB + local Cassandra (development validation)"
            ),
            "platform": platform.platform(),
            "python": platform.python_version(),
            "mongo_network": (
                "loopback"
                if "127.0.0.1" in settings.mongodb_uri
                or "localhost" in settings.mongodb_uri
                else "remote"
            ),
            "cassandra_network": "loopback",
            "iterations": ITERATIONS,
            "warmup_iterations": WARMUP,
            "sample_count": len(mongo_samples),
        },
        "mongo": mongo_summary,
        "cassandra": cassandra_summary,
        "cassandra_to_mongo_median_ratio": ratio,
        "verified_aggregations": verified,
    }

    output = Path(__file__).resolve().parent
    (output / "results.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    mongo_remote = payload["environment"]["mongo_network"] == "remote"
    topology_note = (
        "**Topology caveat:** MongoDB measurements include a remote round trip, while "
        "Cassandra is local. This is the deployed topology, not an engine-only "
        "comparison. The MongoDB operation reads pre-aggregated summaries; the Cassandra "
        "operation reads and groups subject rows. Do not generalise these timings to "
        "either engine."
        if mongo_remote
        else
        "**Topology note:** MongoDB and Cassandra were both measured locally in this run. "
        "The MongoDB operation reads pre-aggregated summaries; the Cassandra operation "
        "reads and groups subject rows. These are different data models and access "
        "patterns, not an engine-only comparison."
    )

    markdown = f"""# Benchmark Results

Generated {payload['generated_at']}

## Operation

{payload['operation']}

Both outputs are verified to match before timing. The Mongo side reads pre-aggregated
student summaries; the Cassandra side reads 500 subject rows and groups them by student.
This reflects the intended access patterns, not an engine-only synthetic workload.

## Environment

| Item | Value |
| --- | --- |
| Label | {payload['environment']['label']} |
| Platform | {payload['environment']['platform']} |
| Python | {payload['environment']['python']} |
| MongoDB network | {payload['environment']['mongo_network']} |
| Cassandra network | {payload['environment']['cassandra_network']} |
| Samples | {payload['environment']['sample_count']} ({ITERATIONS} iterations x {len(SEMESTERS) * len(DEPARTMENTS)} department-semesters) |

{topology_note}

## Results

| System | Median | p95 | Min | Max |
| --- | ---: | ---: | ---: | ---: |
| MongoDB | {mongo_summary['median_ms']} ms | {mongo_summary['p95_ms']} ms | {mongo_summary['min_ms']} ms | {mongo_summary['max_ms']} ms |
| Cassandra | {cassandra_summary['median_ms']} ms | {cassandra_summary['p95_ms']} ms | {cassandra_summary['min_ms']} ms | {cassandra_summary['max_ms']} ms |

Cassandra median / MongoDB median: **{ratio}x** (lower means Cassandra was faster in this topology).

These figures should be read as end-to-end execution times for different data models and
network paths. They do not establish that one engine is faster in general.
"""
    (output / "RESULTS.md").write_text(markdown, encoding="utf-8")
    print(markdown)


if __name__ == "__main__":
    main()
