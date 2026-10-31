from __future__ import annotations

import uuid

from cassandra.cluster import Session

INSERT_STUDENT = """
INSERT INTO results_by_student_semester (
    student_id, semester, subject_code, subject_name, department_code, roll_number,
    academic_year, credits, internal_marks, external_marks, total_marks, grade,
    grade_points, result_status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

INSERT_DEPARTMENT = """
INSERT INTO results_by_department_semester (
    department_code, semester, subject_code, result_status, roll_number, student_id,
    student_name, subject_name, academic_year, credits, internal_marks, external_marks,
    total_marks, grade, grade_points
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

STUDENT_COLUMNS = (
    "student_id, semester, subject_code, subject_name, department_code, roll_number, "
    "academic_year, credits, internal_marks, external_marks, total_marks, grade, "
    "grade_points, result_status"
)

DEPARTMENT_COLUMNS = (
    "department_code, semester, subject_code, result_status, roll_number, student_id, "
    "student_name, subject_name, academic_year, credits, internal_marks, external_marks, "
    "total_marks, grade, grade_points"
)


class ResultRepository:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.by_student = session.prepare(
            f"SELECT {STUDENT_COLUMNS} FROM results_by_student_semester WHERE student_id = ?"
        )
        self.by_student_semester = session.prepare(
            f"""
            SELECT {STUDENT_COLUMNS} FROM results_by_student_semester
            WHERE student_id = ? AND semester = ?
            """
        )
        self.by_department_semester = session.prepare(
            f"""
            SELECT {DEPARTMENT_COLUMNS} FROM results_by_department_semester
            WHERE department_code = ? AND semester = ?
            """
        )
        self.by_subject = session.prepare(
            f"""
            SELECT {DEPARTMENT_COLUMNS} FROM results_by_department_semester
            WHERE department_code = ? AND semester = ? AND subject_code = ?
            """
        )
        self.failed_by_subject = session.prepare(
            f"""
            SELECT {DEPARTMENT_COLUMNS} FROM results_by_department_semester
            WHERE department_code = ? AND semester = ? AND subject_code = ?
              AND result_status = 'FAIL'
            """
        )
        self.insert_student = session.prepare(INSERT_STUDENT)
        self.insert_department = session.prepare(INSERT_DEPARTMENT)
        self.delete_department = session.prepare(
            """
            DELETE FROM results_by_department_semester
            WHERE department_code = ? AND semester = ? AND subject_code = ?
              AND result_status = ? AND roll_number = ?
            """
        )
        self.delete_student_partition = session.prepare(
            "DELETE FROM results_by_student_semester WHERE student_id = ?"
        )

    @staticmethod
    def to_dict(row) -> dict:
        return {
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
            "grade_points": float(row.grade_points),
            "result_status": row.result_status,
            "student_name": getattr(row, "student_name", None),
        }

    def student_results(self, student_id: str) -> list[dict]:
        rows = self.session.execute(self.by_student, (uuid.UUID(student_id),))
        return [self.to_dict(row) for row in rows]

    def student_semester_results(self, student_id: str, semester: int) -> list[dict]:
        rows = self.session.execute(
            self.by_student_semester, (uuid.UUID(student_id), semester)
        )
        return [self.to_dict(row) for row in rows]

    def department_semester_results(self, department_code: str, semester: int) -> list[dict]:
        rows = self.session.execute(
            self.by_department_semester, (department_code, semester)
        )
        return [self.to_dict(row) for row in rows]

    def subject_results(self, department_code: str, semester: int, subject_code: str) -> list[dict]:
        rows = self.session.execute(
            self.by_subject, (department_code, semester, subject_code)
        )
        return [self.to_dict(row) for row in rows]

    def failed_subject_results(
        self, department_code: str, semester: int, subject_code: str
    ) -> list[dict]:
        rows = self.session.execute(
            self.failed_by_subject, (department_code, semester, subject_code)
        )
        return [self.to_dict(row) for row in rows]

    def insert_student_row(self, row: dict) -> None:
        self.session.execute(
            self.insert_student,
            (
                uuid.UUID(row["student_id"]),
                row["semester"],
                row["subject_code"],
                row["subject_name"],
                row["department_code"],
                row["roll_number"],
                row["academic_year"],
                row["credits"],
                row["internal_marks"],
                row["external_marks"],
                row["total_marks"],
                row["grade"],
                row["grade_points"],
                row["result_status"],
            ),
        )

    def insert_department_row(self, row: dict) -> None:
        self.session.execute(
            self.insert_department,
            (
                row["department_code"],
                row["semester"],
                row["subject_code"],
                row["result_status"],
                row["roll_number"],
                uuid.UUID(row["student_id"]),
                row.get("student_name") or "",
                row["subject_name"],
                row["academic_year"],
                row["credits"],
                row["internal_marks"],
                row["external_marks"],
                row["total_marks"],
                row["grade"],
                row["grade_points"],
            ),
        )

    def upsert_row(self, row: dict) -> None:
        self.insert_student_row(row)
        self.insert_department_row(row)

    def insert_rows(self, rows: list[dict]) -> None:
        for row in rows:
            self.upsert_row(row)

    def delete_department_row(self, row: dict) -> None:
        self.session.execute(
            self.delete_department,
            (
                row["department_code"],
                row["semester"],
                row["subject_code"],
                row["result_status"],
                row["roll_number"],
            ),
        )

    def delete_student_rows(self, student_id: str) -> None:
        self.session.execute(self.delete_student_partition, (uuid.UUID(student_id),))
