from __future__ import annotations

GRADE_BANDS = [
    (90, "O", 10.0),
    (80, "A+", 9.0),
    (70, "A", 8.0),
    (60, "B+", 7.0),
    (50, "B", 6.0),
    (40, "C", 5.0),
    (0, "F", 0.0),
]


def grade_for(total_marks: int) -> tuple[str, float]:
    for threshold, grade, points in GRADE_BANDS:
        if total_marks >= threshold:
            return grade, points
    return "F", 0.0


def grade_scale_document() -> list[dict]:
    return [
        {"min_marks": threshold, "grade": grade, "points": round2(points)}
        for threshold, grade, points in GRADE_BANDS
    ]


def result_status(failed_count: int) -> str:
    return "PASS" if failed_count == 0 else "FAIL"


def round2(value: float) -> float:
    return float(f"{value:.2f}")
