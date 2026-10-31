from __future__ import annotations

from uuid import uuid4

from app.domain.academics import timestamp_now


class AuditAdminMixin:
    def audit_log(self, limit: int = 50) -> dict:
        entries = self.students.list_audit(limit)
        return {
            "items": [
                {
                    "id": item["_id"],
                    "action": item.get("action"),
                    "entity_type": item.get("entity_type"),
                    "entity_id": item.get("entity_id"),
                    "roll_number": item.get("roll_number"),
                    "summary": item.get("summary"),
                    "record_source": item.get("record_source"),
                    "created_at": item.get("created_at"),
                    "before": item.get("before"),
                    "after": item.get("after"),
                }
                for item in entries
            ]
        }

    def _audit(
        self,
        *,
        action: str,
        entity_type: str,
        entity_id: str,
        summary: str,
        roll_number: str | None = None,
        record_source: str | None = None,
        before: dict | None = None,
        after: dict | None = None,
    ) -> None:
        entry = {
            "_id": uuid4().hex,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "summary": summary,
            "created_at": timestamp_now(),
        }
        if roll_number:
            entry["roll_number"] = roll_number
        if record_source:
            entry["record_source"] = record_source
        if before is not None:
            entry["before"] = before
        if after is not None:
            entry["after"] = after
        self.students.add_audit(entry)
