from __future__ import annotations

from app.core.errors import BadRequestError, NotFoundError
from app.domain.academics import (
    SEMESTERS,
    generate_passing_marks,
    make_result_row,
    subjects_by_code,
    timestamp_now,
)
from app.schemas.requests import BacklogClearRequest


class BacklogAdminMixin:
    def backlog_record(self, student_id: str) -> dict:
        student = self._require_student(student_id)
        rows = self.results.student_results(student_id)
        items = []
        for row in sorted(
            rows, key=lambda item: (item["semester"], item["subject_code"])
        ):
            if row["result_status"] != "FAIL":
                continue
            subject = subjects_by_code(
                row["department_code"], row["semester"]
            ).get(row["subject_code"])
            items.append(
                {
                    "semester": row["semester"],
                    "subject_code": row["subject_code"],
                    "subject_name": subject[1] if subject else row["subject_name"],
                    "credits": subject[2] if subject else row["credits"],
                    "internal_marks": row["internal_marks"],
                    "external_marks": row["external_marks"],
                    "total_marks": row["total_marks"],
                    "grade": row["grade"],
                    "result_status": row["result_status"],
                    "internal_max": 30,
                    "external_max": 70,
                    "pass_marks": 40,
                }
            )
        summaries = self.students.get_summaries(student_id)
        return {
            "student": self._identity_view(student),
            "summary": self._summary_view(summaries[-1]) if summaries else None,
            "summaries": [self._summary_view(item) for item in summaries],
            "count": len(items),
            "items": items,
        }

    def preview_backlog_clear(
        self, student_id: str, payload: BacklogClearRequest
    ) -> dict:
        student = self._require_student(student_id)
        before_summaries = self.students.get_summaries(student_id)
        _rows, _old_rows, _new_rows, proposed, after_summaries = (
            self._plan_backlog_clear(student, payload)
        )
        return self._backlog_response(
            student,
            proposed,
            before_summaries,
            after_summaries,
            cleared=False,
        )

    def clear_backlogs(self, student_id: str, payload: BacklogClearRequest) -> dict:
        student = self._require_student(student_id)
        before_summaries = self.students.get_summaries(student_id)
        _rows, old_rows, new_rows, proposed, after_summaries = (
            self._plan_backlog_clear(student, payload)
        )

        applied: list[tuple[dict, dict]] = []
        try:
            for old_row, new_row in zip(old_rows, new_rows):
                if old_row["result_status"] != new_row["result_status"]:
                    self.results.delete_department_row(old_row)
                self.results.upsert_row(new_row)
                applied.append((old_row, new_row))
        except Exception:
            for old_row, new_row in reversed(applied):
                try:
                    self.results.delete_department_row(new_row)
                    self.results.upsert_row(old_row)
                except Exception:
                    pass
            raise

        self.students.upsert_summaries(after_summaries)
        self.students.update_student(
            student_id, {"updated_at": timestamp_now()}
        )

        before_summary = before_summaries[-1] if before_summaries else None
        after_summary = after_summaries[-1] if after_summaries else None
        cleared_labels = ", ".join(
            f"Sem {row['semester']} {row['subject_code']}" for row in new_rows
        )
        self._audit(
            action="result.backlog_clear",
            entity_type="result",
            entity_id=student_id,
            roll_number=student["roll_number"],
            summary=(
                f"Cleared {len(new_rows)} backlog(s) for "
                f"{student['roll_number']}: {cleared_labels}."
            ),
            record_source=student.get("record_source", "seed"),
            before={
                "semester": 4,
                "sgpa": before_summary["sgpa"] if before_summary else None,
                "cgpa": before_summary["cgpa"] if before_summary else None,
                "backlog_count": (
                    before_summary["backlog_count"] if before_summary else None
                ),
                "cleared_subjects": "",
            },
            after={
                "semester": 4,
                "sgpa": after_summary["sgpa"] if after_summary else None,
                "cgpa": after_summary["cgpa"] if after_summary else None,
                "backlog_count": (
                    after_summary["backlog_count"] if after_summary else None
                ),
                "cleared_subjects": cleared_labels,
            },
        )
        return self._backlog_response(
            student,
            proposed,
            before_summaries,
            after_summaries,
            cleared=True,
        )

    def _plan_backlog_clear(
        self, student: dict, payload: BacklogClearRequest
    ) -> tuple[dict[int, list[dict]], list[dict], list[dict], list[dict], list[dict]]:
        student_id = student["_id"]
        rows = self.results.student_results(student_id)
        rows_by_semester: dict[int, list[dict]] = {
            semester: [] for semester in SEMESTERS
        }
        for row in rows:
            rows_by_semester.setdefault(row["semester"], []).append(row)

        old_rows: list[dict] = []
        new_rows: list[dict] = []
        proposed: list[dict] = []
        for item in payload.items:
            semester = item.semester
            subject_code = item.subject_code
            subject = subjects_by_code(
                student["department_code"], semester
            ).get(subject_code)
            if not subject:
                raise NotFoundError(
                    f"Subject {subject_code} was not found in semester {semester}."
                )
            old_row = next(
                (
                    row
                    for row in rows_by_semester.get(semester, [])
                    if row["subject_code"] == subject_code
                ),
                None,
            )
            if not old_row:
                raise NotFoundError(
                    f"{student['roll_number']} has no {subject_code} result "
                    f"in semester {semester}."
                )
            if old_row["result_status"] != "FAIL":
                raise BadRequestError(
                    f"{subject_code} in semester {semester} is not a backlog."
                )

            if item.internal_marks is None:
                internal_marks, external_marks = generate_passing_marks(
                    student_id=student_id,
                    semester=semester,
                    subject_code=subject_code,
                )
            else:
                internal_marks = item.internal_marks
                external_marks = item.external_marks

            new_row = make_result_row(
                student_id=student_id,
                roll_number=student["roll_number"],
                student_name=student["name"],
                department_code=student["department_code"],
                semester=semester,
                subject=subject,
                internal_marks=internal_marks,
                external_marks=external_marks,
            )
            if new_row["result_status"] != "PASS":
                raise BadRequestError(
                    f"Marks for {subject_code} total {new_row['total_marks']}; "
                    "a passing total of at least 40 is required."
                )

            rows_by_semester[semester] = [
                new_row if row["subject_code"] == subject_code else row
                for row in rows_by_semester[semester]
            ]
            old_rows.append(old_row)
            new_rows.append(new_row)
            proposed.append(
                {
                    **self._result_view(new_row),
                    "previous": {
                        "internal_marks": old_row["internal_marks"],
                        "external_marks": old_row["external_marks"],
                        "total_marks": old_row["total_marks"],
                        "result_status": old_row["result_status"],
                    },
                }
            )

        after_summaries = self._build_summaries(
            self._summary_identity(student), rows_by_semester, "admin"
        )
        return rows_by_semester, old_rows, new_rows, proposed, after_summaries

    def _backlog_response(
        self,
        student: dict,
        proposed: list[dict],
        before_summaries: list[dict],
        after_summaries: list[dict],
        *,
        cleared: bool,
    ) -> dict:
        before_summary = before_summaries[-1] if before_summaries else None
        after_summary = after_summaries[-1] if after_summaries else None
        return {
            "student": self._identity_view(student),
            "cleared": cleared,
            "cleared_count": len(proposed),
            "items": proposed,
            "before": (
                self._summary_view(before_summary) if before_summary else None
            ),
            "after": self._summary_view(after_summary) if after_summary else None,
            "before_summaries": [
                self._summary_view(item) for item in before_summaries
            ],
            "after_summaries": [
                self._summary_view(item) for item in after_summaries
            ],
        }
