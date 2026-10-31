from __future__ import annotations

from contextlib import asynccontextmanager

from cassandra import OperationTimedOut
from cassandra.cluster import NoHostAvailable
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

import app  # noqa: F401
from app.api import admin, health, routes
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.cassandra import CassandraConnection
from app.db.mongo import MongoConnection
from app.repositories.results import ResultRepository
from app.repositories.students import StudentRepository
from app.services.admin import AdminService
from app.services.analytics import AnalyticsService
from app.services.students import StudentService


@asynccontextmanager
async def lifespan(application: FastAPI):
    settings = get_settings()
    mongo = MongoConnection(settings)
    cassandra = CassandraConnection(settings)
    student_repository = StudentRepository(mongo.database)
    result_repository = ResultRepository(cassandra.session)
    application.state.settings = settings
    application.state.mongo = mongo
    application.state.cassandra = cassandra
    application.state.student_service = StudentService(
        student_repository, result_repository
    )
    application.state.analytics_service = AnalyticsService(student_repository)
    application.state.admin_service = AdminService(
        student_repository, result_repository
    )
    try:
        yield
    finally:
        mongo.close()
        cassandra.close()


app = FastAPI(
    title="Student Information and Academic Performance Management System",
    version="1.1.0",
    description=(
        "Academic overview and administration API for principal, branch, and admin views. "
        "Student profiles are stored in MongoDB; academic results are stored in Cassandra."
    ),
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(PyMongoError)
async def mongo_error_handler(request: Request, exc: PyMongoError):
    return JSONResponse(
        status_code=503,
        content={"detail": "A required database is temporarily unavailable."},
    )


@app.exception_handler(NoHostAvailable)
async def cassandra_error_handler(request: Request, exc: NoHostAvailable):
    return JSONResponse(
        status_code=503,
        content={"detail": "A required database is temporarily unavailable."},
    )


@app.exception_handler(OperationTimedOut)
async def cassandra_timeout_handler(request: Request, exc: OperationTimedOut):
    return JSONResponse(
        status_code=503,
        content={"detail": "A required database is temporarily unavailable."},
    )


app.include_router(health.router)
app.include_router(routes.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {
        "name": "Student Information and Academic Performance Management System",
        "docs": "/docs",
        "health": "/api/health",
    }
