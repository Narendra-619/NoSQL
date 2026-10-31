from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

ResultStatus = Literal["PASS", "FAIL"]


class DepartmentOut(BaseModel):
    code: str
    name: str
    short_name: str
    hod: str
    established_year: int
    intake: int
    student_count: int = 0


class SubjectOut(BaseModel):
    code: str
    name: str
    department_code: str
    semester: int
    credits: int


class StudentIdentityOut(BaseModel):
    student_id: str
    roll_number: str
    name: str
    department_code: str
    department_name: str
    section: str
    admission_year: int
    year_of_study: int
    current_semester: int
    email: str | None = None
    status: str


class SummaryOut(BaseModel):
    semester: int
    academic_year: str
    sgpa: float
    cgpa: float
    credits_registered: int
    credits_earned: int
    subject_count: int
    failed_subject_count: int
    semester_backlog_count: int
    backlog_count: int
    result_status: ResultStatus


class StudentListItem(BaseModel):
    student_id: str
    roll_number: str
    name: str
    department_code: str
    department_name: str
    section: str
    semester: int
    sgpa: float
    cgpa: float
    backlog_count: int
    result_status: ResultStatus


class StudentListResponse(BaseModel):
    items: list[StudentListItem]
    page: int
    page_size: int
    total: int
    total_pages: int
    semester: int
    filters: dict[str, Any]


class StudentProfileResponse(BaseModel):
    student: StudentIdentityOut
    summaries: list[SummaryOut]
    overall_backlog_count: int
    overall_result_status: ResultStatus


class SubjectResultOut(BaseModel):
    subject_code: str
    subject_name: str
    credits: int
    internal_marks: int
    external_marks: int
    total_marks: int
    grade: str
    grade_points: float
    result_status: ResultStatus


class SemesterResultsOut(BaseModel):
    semester: int
    academic_year: str
    subjects: list[SubjectResultOut]
    sgpa: float
    cgpa: float
    credits_registered: int
    credits_earned: int
    semester_backlog_count: int
    backlog_count: int
    result_status: ResultStatus
    failed_subjects: list[str]


class StudentResultsResponse(BaseModel):
    student_id: str
    roll_number: str
    name: str
    semesters: list[SemesterResultsOut]


class SemesterComparisonOut(BaseModel):
    semester: int
    sgpa: float
    cgpa: float
    credits_registered: int
    credits_earned: int
    backlog_count: int
    semester_backlog_count: int
    result_status: ResultStatus
    failed_subjects: list[str]


class ComparisonDeltaOut(BaseModel):
    sgpa: float
    cgpa: float
    backlog_count: int
    credits_earned: int


class StudentComparisonResponse(BaseModel):
    student_id: str
    roll_number: str
    name: str
    semesters: list[SemesterComparisonOut]
    delta: ComparisonDeltaOut | None


class FailureItem(BaseModel):
    student_id: str
    roll_number: str
    student_name: str
    department_code: str
    semester: int
    subject_code: str
    subject_name: str
    total_marks: int
    grade: str


class FailureResponse(BaseModel):
    department_code: str
    semester: int
    subject_code: str
    subject_name: str
    count: int
    items: list[FailureItem]


class SubjectStat(BaseModel):
    subject_code: str
    subject_name: str
    appeared: int
    passed: int
    failed: int
    pass_percentage: float
    failure_percentage: float


class SubjectAnalyticsResponse(BaseModel):
    department_code: str
    semester: int
    subjects: list[SubjectStat]


class OverviewMetrics(BaseModel):
    scope: Literal["college", "department"]
    department_code: str | None
    semester: int
    student_count: int
    pass_count: int
    fail_count: int
    average_cgpa: float
    pass_percentage: float
    students_with_backlogs: int
    average_backlogs: float


class DepartmentComparisonItem(BaseModel):
    department_code: str
    department_name: str
    student_count: int
    average_cgpa: float
    pass_percentage: float
    students_with_backlogs: int
    backlog_rate: float


class DepartmentComparisonResponse(BaseModel):
    semester: int
    departments: list[DepartmentComparisonItem]


class SemesterTrendItem(BaseModel):
    semester: int
    student_count: int
    average_cgpa: float
    pass_percentage: float
    students_with_backlogs: int


class SemesterTrendsResponse(BaseModel):
    department_code: str
    department_name: str
    semesters: list[SemesterTrendItem]


class ServiceHealth(BaseModel):
    ok: bool
    latency_ms: float | None = None
    detail: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    services: dict[str, ServiceHealth]
    timestamp: str
