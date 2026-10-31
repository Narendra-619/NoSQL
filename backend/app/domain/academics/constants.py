from __future__ import annotations

SEED_VERSION = "2025-26.2"
SEED_VALUE = 20260723
GENERATED_AT = "2026-07-23T09:00:00Z"
ACADEMIC_YEAR = "2024-26"
ACADEMIC_YEARS = {
    1: "2024-25",
    2: "2024-25",
    3: "2025-26",
    4: "2025-26",
}
SEMESTERS = (1, 2, 3, 4)
STUDENTS_PER_DEPARTMENT = 100
STUDENT_ROLL_PREFIX = "24"
ADMISSION_YEAR = 2024


def academic_year_for_semester(semester: int) -> str:
    return ACADEMIC_YEARS[semester]
