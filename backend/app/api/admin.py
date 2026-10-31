from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query

from app.api.deps import get_admin_service, require_admin
from app.schemas.requests import (
    BacklogClearRequest,
    ResultUpdateRequest,
    StudentCreateRequest,
    StudentUpdateRequest,
)
from app.services.admin import AdminService

router = APIRouter(
    prefix="/api/admin",
    dependencies=[Depends(require_admin)],
    tags=["admin"],
)

SemesterQuery = Annotated[int, Query(ge=1, le=4)]
SemesterPath = Annotated[int, Path(ge=1, le=4)]


@router.get("/session")
def session():
    return {"ok": True}


@router.get("/meta")
def meta(
    department: str,
    service: AdminService = Depends(get_admin_service),
):
    return service.meta(department)


@router.get("/students")
def students(
    department: str,
    semester: SemesterQuery = 4,
    search: Annotated[str | None, Query(max_length=100)] = None,
    service: AdminService = Depends(get_admin_service),
):
    return service.list_students(department, semester, search)


@router.post("/students/preview")
def preview_student(
    payload: StudentCreateRequest,
    service: AdminService = Depends(get_admin_service),
):
    return service.preview(payload)


@router.post("/students", status_code=201)
def create_student(
    payload: StudentCreateRequest,
    service: AdminService = Depends(get_admin_service),
):
    return service.create(payload)


@router.patch("/students/{student_id}")
def update_student(
    student_id: UUID,
    payload: StudentUpdateRequest,
    service: AdminService = Depends(get_admin_service),
):
    return service.update_student(str(student_id), payload)


@router.delete("/students/{student_id}")
def delete_student(
    student_id: UUID,
    service: AdminService = Depends(get_admin_service),
):
    return service.delete_student(str(student_id))


@router.get("/students/{student_id}/record")
def student_record(
    student_id: UUID,
    service: AdminService = Depends(get_admin_service),
):
    return service.student_record(str(student_id))


@router.put("/students/{student_id}/results/{semester}/{subject_code}")
def correct_result(
    student_id: UUID,
    semester: SemesterPath,
    subject_code: str,
    payload: ResultUpdateRequest,
    service: AdminService = Depends(get_admin_service),
):
    return service.correct_result(str(student_id), semester, subject_code, payload)


@router.get("/students/{student_id}/backlogs")
def student_backlogs(
    student_id: UUID,
    service: AdminService = Depends(get_admin_service),
):
    return service.backlog_record(str(student_id))


@router.post("/students/{student_id}/backlogs/preview")
def preview_student_backlogs(
    student_id: UUID,
    payload: BacklogClearRequest,
    service: AdminService = Depends(get_admin_service),
):
    return service.preview_backlog_clear(str(student_id), payload)


@router.post("/students/{student_id}/backlogs/clear")
def clear_student_backlogs(
    student_id: UUID,
    payload: BacklogClearRequest,
    service: AdminService = Depends(get_admin_service),
):
    return service.clear_backlogs(str(student_id), payload)


@router.get("/failures")
def failures(
    department: str,
    semester: SemesterQuery,
    service: AdminService = Depends(get_admin_service),
):
    return service.failures(department, semester)


@router.get("/audit")
def audit_log(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    service: AdminService = Depends(get_admin_service),
):
    return service.audit_log(limit)
