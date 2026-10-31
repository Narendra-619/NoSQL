from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone

from .constants import SEMESTERS, academic_year_for_semester
from .grading import grade_for, result_status, round2

def student_id_for(roll_number: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"https://cit.example/students/{roll_number}"))


def make_result_row(
    *,
    student_id: str,
    roll_number: str,
    student_name: str,
    department_code: str,
    semester: int,
    subject: tuple[str, str, int, int],
    internal_marks: int,
    external_marks: int,
) -> dict:
    subject_code, subject_name, credits, _difficulty = subject
    total = internal_marks + external_marks
    grade, points = grade_for(total)
    return {
        "student_id": student_id,
        "semester": semester,
        "subject_code": subject_code,
        "subject_name": subject_name,
        "credits": credits,
        "department_code": department_code,
        "roll_number": roll_number,
        "student_name": student_name,
        "academic_year": academic_year_for_semester(semester),
        "internal_marks": internal_marks,
        "external_marks": external_marks,
        "total_marks": total,
        "grade": grade,
        "grade_points": round2(points),
        "result_status": result_status(0 if total >= 40 else 1),
    }


def generate_passing_marks(
    *, student_id: str, semester: int, subject_code: str
) -> tuple[int, int]:
    rng = random.Random(f"{student_id}:{semester}:{subject_code}:backlog-clear")
    total = rng.randint(40, 62)
    internal = rng.randint(15, 28)
    external = total - internal
    return internal, external


def summary_documents(
    identity: dict,
    results_by_semester: dict[int, list[dict]],
    *,
    computed_at: str,
    source_version: str,
) -> list[dict]:
    summaries = recalculate_summaries(results_by_semester)
    documents = []
    for summary in summaries:
        semester = summary["semester"]
        rows = results_by_semester.get(semester, [])
        documents.append(
            {
                "_id": f"{identity['student_id']}:{semester}",
                "student_id": identity["student_id"],
                "roll_number": identity["roll_number"],
                "student_name": identity["name"],
                "department_code": identity["department_code"],
                "section": identity["section"],
                "semester": semester,
                "academic_year": academic_year_for_semester(semester),
                "sgpa": summary["sgpa"],
                "cgpa": summary["cgpa"],
                "credits_registered": summary["credits_registered"],
                "credits_earned": summary["credits_earned"],
                "subject_count": summary["subject_count"],
                "failed_subject_count": summary["failed_subject_count"],
                "semester_backlog_count": summary["semester_backlog_count"],
                "backlog_count": summary["backlog_count"],
                "result_status": summary["result_status"],
                "computed_at": computed_at,
                "source_version": source_version,
            }
        )
    return documents


def recalculate_summaries(results_by_semester: dict[int, list[dict]]) -> list[dict]:
    summaries = []
    cumulative_failures = 0
    cumulative_credits = 0.0
    cumulative_points = 0.0
    for semester in SEMESTERS:
        rows = results_by_semester.get(semester, [])
        credits = sum(row["credits"] for row in rows)
        points = sum(row["credits"] * row["grade_points"] for row in rows)
        failures = sum(1 for row in rows if row["result_status"] == "FAIL")
        cumulative_failures += failures
        cumulative_credits += credits
        cumulative_points += points
        summaries.append(
            {
                "semester": semester,
                "sgpa": round2(points / credits if credits else 0.0),
                "cgpa": round2(cumulative_points / cumulative_credits if cumulative_credits else 0.0),
                "credits_registered": credits,
                "credits_earned": sum(
                    row["credits"] for row in rows if row["result_status"] == "PASS"
                ),
                "subject_count": len(rows),
                "failed_subject_count": failures,
                "semester_backlog_count": failures,
                "backlog_count": cumulative_failures,
                "result_status": result_status(failures),
            }
        )
    return summaries


def timestamp_now() -> str:
    return datetime.now(timezone.utc).isoformat()
