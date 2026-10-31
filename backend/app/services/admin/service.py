from __future__ import annotations

from app.repositories.results import ResultRepository
from app.repositories.students import StudentRepository

from .audit import AuditAdminMixin
from .backlogs import BacklogAdminMixin
from .common import AdminCommonMixin
from .results import ResultAdminMixin
from .students import StudentAdminMixin


class AdminService(
    AdminCommonMixin,
    StudentAdminMixin,
    ResultAdminMixin,
    BacklogAdminMixin,
    AuditAdminMixin,
):
    def __init__(
        self, student_repository: StudentRepository, result_repository: ResultRepository
    ) -> None:
        self.students = student_repository
        self.results = result_repository
