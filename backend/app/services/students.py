from __future__ import annotations

from uuid import UUID

from app.core.errors import BadRequestError, NotFoundError
from app.domain.academics import SEMESTERS, recalculate_summaries, round2
from app.repositories.results import ResultRepository
from app.repositories.students import StudentRepository


class StudentService:
    def __init__(
        self, student_repository: StudentRepository, result_repository: ResultRepository
    ) -> None:
        self.students = student_repository
        self.results = result_repository

    def _require_department(self, code: str) -> dict:
        department = self.students.get_department(code)
        if not department:
            raise NotFoundError(f"Department {code} was not found.")
        return department

    def _identity(self, student: dict) -> dict:
        department = self.students.get_department(student["department_code"])
        return {
            "student_id": student["_id"],
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
        }

    def list_departments(self, semester: int) -> list[dict]:
        return self.students.list_departments(semester)

    def list_subjects(self, department_code: str, semester: int) -> list[dict]:
        self._require_department(department_code)
        return self.students.list_subjects(department_code, semester)

    def list_students(
        self,
        *,
        semester: int,
        department_code: str | None,
        cgpa_min: float | None,
        cgpa_max: float | None,
        backlog_min: int | None,
        backlog_max: int | None,
        result_status: str | None,
        sort: str,
        page: int,
        page_size: int,
    ) -> dict:
        if department_code:
            self._require_department(department_code)
        if cgpa_min is not None and cgpa_max is not None and cgpa_min > cgpa_max:
            raise BadRequestError("cgpa_min cannot be greater than cgpa_max.")
        if backlog_min is not None and backlog_max is not None and backlog_min > backlog_max:
            raise BadRequestError("backlog_min cannot be greater than backlog_max.")
        items, total = self.students.list_students(
            semester=semester,
            department_code=department_code,
            cgpa_min=cgpa_min,
            cgpa_max=cgpa_max,
            backlog_min=backlog_min,
            backlog_max=backlog_max,
            result_status=result_status,
            sort=sort,
            page=page,
            page_size=page_size,
        )
        total_pages = (total + page_size - 1) // page_size if total else 0
        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "semester": semester,
            "filters": {
                "department_code": department_code,
                "cgpa_min": cgpa_min,
                "cgpa_max": cgpa_max,
                "backlog_min": backlog_min,
                "backlog_max": backlog_max,
                "result_status": result_status,
                "sort": sort,
            },
        }

    def _student_or_404(self, student_id: UUID) -> dict:
        student = self.students.get_student(str(student_id))
        if not student:
            raise NotFoundError("Student was not found.")
        return student

    def profile(self, student_id: UUID) -> dict:
        student = self._student_or_404(student_id)
        summaries = self.students.get_summaries(str(student_id))
        overall_backlogs = max((item["backlog_count"] for item in summaries), default=0)
        overall_status = (
            "FAIL"
            if any(item["result_status"] == "FAIL" for item in summaries)
            or overall_backlogs > 0
            else "PASS"
        )
        return {
            "student": self._identity(student),
            "summaries": [
                {
                    "semester": item["semester"],
                    "academic_year": item["academic_year"],
                    "sgpa": item["sgpa"],
                    "cgpa": item["cgpa"],
                    "credits_registered": item["credits_registered"],
                    "credits_earned": item["credits_earned"],
                    "subject_count": item["subject_count"],
                    "failed_subject_count": item["failed_subject_count"],
                    "semester_backlog_count": item["semester_backlog_count"],
                    "backlog_count": item["backlog_count"],
                    "result_status": item["result_status"],
                }
                for item in summaries
            ],
            "overall_backlog_count": overall_backlogs,
            "overall_result_status": overall_status,
        }

    def _group_results(self, student_id: UUID) -> tuple[dict, dict[int, list[dict]]]:
        rows = self.results.student_results(str(student_id))
        grouped: dict[int, list[dict]] = {semester: [] for semester in SEMESTERS}
        for row in rows:
            grouped.setdefault(row["semester"], []).append(row)
        summaries = {
            item["semester"]: item for item in recalculate_summaries(grouped)
        }
        return summaries, grouped

    def results_for_student(self, student_id: UUID, semester: int | None = None) -> dict:
        student = self._student_or_404(student_id)
        summary_map, grouped = self._group_results(student_id)
        selected = [semester] if semester is not None else list(SEMESTERS)
        semesters = []
        for item_semester in selected:
            rows = sorted(grouped.get(item_semester, []), key=lambda row: row["subject_code"])
            if not rows:
                continue
            summary = summary_map[item_semester]
            semesters.append(
                {
                    "semester": item_semester,
                    "academic_year": rows[0]["academic_year"],
                    "subjects": [
                        {
                            "subject_code": row["subject_code"],
                            "subject_name": row["subject_name"],
                            "credits": row["credits"],
                            "internal_marks": row["internal_marks"],
                            "external_marks": row["external_marks"],
                            "total_marks": row["total_marks"],
                            "grade": row["grade"],
                            "grade_points": row["grade_points"],
                            "result_status": row["result_status"],
                        }
                        for row in rows
                    ],
                    "sgpa": summary["sgpa"],
                    "cgpa": summary["cgpa"],
                    "credits_registered": summary["credits_registered"],
                    "credits_earned": summary["credits_earned"],
                    "semester_backlog_count": summary["semester_backlog_count"],
                    "backlog_count": summary["backlog_count"],
                    "result_status": summary["result_status"],
                    "failed_subjects": [
                        row["subject_name"]
                        for row in rows
                        if row["result_status"] == "FAIL"
                    ],
                }
            )
        return {
            "student_id": student["_id"],
            "roll_number": student["roll_number"],
            "name": student["name"],
            "semesters": semesters,
        }

    def comparison(self, student_id: UUID) -> dict:
        student = self._student_or_404(student_id)
        result = self.results_for_student(student_id)
        semesters = [
            {
                "semester": item["semester"],
                "sgpa": item["sgpa"],
                "cgpa": item["cgpa"],
                "credits_registered": item["credits_registered"],
                "credits_earned": item["credits_earned"],
                "backlog_count": item["backlog_count"],
                "semester_backlog_count": item["semester_backlog_count"],
                "result_status": item["result_status"],
                "failed_subjects": item["failed_subjects"],
            }
            for item in result["semesters"]
        ]
        delta = None
        if len(semesters) >= 2:
            first, last = semesters[0], semesters[-1]
            delta = {
                "sgpa": round2(last["sgpa"] - first["sgpa"]),
                "cgpa": round2(last["cgpa"] - first["cgpa"]),
                "backlog_count": last["backlog_count"] - first["backlog_count"],
                "credits_earned": last["credits_earned"] - first["credits_earned"],
            }
        return {
            "student_id": student["_id"],
            "roll_number": student["roll_number"],
            "name": student["name"],
            "semesters": semesters,
            "delta": delta,
        }

    def failures(self, department_code: str, semester: int, subject_code: str) -> dict:
        self._require_department(department_code)
        subject = self.students.get_subject(department_code, semester, subject_code)
        if not subject:
            raise NotFoundError("Subject was not found for this department and semester.")
        rows = self.results.failed_subject_results(department_code, semester, subject_code)
        items = [
            {
                "student_id": row["student_id"],
                "roll_number": row["roll_number"],
                "student_name": row["student_name"] or "",
                "department_code": row["department_code"],
                "semester": row["semester"],
                "subject_code": row["subject_code"],
                "subject_name": row["subject_name"],
                "total_marks": row["total_marks"],
                "grade": row["grade"],
            }
            for row in sorted(rows, key=lambda item: item["roll_number"])
        ]
        return {
            "department_code": department_code,
            "semester": semester,
            "subject_code": subject_code,
            "subject_name": subject["name"],
            "count": len(items),
            "items": items,
        }

    def subject_analytics(self, department_code: str, semester: int) -> dict:
        self._require_department(department_code)
        rows = self.results.department_semester_results(department_code, semester)
        grouped: dict[str, dict] = {}
        for row in rows:
            item = grouped.setdefault(
                row["subject_code"],
                {
                    "subject_code": row["subject_code"],
                    "subject_name": row["subject_name"],
                    "appeared": 0,
                    "passed": 0,
                    "failed": 0,
                },
            )
            item["appeared"] += 1
            if row["result_status"] == "PASS":
                item["passed"] += 1
            else:
                item["failed"] += 1
        subjects = []
        for item in sorted(grouped.values(), key=lambda entry: entry["subject_code"]):
            item["pass_percentage"] = (
                round2(item["passed"] / item["appeared"] * 100) if item["appeared"] else 0.0
            )
            item["failure_percentage"] = (
                round2(item["failed"] / item["appeared"] * 100) if item["appeared"] else 0.0
            )
            subjects.append(item)
        return {
            "department_code": department_code,
            "semester": semester,
            "subjects": subjects,
        }
