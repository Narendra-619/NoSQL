from __future__ import annotations

import time

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import Settings


class MongoConnection:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = MongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=settings.mongo_timeout_ms,
            connectTimeoutMS=settings.mongo_timeout_ms,
            socketTimeoutMS=settings.mongo_timeout_ms,
            appname="student-academic-system",
        )
        self.database: Database = self.client[settings.mongodb_database]

    def ping(self) -> float:
        started = time.perf_counter()
        self.client.admin.command("ping")
        return round((time.perf_counter() - started) * 1000, 2)

    def close(self) -> None:
        self.client.close()
