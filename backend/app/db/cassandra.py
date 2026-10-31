from __future__ import annotations

import time

from cassandra.cluster import Cluster, Session
from cassandra.policies import DCAwareRoundRobinPolicy

from app.core.config import Settings


class CassandraConnection:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.cluster = Cluster(
            [settings.cassandra_host],
            port=settings.cassandra_port,
            connect_timeout=settings.cassandra_timeout_seconds,
            control_connection_timeout=settings.cassandra_timeout_seconds,
            load_balancing_policy=DCAwareRoundRobinPolicy(local_dc="datacenter1"),
            schema_metadata_enabled=True,
        )
        self.session: Session = self.cluster.connect(settings.cassandra_keyspace)
        self.session.default_timeout = settings.cassandra_timeout_seconds

    def ping(self) -> float:
        started = time.perf_counter()
        self.session.execute("SELECT release_version FROM system.local").one()
        return round((time.perf_counter() - started) * 1000, 2)

    def close(self) -> None:
        self.cluster.shutdown()
