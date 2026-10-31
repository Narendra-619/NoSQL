from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_analytics_service, get_student_service
from app.schemas.responses import (
    DepartmentComparisonResponse,
    DepartmentOut,
    OverviewMetrics,
    FailureResponse,
    StudentComparisonResponse,
    StudentListResponse,
    StudentProfileResponse,
    StudentResultsResponse,
    SemesterTrendsResponse,
    SubjectAnalyticsResponse,
    SubjectOut,
)
from app.services.analytics import AnalyticsService
from app.services.students import StudentService

router = APIRouter(prefix="/api")

SemesterQuery = Annotated[int, Query(ge=1, le=4)]
ResultStatusQuery = Literal["PASS", "FAIL"]
SortQuery = Literal["roll_asc", "cgpa_desc", "cgpa_asc", "backlogs_desc"]


@router.get("/departments", response_model=list[DepartmentOut])
def departments(
    semester: SemesterQuery = 4,
    service: StudentService = Depends(get_student_service),
):
    return service.list_departments(semester)


@router.get("/departments/{department_code}/subjects", response_model=list[SubjectOut])
def subjects(
    department_code: str,
    semester: SemesterQuery = 4,
    service: StudentService = Depends(get_student_service),
):
    return service.list_subjects(department_code, semester)


@router.get("/students", response_model=StudentListResponse)
def students(
    semester: SemesterQuery = 4,
    department: str | None = None,
    cgpa_min: Annotated[float | None, Query(ge=0, le=10)] = None,
    cgpa_max: Annotated[float | None, Query(ge=0, le=10)] = None,
    backlog_min: Annotated[int | None, Query(ge=0, le=10)] = None,
    backlog_max: Annotated[int | None, Query(ge=0, le=10)] = None,
    status: ResultStatusQuery | None = None,
    sort: SortQuery = "roll_asc",
    page: Annotated[int, Query(ge=1, le=10000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    service: StudentService = Depends(get_student_service),
):
    return service.list_students(
        semester=semester,
        department_code=department,
        cgpa_min=cgpa_min,
        cgpa_max=cgpa_max,
        backlog_min=backlog_min,
        backlog_max=backlog_max,
        result_status=status,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/students/{student_id}", response_model=StudentProfileResponse)
def student_profile(
    student_id: UUID,
    service: StudentService = Depends(get_student_service),
):
    return service.profile(student_id)


@router.get("/students/{student_id}/results", response_model=StudentResultsResponse)
def student_results(
    student_id: UUID,
    semester: SemesterQuery | None = None,
    service: StudentService = Depends(get_student_service),
):
    return service.results_for_student(student_id, semester)


@router.get("/students/{student_id}/comparison", response_model=StudentComparisonResponse)
def student_comparison(
    student_id: UUID,
    service: StudentService = Depends(get_student_service),
):
    return service.comparison(student_id)


@router.get("/results/failures", response_model=FailureResponse)
def failed_results(
    department: str,
    semester: SemesterQuery,
    subject: str,
    service: StudentService = Depends(get_student_service),
):
    return service.failures(department, semester, subject)


@router.get("/analytics/overview", response_model=OverviewMetrics)
def overview(
    semester: SemesterQuery = 4,
    department: str | None = None,
    service: AnalyticsService = Depends(get_analytics_service),
):
    return service.overview(semester, department)


@router.get("/analytics/departments", response_model=DepartmentComparisonResponse)
def department_comparison(
    semester: SemesterQuery = 4,
    service: AnalyticsService = Depends(get_analytics_service),
):
    return service.department_comparison(semester)


@router.get("/analytics/trends", response_model=SemesterTrendsResponse)
def trends(
    department: str,
    service: AnalyticsService = Depends(get_analytics_service),
):
    return service.trends(department)


@router.get("/analytics/subjects", response_model=SubjectAnalyticsResponse)
def subject_analytics(
    department: str,
    semester: SemesterQuery,
    service: StudentService = Depends(get_student_service),
):
    return service.subject_analytics(department, semester)
