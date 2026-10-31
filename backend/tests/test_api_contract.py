import os
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.domain.academics import student_id_for
from app.main import app


@pytest.fixture(scope="module")
def client():
    if os.getenv("RUN_INTEGRATION") != "1":
        pytest.skip("Set RUN_INTEGRATION=1 after seeding both databases.")
    with TestClient(app) as test_client:
        health = test_client.get("/api/health")
        if health.status_code != 200:
            pytest.skip(f"Databases are not both healthy: {health.json()}")
        yield test_client


pytestmark = pytest.mark.integration


def test_health_reports_both_databases(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["services"]["mongodb"]["ok"] is True
    assert body["services"]["cassandra"]["ok"] is True
    datetime.fromisoformat(body["timestamp"])


def test_departments_and_subjects(client):
    response = client.get("/api/departments", params={"semester": 4})
    assert response.status_code == 200
    departments = response.json()
    assert len(departments) == 5
    assert {item["code"] for item in departments} == {"CSE", "ECE", "EEE", "MECH", "CIVIL"}
    assert {item["student_count"] for item in departments} == {100}

    subjects = client.get("/api/departments/CSE/subjects", params={"semester": 4}).json()
    assert [item["code"] for item in subjects] == [
        "CS401",
        "CS402",
        "CS403",
        "CS404",
        "CS405",
    ]


def test_student_register_pagination_and_filters(client):
    response = client.get("/api/students", params={"semester": 4})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 500
    assert body["page"] == 1
    assert body["page_size"] == 25
    assert body["total_pages"] == 20
    assert len(body["items"]) == 25

    cse = client.get("/api/students", params={"semester": 4, "department": "CSE"}).json()
    assert cse["total"] == 100
    assert all(item["department_code"] == "CSE" for item in cse["items"])

    ordered = client.get(
        "/api/students",
        params={"semester": 4, "department": "CSE", "sort": "cgpa_desc"},
    ).json()["items"]
    assert ordered[0]["cgpa"] >= ordered[-1]["cgpa"]


def test_student_profile_results_and_comparison(client):
    student_id = student_id_for("24CSE001")
    profile = client.get(f"/api/students/{student_id}")
    assert profile.status_code == 200
    body = profile.json()
    assert body["student"]["roll_number"] == "24CSE001"
    assert len(body["summaries"]) == 4
    assert body["overall_result_status"] in {"PASS", "FAIL"}

    results = client.get(f"/api/students/{student_id}/results")
    assert results.status_code == 200
    semesters = results.json()["semesters"]
    assert [item["semester"] for item in semesters] == [1, 2, 3, 4]
    assert all(len(item["subjects"]) == 5 for item in semesters)

    comparison = client.get(f"/api/students/{student_id}/comparison")
    assert comparison.status_code == 200
    assert comparison.json()["delta"]["credits_earned"] == (
        semesters[-1]["credits_earned"] - semesters[0]["credits_earned"]
    )


def test_failure_list_matches_cassandra(client):
    response = client.get(
        "/api/results/failures",
        params={"department": "CSE", "semester": 4, "subject": "CS401"},
    )
    assert response.status_code == 200
    body = response.json()
    session = client.app.state.cassandra.session
    row = session.execute(
        """
        SELECT COUNT(*) FROM results_by_department_semester
        WHERE department_code = %s AND semester = %s AND subject_code = %s
          AND result_status = 'FAIL'
        """,
        ("CSE", 4, "CS401"),
    ).one()
    assert body["count"] == row[0]
    assert all(item["subject_code"] == "CS401" for item in body["items"])


def test_analytics_are_internally_consistent(client):
    overview = client.get(
        "/api/analytics/overview", params={"semester": 4, "department": "CSE"}
    ).json()
    assert overview["student_count"] == 100
    assert overview["pass_count"] + overview["fail_count"] == 100
    assert 0 <= overview["pass_percentage"] <= 100

    comparison = client.get("/api/analytics/departments", params={"semester": 4}).json()
    assert sum(item["student_count"] for item in comparison["departments"]) == 500

    subjects = client.get(
        "/api/analytics/subjects", params={"department": "CSE", "semester": 4}
    ).json()["subjects"]
    assert len(subjects) == 5
    assert all(item["appeared"] == 100 for item in subjects)
    assert all(item["passed"] + item["failed"] == 100 for item in subjects)

    trends = client.get("/api/analytics/trends", params={"department": "CSE"}).json()
    assert [item["semester"] for item in trends["semesters"]] == [1, 2, 3, 4]


def test_unknown_records_return_404(client):
    missing = client.get(f"/api/students/{student_id_for('UNKNOWN')}")
    assert missing.status_code == 404
    department = client.get("/api/departments/NOPE/subjects")
    assert department.status_code == 404
