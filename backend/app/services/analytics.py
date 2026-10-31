from __future__ import annotations

from app.core.errors import NotFoundError
from app.repositories.students import StudentRepository


class AnalyticsService:
    def __init__(self, student_repository: StudentRepository) -> None:
        self.students = student_repository

    def _require_department(self, code: str) -> dict:
        department = self.students.get_department(code)
        if not department:
            raise NotFoundError(f"Department {code} was not found.")
        return department

    def overview(self, semester: int, department_code: str | None) -> dict:
        if department_code:
            self._require_department(department_code)
        metrics = self.students.overview(semester, department_code)
        return {
            "scope": "department" if department_code else "college",
            "department_code": department_code,
            "semester": semester,
            **metrics,
        }

    def department_comparison(self, semester: int) -> dict:
        return {
            "semester": semester,
            "departments": self.students.department_comparison(semester),
        }

    def trends(self, department_code: str) -> dict:
        department = self._require_department(department_code)
        return {
            "department_code": department_code,
            "department_name": department["name"],
            "semesters": self.students.trends(department_code),
        }
