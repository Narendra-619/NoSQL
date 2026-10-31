from __future__ import annotations

from typing import Any

from pymongo import ReplaceOne
from pymongo.database import Database

from app.domain.academics import SEMESTERS, round2


class StudentRepository:
    def __init__(self, database: Database) -> None:
        self.db = database
        self.students = database.students
        self.summaries = database.student_semester_summaries
        self.departments = database.departments
        self.subjects = database.subjects
        self.audit = database.admin_audit_log

    def get_department(self, code: str) -> dict | None:
        return self.departments.find_one({"_id": code})

    def list_departments(self, semester: int) -> list[dict]:
        departments = list(self.departments.find().sort("_id", 1))
        counts = {
            item["_id"]: item["count"]
            for item in self.summaries.aggregate(
                [
                    {"$match": {"semester": semester}},
                    {"$group": {"_id": "$department_code", "count": {"$sum": 1}}},
                ]
            )
        }
        for department in departments:
            department["student_count"] = counts.get(department["_id"], 0)
        return departments

    def list_subjects(self, department_code: str, semester: int) -> list[dict]:
        return list(
            self.subjects.find(
                {"department_code": department_code, "semester": semester}
            ).sort("code", 1)
        )

    def get_subject(self, department_code: str, semester: int, code: str) -> dict | None:
        return self.subjects.find_one(
            {"department_code": department_code, "semester": semester, "code": code}
        )

    def get_student(self, student_id: str) -> dict | None:
        return self.students.find_one({"_id": student_id})

    def get_summaries(self, student_id: str) -> list[dict]:
        return list(
            self.summaries.find({"student_id": student_id}).sort("semester", 1)
        )

    def get_summary(self, student_id: str, semester: int) -> dict | None:
        return self.summaries.find_one(
            {"student_id": student_id, "semester": semester}
        )

    def list_students(
        self,
        *,
        semester: int,
        department_code: str | None,
        cgpa_min: float | None,
        cgpa_max: float | None,
        backlog_min: int | None,
        backlog_max: int | None,
        result_status: str | None,
        sort: str,
        page: int,
        page_size: int,
    ) -> tuple[list[dict], int]:
        match: dict[str, Any] = {"semester": semester}
        if department_code:
            match["department_code"] = department_code
        if result_status:
            match["result_status"] = result_status
        cgpa_filter: dict[str, float] = {}
        if cgpa_min is not None:
            cgpa_filter["$gte"] = cgpa_min
        if cgpa_max is not None:
            cgpa_filter["$lte"] = cgpa_max
        if cgpa_filter:
            match["cgpa"] = cgpa_filter
        backlog_filter: dict[str, int] = {}
        if backlog_min is not None:
            backlog_filter["$gte"] = backlog_min
        if backlog_max is not None:
            backlog_filter["$lte"] = backlog_max
        if backlog_filter:
            match["backlog_count"] = backlog_filter

        sorts = {
            "roll_asc": [("roll_number", 1)],
            "cgpa_desc": [("cgpa", -1), ("roll_number", 1)],
            "cgpa_asc": [("cgpa", 1), ("roll_number", 1)],
            "backlogs_desc": [("backlog_count", -1), ("roll_number", 1)],
        }
        pipeline: list[dict[str, Any]] = [
            {"$match": match},
            {"$sort": dict(sorts[sort])},
            {
                "$facet": {
                    "metadata": [{"$count": "total"}],
                    "items": [
                        {"$skip": (page - 1) * page_size},
                        {"$limit": page_size},
                    ],
                }
            },
        ]
        result = list(self.summaries.aggregate(pipeline))[0]
        metadata = result["metadata"]
        total = metadata[0]["total"] if metadata else 0
        items = result["items"]
        student_ids = [item["student_id"] for item in items]
        student_map = {
            doc["_id"]: doc
            for doc in self.students.find({"_id": {"$in": student_ids}})
        }
        department_map = {
            doc["_id"]: doc["name"] for doc in self.departments.find().sort("_id", 1)
        }
        merged = []
        for summary in items:
            student = student_map.get(summary["student_id"])
            if not student:
                continue
            merged.append(
                {
                    "student_id": student["_id"],
                    "roll_number": student["roll_number"],
                    "name": student["name"],
                    "department_code": student["department_code"],
                    "department_name": department_map.get(student["department_code"], ""),
                    "section": student["section"],
                    "semester": summary["semester"],
                    "sgpa": summary["sgpa"],
                    "cgpa": summary["cgpa"],
                    "backlog_count": summary["backlog_count"],
                    "result_status": summary["result_status"],
                }
            )
        return merged, total

    def overview(self, semester: int, department_code: str | None) -> dict:
        match: dict[str, Any] = {"semester": semester}
        if department_code:
            match["department_code"] = department_code
        result = list(
            self.summaries.aggregate(
                [
                    {"$match": match},
                    {
                        "$group": {
                            "_id": None,
                            "student_count": {"$sum": 1},
                            "average_cgpa": {"$avg": "$cgpa"},
                            "pass_count": {
                                "$sum": {
                                    "$cond": [
                                        {"$eq": ["$result_status", "PASS"]},
                                        1,
                                        0,
                                    ]
                                }
                            },
                            "students_with_backlogs": {
                                "$sum": {
                                    "$cond": [{"$gt": ["$backlog_count", 0]}, 1, 0]
                                }
                            },
                            "average_backlogs": {"$avg": "$backlog_count"},
                        }
                    },
                ]
            )
        )
        if not result:
            return {
                "student_count": 0,
                "pass_count": 0,
                "fail_count": 0,
                "average_cgpa": 0.0,
                "pass_percentage": 0.0,
                "students_with_backlogs": 0,
                "average_backlogs": 0.0,
            }
        item = result[0]
        count = item["student_count"]
        pass_count = item["pass_count"] or 0
        return {
            "student_count": count,
            "pass_count": pass_count,
            "fail_count": count - pass_count,
            "average_cgpa": round2(item["average_cgpa"] or 0.0),
            "pass_percentage": round2(pass_count / count * 100) if count else 0.0,
            "students_with_backlogs": item["students_with_backlogs"] or 0,
            "average_backlogs": round2(item["average_backlogs"] or 0.0),
        }

    def department_comparison(self, semester: int) -> list[dict]:
        grouped = {
            item["_id"]: item
            for item in self.summaries.aggregate(
                [
                    {"$match": {"semester": semester}},
                    {
                        "$group": {
                            "_id": "$department_code",
                            "student_count": {"$sum": 1},
                            "average_cgpa": {"$avg": "$cgpa"},
                            "pass_count": {
                                "$sum": {
                                    "$cond": [
                                        {"$eq": ["$result_status", "PASS"]},
                                        1,
                                        0,
                                    ]
                                }
                            },
                            "students_with_backlogs": {
                                "$sum": {
                                    "$cond": [{"$gt": ["$backlog_count", 0]}, 1, 0]
                                }
                            },
                        }
                    },
                ]
            )
        }
        departments = list(self.departments.find().sort("_id", 1))
        comparison = []
        for department in departments:
            item = grouped.get(
                department["_id"],
                {
                    "student_count": 0,
                    "average_cgpa": 0.0,
                    "pass_count": 0,
                    "students_with_backlogs": 0,
                },
            )
            count = item["student_count"]
            comparison.append(
                {
                    "department_code": department["_id"],
                    "department_name": department["name"],
                    "student_count": count,
                    "average_cgpa": round2(item["average_cgpa"] or 0.0),
                    "pass_percentage": round2((item["pass_count"] or 0) / count * 100) if count else 0.0,
                    "students_with_backlogs": item["students_with_backlogs"] or 0,
                    "backlog_rate": round2((item["students_with_backlogs"] or 0) / count * 100) if count else 0.0,
                }
            )
        return comparison

    def trends(self, department_code: str) -> list[dict]:
        grouped = {
            item["_id"]: item
            for item in self.summaries.aggregate(
                [
                    {"$match": {"department_code": department_code}},
                    {
                        "$group": {
                            "_id": "$semester",
                            "student_count": {"$sum": 1},
                            "average_cgpa": {"$avg": "$cgpa"},
                            "pass_count": {
                                "$sum": {
                                    "$cond": [
                                        {"$eq": ["$result_status", "PASS"]},
                                        1,
                                        0,
                                    ]
                                }
                            },
                            "students_with_backlogs": {
                                "$sum": {
                                    "$cond": [{"$gt": ["$backlog_count", 0]}, 1, 0]
                                }
                            },
                        }
                    },
                    {"$sort": {"_id": 1}},
                ]
            )
        }
        trends = []
        for semester in SEMESTERS:
            item = grouped.get(
                semester,
                {
                    "student_count": 0,
                    "average_cgpa": 0.0,
                    "pass_count": 0,
                    "students_with_backlogs": 0,
                },
            )
            count = item["student_count"]
            trends.append(
                {
                    "semester": semester,
                    "student_count": count,
                    "average_cgpa": round2(item["average_cgpa"] or 0.0),
                    "pass_percentage": round2((item["pass_count"] or 0) / count * 100) if count else 0.0,
                    "students_with_backlogs": item["students_with_backlogs"] or 0,
                }
            )
        return trends

    def get_student_by_roll(self, roll_number: str) -> dict | None:
        return self.students.find_one({"roll_number": roll_number})

    def list_students_by_department(self, department_code: str) -> list[dict]:
        return list(
            self.students.find({"department_code": department_code}).sort(
                "roll_number", 1
            )
        )

    def summaries_for_semester(
        self, student_ids: list[str], semester: int
    ) -> dict[str, dict]:
        if not student_ids:
            return {}
        return {
            item["student_id"]: item
            for item in self.summaries.find(
                {"student_id": {"$in": student_ids}, "semester": semester}
            )
        }

    def insert_student(self, student: dict) -> None:
        self.students.insert_one(student)

    def update_student(self, student_id: str, fields: dict) -> dict | None:
        if fields:
            self.students.update_one({"_id": student_id}, {"$set": fields})
        return self.get_student(student_id)

    def delete_student(self, student_id: str) -> None:
        self.students.delete_one({"_id": student_id})

    def upsert_summaries(self, summaries: list[dict]) -> None:
        if not summaries:
            return
        self.summaries.bulk_write(
            [ReplaceOne({"_id": item["_id"]}, item, upsert=True) for item in summaries],
            ordered=False,
        )

    def delete_summaries(self, student_id: str) -> None:
        self.summaries.delete_many({"student_id": student_id})

    def update_summary_identity(
        self, student_id: str, *, name: str | None = None, section: str | None = None
    ) -> None:
        fields = {}
        if name is not None:
            fields["student_name"] = name
        if section is not None:
            fields["section"] = section
        if fields:
            self.summaries.update_many({"student_id": student_id}, {"$set": fields})

    def add_audit(self, entry: dict) -> None:
        self.audit.insert_one(entry)

    def list_audit(self, limit: int = 50) -> list[dict]:
        return list(self.audit.find().sort("created_at", -1).limit(limit))
