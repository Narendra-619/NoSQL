from __future__ import annotations

from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.domain.academics import (
    SEMESTERS,
    generate_simulated_record,
    grade_scale_document,
    make_result_row,
    subjects_by_code,
    subjects_for_semester,
    timestamp_now,
)
from app.schemas.requests import (
    ManualSemesterInput,
    StudentCreateRequest,
    StudentUpdateRequest,
)


class StudentAdminMixin:
    def _manual_rows(
        self, identity: dict, semesters: list[ManualSemesterInput] | None
    ) -> dict[int, list[dict]]:
        if not semesters:
            raise BadRequestError("Manual creation requires results for all four semesters.")
        by_semester = {item.semester: item for item in semesters}
        if set(by_semester) != set(SEMESTERS) or len(semesters) != len(SEMESTERS):
            raise BadRequestError("Manual creation requires exactly semesters 1 through 4.")

        rows_by_semester: dict[int, list[dict]] = {}
        department_code = identity["department_code"]
        for semester in SEMESTERS:
            semester_input = by_semester[semester]
            expected = subjects_by_code(department_code, semester)
            supplied = {}
            for item in semester_input.results:
                if item.subject_code in supplied:
                    raise BadRequestError(
                        f"Duplicate subject {item.subject_code} in semester {semester}."
                    )
                supplied[item.subject_code] = item
            if set(supplied) != set(expected):
                missing = sorted(set(expected) - set(supplied))
                extra = sorted(set(supplied) - set(expected))
                detail = []
                if missing:
                    detail.append(f"missing {', '.join(missing)}")
                if extra:
                    detail.append(f"unexpected {', '.join(extra)}")
                raise BadRequestError(
                    f"Semester {semester} results must contain all five subjects"
                    + (f" ({'; '.join(detail)})" if detail else ".")
                )

            rows = []
            for subject in subjects_for_semester(department_code, semester):
                item = supplied[subject[0]]
                rows.append(
                    make_result_row(
                        student_id=identity["student_id"],
                        roll_number=identity["roll_number"],
                        student_name=identity["name"],
                        department_code=department_code,
                        semester=semester,
                        subject=subject,
                        internal_marks=item.internal_marks,
                        external_marks=item.external_marks,
                    )
                )
            rows_by_semester[semester] = rows
        return rows_by_semester

    def _build_rows(
        self, identity: dict, payload: StudentCreateRequest
    ) -> tuple[dict[int, list[dict]], str | None]:
        if payload.mode == "simulated":
            seed = payload.generation_seed or uuid4().hex
            return generate_simulated_record(identity, seed), seed
        return self._manual_rows(identity, payload.semesters), None

    def preview(self, payload: StudentCreateRequest) -> dict:
        identity = self._build_identity(payload.identity)
        rows_by_semester, seed = self._build_rows(identity, payload)
        summaries = self._build_summaries(identity, rows_by_semester, "preview")
        return self._record_view(
            identity,
            rows_by_semester,
            summaries,
            mode=payload.mode,
            generation_seed=seed,
            roll_number_available=self.students.get_student_by_roll(
                identity["roll_number"]
            )
            is None,
        )

    def create(self, payload: StudentCreateRequest) -> dict:
        identity = self._build_identity(payload.identity)
        if self.students.get_student_by_roll(identity["roll_number"]):
            raise ConflictError(
                f"Roll number {identity['roll_number']} already exists."
            )

        rows_by_semester, seed = self._build_rows(identity, payload)
        flat_rows = [
            row for semester in SEMESTERS for row in rows_by_semester[semester]
        ]
        summaries = self._build_summaries(identity, rows_by_semester, "admin")
        now = timestamp_now()
        student = {
            **identity,
            "_id": identity["student_id"],
            "record_source": payload.mode,
            "created_at": now,
            "updated_at": now,
        }
        student.pop("student_id", None)

        inserted = False
        try:
            self.students.insert_student(student)
            inserted = True
            self.results.insert_rows(flat_rows)
            self.students.upsert_summaries(summaries)
        except DuplicateKeyError as exc:
            self._rollback_created(identity["student_id"], inserted)
            raise ConflictError(
                f"Roll number {identity['roll_number']} already exists."
            ) from exc
        except Exception:
            self._rollback_created(identity["student_id"], inserted)
            raise

        self._audit(
            action="student.create",
            entity_type="student",
            entity_id=identity["student_id"],
            roll_number=identity["roll_number"],
            summary=f"Created {payload.mode} academic record for {identity['roll_number']}.",
            record_source=payload.mode,
            after={
                "identity": self._identity_view(student),
                "overall_backlog_count": summaries[-1]["backlog_count"],
            },
        )
        record = self._record_view(
            student,
            rows_by_semester,
            summaries,
            mode=payload.mode,
            generation_seed=seed,
            roll_number_available=True,
        )
        record["student"] = self._identity_view(student)
        return record

    def _rollback_created(self, student_id: str, student_inserted: bool) -> None:
        if not student_inserted:
            return
        try:
            self.students.delete_summaries(student_id)
            self.students.delete_student(student_id)
            self.results.delete_student_rows(student_id)
        except Exception:
            pass

    def list_students(
        self, department_code: str, semester: int, search: str | None = None
    ) -> dict:
        self._require_department(department_code)
        students = self.students.list_students_by_department(department_code)
        summaries = self.students.summaries_for_semester(
            [item["_id"] for item in students], semester
        )
        term = (search or "").strip().lower()
        items = []
        for student in students:
            if term and term not in student["roll_number"].lower() and term not in student["name"].lower():
                continue
            summary = summaries.get(student["_id"])
            items.append(
                {
                    "student_id": student["_id"],
                    "roll_number": student["roll_number"],
                    "name": student["name"],
                    "department_code": student["department_code"],
                    "department_name": self.students.get_department(
                        student["department_code"]
                    )["name"],
                    "section": student["section"],
                    "status": student["status"],
                    "current_semester": student["current_semester"],
                    "record_source": student.get("record_source", "seed"),
                    "summary": self._summary_view(summary) if summary else None,
                }
            )
        return {
            "department_code": department_code,
            "semester": semester,
            "items": items,
            "total": len(items),
        }

    def meta(self, department_code: str) -> dict:
        department = self._require_department(department_code)
        subjects = list(
            self.students.subjects.find({"department_code": department_code}).sort(
                [("semester", 1), ("code", 1)]
            )
        )
        return {
            "department": {
                "code": department["_id"],
                "name": department["name"],
                "short_name": department["short_name"],
            },
            "semesters": list(SEMESTERS),
            "subjects": [
                {
                    "code": item["code"],
                    "name": item["name"],
                    "semester": item["semester"],
                    "credits": item["credits"],
                    "internal_max": item.get("internal_max", 30),
                    "external_max": item.get("external_max", 70),
                    "pass_marks": item.get("pass_marks", 40),
                }
                for item in subjects
            ],
            "grade_bands": grade_scale_document(),
            "limits": {
                "internal_max": 30,
                "external_max": 70,
                "total_max": 100,
                "pass_marks": 40,
            },
        }

    def student_record(self, student_id: str) -> dict:
        student = self._require_student(student_id)
        rows = self.results.student_results(student_id)
        rows_by_semester: dict[int, list[dict]] = {semester: [] for semester in SEMESTERS}
        for row in rows:
            rows_by_semester.setdefault(row["semester"], []).append(row)
        summaries = self.students.get_summaries(student_id)
        return self._record_view(
            student,
            rows_by_semester,
            summaries,
            mode=student.get("record_source", "seed"),
            generation_seed=None,
            roll_number_available=True,
        )

    def update_student(self, student_id: str, payload: StudentUpdateRequest) -> dict:
        student = self._require_student(student_id)
        fields = payload.model_dump(exclude_unset=True)
        if "current_semester" in fields:
            fields["year_of_study"] = (fields["current_semester"] + 1) // 2
        fields["updated_at"] = timestamp_now()

        before = self._identity_view(student)
        name = fields.get("name")
        section = fields.get("section")
        if name is not None and name != student["name"]:
            rows = self.results.student_results(student_id)
            for row in rows:
                row["student_name"] = name
                self.results.upsert_row(row)
        if name is not None or section is not None:
            self.students.update_summary_identity(
                student_id, name=name, section=section
            )

        updated = self.students.update_student(student_id, fields)
        if not updated:
            raise NotFoundError("Student was not found.")
        after = self._identity_view(updated)
        self._audit(
            action="student.update",
            entity_type="student",
            entity_id=student_id,
            roll_number=updated["roll_number"],
            summary=f"Updated profile for {updated['roll_number']}.",
            record_source=updated.get("record_source", "seed"),
            before=before,
            after=after,
        )
        summaries = self.students.get_summaries(student_id)
        return {
            "student": after,
            "summaries": [self._summary_view(item) for item in summaries],
        }

    def delete_student(self, student_id: str) -> dict:
        student = self._require_student(student_id)
        identity = self._identity_view(student)
        rows = self.results.student_results(student_id)
        for row in rows:
            self.results.delete_department_row(row)
        self.results.delete_student_rows(student_id)
        self.students.delete_summaries(student_id)
        self.students.delete_student(student_id)
        self._audit(
            action="student.delete",
            entity_type="student",
            entity_id=student_id,
            roll_number=student["roll_number"],
            summary=(
                f"Permanently deleted {student['roll_number']} "
                f"and {len(rows)} subject records."
            ),
            record_source=student.get("record_source", "seed"),
            before=identity,
        )
        return {"deleted": True, "student": identity}
