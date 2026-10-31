from __future__ import annotations

from app.core.errors import BadRequestError, NotFoundError
from app.domain.academics import (
    SEMESTERS,
    make_result_row,
    recalculate_summaries,
    subjects_by_code,
    timestamp_now,
)
from app.schemas.requests import ResultUpdateRequest


class ResultAdminMixin:
    def correct_result(
        self,
        student_id: str,
        semester: int,
        subject_code: str,
        payload: ResultUpdateRequest,
    ) -> dict:
        student = self._require_student(student_id)
        if semester not in SEMESTERS:
            raise BadRequestError("Semester must be between 1 and 4.")
        subject = subjects_by_code(student["department_code"], semester).get(
            subject_code.upper()
        )
        if not subject:
            raise NotFoundError(
                "Subject was not found for this student's branch and semester."
            )

        rows = self.results.student_results(student_id)
        rows_by_semester: dict[int, list[dict]] = {item: [] for item in SEMESTERS}
        for row in rows:
            rows_by_semester.setdefault(row["semester"], []).append(row)
        old_row = next(
            (
                row
                for row in rows_by_semester[semester]
                if row["subject_code"] == subject_code.upper()
            ),
            None,
        )
        if not old_row:
            raise NotFoundError("The student does not have a result for this subject.")

        new_row = make_result_row(
            student_id=student_id,
            roll_number=student["roll_number"],
            student_name=student["name"],
            department_code=student["department_code"],
            semester=semester,
            subject=subject,
            internal_marks=payload.internal_marks,
            external_marks=payload.external_marks,
        )
        if (
            payload.expected_status is not None
            and payload.expected_status != new_row["result_status"]
        ):
            raise BadRequestError(
                f"Marks total {new_row['total_marks']} does not match the expected "
                f"{payload.expected_status} result."
            )

        before_summary = self.students.get_summary(student_id, semester)
        before_recalculated = next(
            item
            for item in recalculate_summaries(rows_by_semester)
            if item["semester"] == semester
        )

        if old_row["result_status"] != new_row["result_status"]:
            self.results.delete_department_row(old_row)
        self.results.upsert_row(new_row)

        rows_by_semester[semester] = [
            new_row if row["subject_code"] == new_row["subject_code"] else row
            for row in rows_by_semester[semester]
        ]
        summary_identity = {
            "student_id": student["_id"],
            "roll_number": student["roll_number"],
            "name": student["name"],
            "department_code": student["department_code"],
            "section": student["section"],
        }
        summaries = self._build_summaries(
            summary_identity, rows_by_semester, "admin"
        )
        self.students.upsert_summaries(summaries)
        self.students.update_student(
            student_id, {"updated_at": timestamp_now()}
        )
        after_summary = next(
            item for item in summaries if item["semester"] == semester
        )
        self._audit(
            action="result.correct",
            entity_type="result",
            entity_id=student_id,
            roll_number=student["roll_number"],
            summary=(
                f"Corrected {student['roll_number']} {subject_code.upper()} "
                f"Semester {semester} from {old_row['total_marks']} "
                f"({old_row['result_status']}) to {new_row['total_marks']} "
                f"({new_row['result_status']})."
            ),
            record_source=student.get("record_source", "seed"),
            before={
                "semester": semester,
                "subject_code": subject_code.upper(),
                "internal_marks": old_row["internal_marks"],
                "external_marks": old_row["external_marks"],
                "total_marks": old_row["total_marks"],
                "result_status": old_row["result_status"],
                "sgpa": before_summary["sgpa"] if before_summary else before_recalculated["sgpa"],
                "cgpa": before_summary["cgpa"] if before_summary else before_recalculated["cgpa"],
                "backlog_count": (
                    before_summary["backlog_count"]
                    if before_summary
                    else before_recalculated["backlog_count"]
                ),
            },
            after={
                "semester": semester,
                "subject_code": new_row["subject_code"],
                "internal_marks": new_row["internal_marks"],
                "external_marks": new_row["external_marks"],
                "total_marks": new_row["total_marks"],
                "result_status": new_row["result_status"],
                "sgpa": after_summary["sgpa"],
                "cgpa": after_summary["cgpa"],
                "backlog_count": after_summary["backlog_count"],
            },
        )
        return {
            "student": self._identity_view(student),
            "result": self._result_view(new_row),
            "before": (
                self._summary_view(before_summary)
                if before_summary
                else self._summary_view(before_recalculated)
            ),
            "after": self._summary_view(after_summary),
            "summaries": [self._summary_view(item) for item in summaries],
        }

    def failures(self, department_code: str, semester: int) -> dict:
        self._require_department(department_code)
        rows = self.results.department_semester_results(department_code, semester)
        items = []
        for row in rows:
            if row["result_status"] != "FAIL":
                continue
            subject = subjects_by_code(department_code, semester).get(
                row["subject_code"]
            )
            items.append(
                {
                    "student_id": row["student_id"],
                    "roll_number": row["roll_number"],
                    "student_name": row["student_name"] or "",
                    "department_code": department_code,
                    "semester": semester,
                    "subject_code": row["subject_code"],
                    "subject_name": row["subject_name"],
                    "credits": row["credits"],
                    "internal_marks": row["internal_marks"],
                    "external_marks": row["external_marks"],
                    "total_marks": row["total_marks"],
                    "grade": row["grade"],
                    "result_status": row["result_status"],
                    "internal_max": 30,
                    "external_max": 70,
                    "pass_marks": 40,
                    "subject_credits": subject[2] if subject else row["credits"],
                }
            )
        items.sort(key=lambda item: (item["roll_number"], item["subject_code"]))
        return {
            "department_code": department_code,
            "semester": semester,
            "count": len(items),
            "items": items,
        }
