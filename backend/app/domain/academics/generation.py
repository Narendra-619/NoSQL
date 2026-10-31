from __future__ import annotations

import random

from .catalog import (
    DEPARTMENTS,
    FIRST_NAMES,
    LAST_NAMES,
    MIDDLE_INITIALS,
    department_documents,
    subject_documents,
    subjects_for_semester,
)
from .constants import (
    ADMISSION_YEAR,
    GENERATED_AT,
    SEED_VALUE,
    SEED_VERSION,
    SEMESTERS,
    STUDENT_ROLL_PREFIX,
    STUDENTS_PER_DEPARTMENT,
)
from .grading import grade_for
from .records import make_result_row, student_id_for, summary_documents

def _unique_name(first: str, last: str, seen: set[str], index: int) -> str:
    name = f"{first} {last}"
    if name not in seen:
        seen.add(name)
        return name
    name = f"{first} {MIDDLE_INITIALS[index % len(MIDDLE_INITIALS)]} {last}"
    seen.add(name)
    return name


def _make_marks(
    rng: random.Random,
    ability: float,
    difficulty: int,
    must_fail: bool,
) -> tuple[int, int, int, str, float, bool]:
    if must_fail:
        total = rng.randint(26, 38)
    else:
        total = int(round(ability * 10 + difficulty * 1.4 + rng.gauss(0, 5.2)))
        total = min(98, max(40, total))
    internal = int(round(total * 0.3 + rng.gauss(0, 2.2)))
    internal = min(30, max(6, internal))
    external = total - internal
    if external > 70:
        external = 70
        total = internal + external
    if external < 0:
        external = 0
        total = internal
    grade, points = grade_for(total)
    return internal, external, total, grade, points, total >= 40


def generate_simulated_record(identity: dict, generation_seed: str) -> dict[int, list[dict]]:
    rng = random.Random(f"{identity['roll_number']}:{generation_seed}")
    ability = min(9.6, max(5.1, rng.gauss(7.35, 0.78)))

    backlog_target = 0
    if rng.random() < 0.13:
        backlog_target = rng.choices([1, 2, 3], weights=[6, 3, 1], k=1)[0]

    department_code = identity["department_code"]
    all_subjects = [
        (semester, subject)
        for semester in SEMESTERS
        for subject in subjects_for_semester(department_code, semester)
    ]
    failure_indexes = set(rng.sample(range(len(all_subjects)), backlog_target))

    semester_rows: dict[int, list[dict]] = {semester: [] for semester in SEMESTERS}
    for index, (semester, subject) in enumerate(all_subjects):
        _code, _name, _credits, difficulty = subject
        internal, external, _total, _grade, _points, _passed = _make_marks(
            rng, ability, difficulty, index in failure_indexes
        )
        semester_rows[semester].append(
            make_result_row(
                student_id=identity["student_id"],
                roll_number=identity["roll_number"],
                student_name=identity["name"],
                department_code=department_code,
                semester=semester,
                subject=subject,
                internal_marks=internal,
                external_marks=external,
            )
        )
    return semester_rows


def generate_dataset() -> dict:
    rng = random.Random(SEED_VALUE)
    seen_names: set[str] = set()
    students: list[dict] = []
    summaries: list[dict] = []
    student_results: list[dict] = []
    department_results: list[dict] = []

    global_index = 0
    for department in DEPARTMENTS:
        code = department["code"]
        for sequence in range(1, STUDENTS_PER_DEPARTMENT + 1):
            roll_number = f"{STUDENT_ROLL_PREFIX}{code}{sequence:03d}"
            student_id = student_id_for(roll_number)
            first = FIRST_NAMES[global_index % len(FIRST_NAMES)]
            last = LAST_NAMES[(global_index // len(FIRST_NAMES) + global_index * 3) % len(LAST_NAMES)]
            name = _unique_name(first, last, seen_names, global_index)
            section = "A" if sequence <= 50 else "B"
            identity = {
                "student_id": student_id,
                "roll_number": roll_number,
                "name": name,
                "department_code": code,
                "section": section,
            }

            students.append(
                {
                    "_id": student_id,
                    "roll_number": roll_number,
                    "name": name,
                    "department_code": code,
                    "section": section,
                    "admission_year": ADMISSION_YEAR,
                    "year_of_study": 2,
                    "current_semester": 4,
                    "email": f"{roll_number.lower()}@students.cit.example",
                    "status": "ACTIVE",
                    "record_source": "seed",
                    "created_at": GENERATED_AT,
                    "updated_at": GENERATED_AT,
                }
            )

            semester_rows = generate_simulated_record(
                identity, f"seed-{global_index}-{rng.random():.12f}"
            )
            for semester in SEMESTERS:
                for row in semester_rows[semester]:
                    student_results.append(row)
                    department_results.append(row)

            summaries.extend(
                summary_documents(
                    identity,
                    semester_rows,
                    computed_at=GENERATED_AT,
                    source_version=SEED_VERSION,
                )
            )
            global_index += 1

    assert len(students) == len(DEPARTMENTS) * STUDENTS_PER_DEPARTMENT
    assert len(summaries) == len(students) * len(SEMESTERS)
    assert len(student_results) == len(students) * len(SEMESTERS) * 5

    return {
        "students": students,
        "summaries": summaries,
        "subjects": subject_documents(),
        "departments": department_documents(),
        "student_results": student_results,
        "department_results": department_results,
        "student_count": len(students),
        "summary_count": len(summaries),
        "result_count": len(student_results),
    }
