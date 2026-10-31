from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import Header, Request

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError, UnauthorizedError
from app.services.admin import AdminService
from app.services.analytics import AnalyticsService
from app.services.students import StudentService


def get_student_service(request: Request) -> StudentService:
    return request.app.state.student_service


def get_analytics_service(request: Request) -> AnalyticsService:
    return request.app.state.analytics_service


def get_admin_service(request: Request) -> AdminService:
    return request.app.state.admin_service


def require_admin(
    x_admin_key: Annotated[str | None, Header(alias="X-Admin-Key")] = None,
) -> None:
    expected = get_settings().admin_access_key
    if not expected:
        raise ServiceUnavailableError("Admin access is not configured.")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, expected):
        raise UnauthorizedError("A valid admin passcode is required.")
