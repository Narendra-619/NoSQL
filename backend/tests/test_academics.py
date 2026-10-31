from collections import Counter

import pytest

from app.domain.academics import (
    DEPARTMENTS,
    SEMESTERS,
    SUBJECT_CATALOG,
    generate_dataset,
    generate_passing_marks,
    grade_for,
    recalculate_summaries,
    round2,
    student_id_for,
)


@pytest.fixture(scope="module")
def dataset():
    return generate_dataset()


def test_dataset_has_expected_volume(dataset):
    assert len(dataset["students"]) == 500
    assert len(dataset["summaries"]) == 2000
    assert len(dataset["student_results"]) == 10000
    assert len(dataset["department_results"]) == 10000


def test_every_department_has_one_hundred_students(dataset):
    counts = Counter(student["department_code"] for student in dataset["students"])
    assert counts == {department["code"]: 100 for department in DEPARTMENTS}


def test_students_have_unique_roll_numbers_and_deterministic_ids(dataset):
    rolls = [student["roll_number"] for student in dataset["students"]]
    assert len(rolls) == len(set(rolls))
    for student in dataset["students"][:20]:
        assert student["_id"] == student_id_for(student["roll_number"])


def test_each_student_has_four_semesters_of_five_subjects(dataset):
    per_student = Counter(row["student_id"] for row in dataset["student_results"])
    assert set(per_student.values()) == {20}
    for department, semesters in SUBJECT_CATALOG.items():
        assert set(semesters) == set(SEMESTERS)
        assert all(len(subjects) == 5 for subjects in semesters.values())
        assert len({subject[0] for subjects in semesters.values() for subject in subjects}) == 20


def test_summaries_are_consistent_with_subject_results(dataset):
    grouped = {}
    for row in dataset["student_results"]:
        grouped.setdefault(row["student_id"], {}).setdefault(row["semester"], []).append(row)

    summaries = {(item["student_id"], item["semester"]): item for item in dataset["summaries"]}
    for student_id, semesters in grouped.items():
        recalculated = recalculate_summaries(semesters)
        for summary in recalculated:
            stored = summaries[(student_id, summary["semester"])]
            assert stored["sgpa"] == summary["sgpa"]
            assert stored["cgpa"] == summary["cgpa"]
            assert stored["backlog_count"] == summary["backlog_count"]
            assert stored["result_status"] == summary["result_status"]


def test_result_status_and_backlogs_follow_failed_subjects(dataset):
    per_student = Counter(
        row["student_id"] for row in dataset["student_results"] if row["result_status"] == "FAIL"
    )
    for summary in dataset["summaries"]:
        if summary["semester"] == 4:
            assert summary["backlog_count"] == per_student[summary["student_id"]]


def test_marks_threshold_and_grade_mapping():
    assert grade_for(0) == ("F", 0)
    assert grade_for(39) == ("F", 0)
    assert grade_for(40) == ("C", 5)
    assert grade_for(49) == ("C", 5)
    assert grade_for(50) == ("B", 6)
    assert grade_for(59) == ("B", 6)
    assert grade_for(60) == ("B+", 7)
    assert grade_for(69) == ("B+", 7)
    assert grade_for(70) == ("A", 8)
    assert grade_for(79) == ("A", 8)
    assert grade_for(80) == ("A+", 9)
    assert grade_for(89) == ("A+", 9)
    assert grade_for(90) == ("O", 10)
    assert grade_for(100) == ("O", 10)


def test_dataset_contains_realistic_failure_and_backlog_spread(dataset):
    failed = [row for row in dataset["student_results"] if row["result_status"] == "FAIL"]
    assert len(failed) == 105
    final = [item for item in dataset["summaries"] if item["semester"] == 4]
    assert round2(sum(item["cgpa"] for item in final) / len(final)) == 7.83
    assert round2(sum(item["result_status"] == "PASS" for item in final) / len(final) * 100) == 94.8
    backlog_counts = Counter(item["backlog_count"] for item in final)
    assert backlog_counts[0] == 432
    assert backlog_counts[1] == 38
    assert backlog_counts[2] == 23
    assert backlog_counts[3] == 7


def test_generated_passing_marks_are_deterministic_and_valid():
    student_id = student_id_for("24CSE001")
    first = generate_passing_marks(
        student_id=student_id, semester=2, subject_code="CSE201"
    )
    second = generate_passing_marks(
        student_id=student_id, semester=2, subject_code="CSE201"
    )
    assert first == second
    internal, external = first
    assert 0 <= internal <= 30
    assert 0 <= external <= 70
    assert 40 <= internal + external <= 62
    assert grade_for(internal + external)[0] != "F"


def test_generation_is_deterministic():
    first = generate_dataset()
    second = generate_dataset()
    assert first["students"] == second["students"]
    assert first["summaries"] == second["summaries"]
    assert first["student_results"] == second["student_results"]
