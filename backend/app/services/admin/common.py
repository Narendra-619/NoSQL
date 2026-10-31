from __future__ import annotations

from app.core.errors import NotFoundError
from app.domain.academics import (
    SEMESTERS,
    student_id_for,
    subjects_by_code,
    subjects_for_semester,
    summary_documents,
    timestamp_now,
)
from app.schemas.requests import StudentIdentityInput

SUMMARY_FIELDS = (
    "semester",
    "academic_year",
    "sgpa",
    "cgpa",
    "credits_registered",
    "credits_earned",
    "subject_count",
    "failed_subject_count",
    "semester_backlog_count",
    "backlog_count",
    "result_status",
    "computed_at",
    "source_version",
)

RESULT_FIELDS = (
    "subject_code",
    "subject_name",
    "credits",
    "internal_marks",
    "external_marks",
    "total_marks",
    "grade",
    "grade_points",
    "result_status",
    "academic_year",
)


class AdminCommonMixin:
    def _require_department(self, code: str) -> dict:
        department = self.students.get_department(code)
        if not department:
            raise NotFoundError(f"Department {code} was not found.")
        return department

    def _require_student(self, student_id: str) -> dict:
        student = self.students.get_student(student_id)
        if not student:
            raise NotFoundError("Student was not found.")
        return student

    def _identity_view(self, student: dict) -> dict:
        department = self.students.get_department(student["department_code"])
        return {
            "student_id": student.get("_id") or student.get("student_id"),
            "roll_number": student["roll_number"],
            "name": student["name"],
            "department_code": student["department_code"],
            "department_name": department["name"] if department else "",
            "section": student["section"],
            "admission_year": student["admission_year"],
            "year_of_study": student["year_of_study"],
            "current_semester": student["current_semester"],
            "email": student.get("email"),
            "status": student["status"],
            "record_source": student.get("record_source", "seed"),
            "created_at": student.get("created_at"),
            "updated_at": student.get("updated_at"),
        }

    def _summary_view(self, summary: dict) -> dict:
        return {field: summary.get(field) for field in SUMMARY_FIELDS}

    def _result_view(self, row: dict) -> dict:
        subject = subjects_by_code(row["department_code"], row["semester"]).get(
            row["subject_code"]
        )
        view = {field: row.get(field) for field in RESULT_FIELDS}
        view.update(
            {
                "internal_max": 30,
                "external_max": 70,
                "pass_marks": 40,
                "subject_name": subject[1] if subject else row.get("subject_name"),
                "credits": subject[2] if subject else row.get("credits"),
            }
        )
        return view

    def _record_view(
        self,
        identity: dict,
        rows_by_semester: dict[int, list[dict]],
        summaries: list[dict],
        *,
        mode: str,
        generation_seed: str | None,
        roll_number_available: bool,
    ) -> dict:
        summary_views = [self._summary_view(item) for item in summaries]
        summary_map = {item["semester"]: item for item in summary_views}
        semesters = []
        for semester in SEMESTERS:
            rows = {
                row["subject_code"]: row
                for row in rows_by_semester.get(semester, [])
            }
            subjects = []
            for subject in subjects_for_semester(identity["department_code"], semester):
                code, name, credits, _difficulty = subject
                row = rows.get(code)
                subjects.append(
                    {
                        "subject_code": code,
                        "subject_name": name,
                        "credits": credits,
                        "internal_max": 30,
                        "external_max": 70,
                        "pass_marks": 40,
                        "internal_marks": row["internal_marks"] if row else None,
                        "external_marks": row["external_marks"] if row else None,
                        "total_marks": row["total_marks"] if row else None,
                        "grade": row["grade"] if row else None,
                        "grade_points": row["grade_points"] if row else None,
                        "result_status": row["result_status"] if row else None,
                        "academic_year": row["academic_year"] if row else None,
                    }
                )
            summary = summary_map[semester]
            semesters.append({**summary, "subjects": subjects})

        overall_backlog_count = (
            summary_views[-1]["backlog_count"] if summary_views else 0
        )
        overall_result_status = (
            "FAIL"
            if any(item["result_status"] == "FAIL" for item in summary_views)
            else "PASS"
        )
        return {
            "identity": self._identity_view(identity),
            "mode": mode,
            "record_source": mode,
            "generation_seed": generation_seed,
            "roll_number_available": roll_number_available,
            "semesters": semesters,
            "summaries": summary_views,
            "overall_backlog_count": overall_backlog_count,
            "overall_result_status": overall_result_status,
        }

    def _build_identity(self, payload: StudentIdentityInput) -> dict:
        self._require_department(payload.department_code)
        return {
            "student_id": student_id_for(payload.roll_number),
            "roll_number": payload.roll_number,
            "name": payload.name,
            "department_code": payload.department_code,
            "section": payload.section,
            "admission_year": payload.admission_year,
            "year_of_study": (payload.current_semester + 1) // 2,
            "current_semester": payload.current_semester,
            "email": payload.email,
            "status": payload.status,
        }

    def _build_summaries(
        self, identity: dict, rows_by_semester: dict[int, list[dict]], source_version: str
    ) -> list[dict]:
        return summary_documents(
            identity,
            rows_by_semester,
            computed_at=timestamp_now(),
            source_version=source_version,
        )

    def _summary_identity(self, student: dict) -> dict:
        return {
            "student_id": student["_id"],
            "roll_number": student["roll_number"],
            "name": student["name"],
            "department_code": student["department_code"],
            "section": student["section"],
        }
