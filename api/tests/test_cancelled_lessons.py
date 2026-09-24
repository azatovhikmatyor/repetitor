"""Dars bo'lmagan kun — bayram yoki o'qituvchi kasal."""

from httpx import AsyncClient

from app.core.clock import current_period, local_today
from tests.conftest import add_student, approved_teacher, create_group

YEAR, MONTH = current_period()


async def _setup(client: AsyncClient, admin_headers: dict):
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, name="IELTS")
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    return headers, group, created["student"]["student"]["id"]


async def test_cancelled_lesson_does_not_count_as_absence(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)
    today = local_today()

    response = await client.put(
        f"/groups/{group['id']}/attendance",
        json={
            "session_date": today.isoformat(),
            "is_cancelled": True,
            "note": "Bayram",
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["is_cancelled"] is True
    assert body["present_count"] == 1  # ro'yxat ko'rinadi, lekin yozuv yo'q

    summary = (
        await client.get(f"/students/{student_id}/attendance", headers=headers)
    ).json()
    assert summary["groups"] == []
    assert summary["recent"] == []

    report = (
        await client.get(
            "/reports/attendance",
            params={"year": YEAR, "month": MONTH},
            headers=headers,
        )
    ).json()
    assert report["groups"] == []
    assert report["frequent_absentees"] == []


async def test_cancelling_removes_previously_saved_marks(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)
    today = local_today()

    await client.put(
        f"/groups/{group['id']}/attendance",
        json={
            "session_date": today.isoformat(),
            "records": [{"student_id": student_id, "status": "absent"}],
        },
        headers=headers,
    )
    await client.put(
        f"/groups/{group['id']}/attendance",
        json={"session_date": today.isoformat(), "is_cancelled": True},
        headers=headers,
    )

    summary = (
        await client.get(f"/students/{student_id}/attendance", headers=headers)
    ).json()
    assert summary["groups"] == []


async def test_cancellation_can_be_undone(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)
    today = local_today()

    await client.put(
        f"/groups/{group['id']}/attendance",
        json={"session_date": today.isoformat(), "is_cancelled": True},
        headers=headers,
    )
    restored = await client.put(
        f"/groups/{group['id']}/attendance",
        json={"session_date": today.isoformat(), "is_cancelled": False, "records": []},
        headers=headers,
    )

    assert restored.json()["is_cancelled"] is False
    summary = (
        await client.get(f"/students/{student_id}/attendance", headers=headers)
    ).json()
    assert summary["groups"][0]["attendance_rate"] == 100.0


async def test_monthly_grid_marks_the_cancelled_lesson(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, _ = await _setup(client, admin_headers)
    today = local_today()

    await client.put(
        f"/groups/{group['id']}/attendance",
        json={"session_date": today.isoformat(), "is_cancelled": True},
        headers=headers,
    )

    monthly = (
        await client.get(
            f"/groups/{group['id']}/attendance/monthly",
            params={"year": today.year, "month": today.month},
            headers=headers,
        )
    ).json()

    column = next(
        item for item in monthly["columns"] if item["lesson_date"] == today.isoformat()
    )
    assert column["is_cancelled"] is True


async def test_student_history_lists_lessons_by_date(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)
    today = local_today()

    await client.put(
        f"/groups/{group['id']}/attendance",
        json={
            "session_date": today.isoformat(),
            "records": [{"student_id": student_id, "status": "absent"}],
        },
        headers=headers,
    )

    summary = (
        await client.get(f"/students/{student_id}/attendance", headers=headers)
    ).json()
    entry = summary["recent"][0]
    assert entry["lesson_date"] == today.isoformat()
    assert entry["status"] == "absent"
    assert entry["group_name"] == "IELTS"
