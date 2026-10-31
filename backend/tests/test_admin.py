import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def client():
    if os.getenv("RUN_INTEGRATION") != "1":
        pytest.skip("Set RUN_INTEGRATION=1 after seeding both databases.")
    settings = get_settings()
    if not settings.admin_access_key:
        pytest.skip("ADMIN_ACCESS_KEY is not configured.")
    with TestClient(app) as test_client:
        health = test_client.get("/api/health")
        if health.status_code != 200:
            pytest.skip(f"Databases are not both healthy: {health.json()}")
        yield test_client


@pytest.fixture(scope="module")
def admin_headers():
    return {"X-Admin-Key": get_settings().admin_access_key}


def test_admin_requires_passcode(client):
    assert client.get("/api/admin/session").status_code == 401
    assert (
        client.get(
            "/api/admin/session", headers={"X-Admin-Key": "definitely-wrong"}
        ).status_code
        == 401
    )


def test_admin_meta_and_simulated_preview(client, admin_headers):
    session = client.get("/api/admin/session", headers=admin_headers)
    assert session.status_code == 200
    assert session.json() == {"ok": True}

    meta = client.get(
        "/api/admin/meta", params={"department": "CSE"}, headers=admin_headers
    )
    assert meta.status_code == 200
    body = meta.json()
    assert body["limits"]["pass_marks"] == 40
    assert len(body["subjects"]) == 20
    assert len(body["grade_bands"]) == 7

    preview = client.post(
        "/api/admin/students/preview",
        headers=admin_headers,
        json={
            "identity": {
                "roll_number": "99CSE989",
                "name": "Preview Candidate",
                "department_code": "CSE",
                "section": "A",
                "admission_year": 2024,
                "current_semester": 4,
                "email": None,
                "status": "ACTIVE",
            },
            "mode": "simulated",
        },
    )
    assert preview.status_code == 200
    preview_body = preview.json()
    assert len(preview_body["semesters"]) == 4
    assert all(len(item["subjects"]) == 5 for item in preview_body["semesters"])
    assert len(preview_body["generation_seed"]) >= 8
    assert preview_body["roll_number_available"] is True

    listing = client.get(
        "/api/admin/students",
        params={"department": "CSE", "semester": 4, "search": "99CSE989"},
        headers=admin_headers,
    )
    assert listing.status_code == 200
    assert listing.json()["total"] == 0


def test_manual_creation_correction_and_delete(client, admin_headers):
    meta = client.get(
        "/api/admin/meta", params={"department": "CSE"}, headers=admin_headers
    ).json()
    by_semester = {}
    for subject in meta["subjects"]:
        by_semester.setdefault(subject["semester"], []).append(subject["code"])

    semesters = []
    for semester in range(1, 5):
        results = []
        for index, code in enumerate(by_semester[semester]):
            if semester == 2 and index == 0:
                results.append(
                    {
                        "subject_code": code,
                        "internal_marks": 18,
                        "external_marks": 20,
                    }
                )
            else:
                results.append(
                    {
                        "subject_code": code,
                        "internal_marks": 22,
                        "external_marks": 45,
                    }
                )
        semesters.append({"semester": semester, "results": results})

    payload = {
        "identity": {
            "roll_number": "99CSE990",
            "name": "Manual Candidate",
            "department_code": "CSE",
            "section": "A",
            "admission_year": 2024,
            "current_semester": 4,
            "email": None,
            "status": "ACTIVE",
        },
        "mode": "manual",
        "semesters": semesters,
    }
    preview = client.post(
        "/api/admin/students/preview", headers=admin_headers, json=payload
    )
    assert preview.status_code == 200
    assert preview.json()["overall_backlog_count"] == 1
    assert preview.json()["roll_number_available"] is True

    created = client.post("/api/admin/students", headers=admin_headers, json=payload)
    assert created.status_code == 201
    body = created.json()
    student_id = body["student"]["student_id"]
    assert body["student"]["record_source"] == "manual"
    assert body["overall_backlog_count"] == 1

    public_profile = client.get(f"/api/students/{student_id}")
    assert public_profile.status_code == 200
    assert len(public_profile.json()["summaries"]) == 4

    assert (
        client.post("/api/admin/students", headers=admin_headers, json=payload).status_code
        == 409
    )

    corrected = client.put(
        f"/api/admin/students/{student_id}/results/2/{by_semester[2][0]}",
        headers=admin_headers,
        json={
            "internal_marks": 25,
            "external_marks": 50,
            "expected_status": "PASS",
        },
    )
    assert corrected.status_code == 200
    corrected_body = corrected.json()
    assert corrected_body["before"]["backlog_count"] == 1
    assert corrected_body["after"]["backlog_count"] == 0
    assert corrected_body["result"]["result_status"] == "PASS"

    record = client.get(
        f"/api/admin/students/{student_id}/record", headers=admin_headers
    )
    assert record.status_code == 200
    semester_two = next(
        item for item in record.json()["semesters"] if item["semester"] == 2
    )
    assert semester_two["backlog_count"] == 0

    updated = client.patch(
        f"/api/admin/students/{student_id}",
        headers=admin_headers,
        json={"name": "Manual Candidate Updated", "section": "B"},
    )
    assert updated.status_code == 200
    assert updated.json()["student"]["name"] == "Manual Candidate Updated"

    refreshed = client.get(f"/api/students/{student_id}").json()
    assert refreshed["student"]["name"] == "Manual Candidate Updated"
    assert refreshed["student"]["section"] == "B"

    deleted = client.delete(
        f"/api/admin/students/{student_id}", headers=admin_headers
    )
    assert deleted.status_code == 200
    assert client.get(f"/api/students/{student_id}").status_code == 404

    audit = client.get("/api/admin/audit", headers=admin_headers).json()["items"]
    actions = {item["action"] for item in audit}
    assert {"student.create", "result.correct", "student.update", "student.delete"} <= actions


def test_backlog_clear_preview_and_apply(client, admin_headers):
    meta = client.get(
        "/api/admin/meta", params={"department": "CSE"}, headers=admin_headers
    ).json()
    by_semester = {}
    for subject in meta["subjects"]:
        by_semester.setdefault(subject["semester"], []).append(subject["code"])

    failures = {(1, by_semester[1][0]), (3, by_semester[3][0])}
    semesters = []
    for semester in range(1, 5):
        results = []
        for code in by_semester[semester]:
            if (semester, code) in failures:
                results.append(
                    {
                        "subject_code": code,
                        "internal_marks": 18,
                        "external_marks": 20,
                    }
                )
            else:
                results.append(
                    {
                        "subject_code": code,
                        "internal_marks": 22,
                        "external_marks": 45,
                    }
                )
        semesters.append({"semester": semester, "results": results})

    created = client.post(
        "/api/admin/students",
        headers=admin_headers,
        json={
            "identity": {
                "roll_number": "99CSE991",
                "name": "Backlog Candidate",
                "department_code": "CSE",
                "section": "A",
                "admission_year": 2024,
                "current_semester": 4,
                "email": None,
                "status": "ACTIVE",
            },
            "mode": "manual",
            "semesters": semesters,
        },
    )
    assert created.status_code == 201
    student_id = created.json()["student"]["student_id"]

    backlogs = client.get(
        f"/api/admin/students/{student_id}/backlogs", headers=admin_headers
    )
    assert backlogs.status_code == 200
    backlog_body = backlogs.json()
    assert backlog_body["count"] == 2
    assert {(item["semester"], item["subject_code"]) for item in backlog_body["items"]} == failures

    payload = {
        "items": [
            {"semester": 1, "subject_code": by_semester[1][0]},
            {
                "semester": 3,
                "subject_code": by_semester[3][0],
                "internal_marks": 25,
                "external_marks": 50,
            },
        ]
    }
    preview = client.post(
        f"/api/admin/students/{student_id}/backlogs/preview",
        headers=admin_headers,
        json=payload,
    )
    assert preview.status_code == 200
    preview_body = preview.json()
    assert preview_body["cleared_count"] == 2
    assert preview_body["before"]["backlog_count"] == 2
    assert preview_body["after"]["backlog_count"] == 0
    assert all(item["result_status"] == "PASS" for item in preview_body["items"])

    cleared = client.post(
        f"/api/admin/students/{student_id}/backlogs/clear",
        headers=admin_headers,
        json=payload,
    )
    assert cleared.status_code == 200
    cleared_body = cleared.json()
    assert cleared_body["cleared"] is True
    assert cleared_body["after"]["backlog_count"] == 0
    assert all(item["backlog_count"] == 0 for item in cleared_body["after_summaries"])

    public_profile = client.get(f"/api/students/{student_id}").json()
    assert all(item["backlog_count"] == 0 for item in public_profile["summaries"])

    audit = client.get("/api/admin/audit", headers=admin_headers).json()["items"]
    assert "result.backlog_clear" in {item["action"] for item in audit}

    deleted = client.delete(
        f"/api/admin/students/{student_id}", headers=admin_headers
    )
    assert deleted.status_code == 200
