"""Davomat — talab 7 dagi acceptance ro'yxati."""

from datetime import timedelta

from httpx import AsyncClient

from app.core.clock import local_today
from tests.conftest import add_student, approved_teacher, create_group


async def _group_with_students(client: AsyncClient, headers: dict, count: int = 3):
    group = await create_group(client, headers)
    ids = []
    for index in range(count):
        created = await add_student(
            client,
            headers,
            group["id"],
            first_name=f"O'quvchi {index}",
            phone=f"+99890000{index}",
        )
        ids.append(created["student"]["student"]["id"])
    return group, ids


async def test_everyone_is_present_by_default(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group, student_ids = await _group_with_students(client, headers)

    screen = await client.get(f"/groups/{group['id']}/attendance", headers=headers)
    body = screen.json()
    assert body["is_saved"] is False
    assert body["present_count"] == 3
    assert all(s["status"] == "present" for s in body["students"])


async def test_only_absentees_are_sent(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group, student_ids = await _group_with_students(client, headers)

    saved = await client.put(
        f"/groups/{group['id']}/attendance",
        json={"records": [{"student_id": student_ids[0], "status": "absent"}]},
        headers=headers,
    )
    body = saved.json()
    assert body["is_saved"] is True
    assert body["absent_count"] == 1
    assert body["present_count"] == 2


async def test_saving_twice_updates_the_same_session(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group, student_ids = await _group_with_students(client, headers)

    first = await client.put(
        f"/groups/{group['id']}/attendance",
        json={"records": [{"student_id": student_ids[0], "status": "absent"}]},
        headers=headers,
    )
    # Xato belgilangan — tuzatamiz.
    second = await client.put(
        f"/groups/{group['id']}/attendance",
        json={"records": [{"student_id": student_ids[1], "status": "absent"}]},
        headers=headers,
    )

    assert first.json()["session_id"] == second.json()["session_id"]
    statuses = {s["student_id"]: s["status"] for s in second.json()["students"]}
    assert statuses[student_ids[0]] == "present"
    assert statuses[student_ids[1]] == "absent"


async def test_past_date_can_be_edited_future_cannot(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group, student_ids = await _group_with_students(client, headers)

    yesterday = (local_today() - timedelta(days=1)).isoformat()
    past = await client.put(
        f"/groups/{group['id']}/attendance",
        json={
            "session_date": yesterday,
            "records": [{"student_id": student_ids[0], "status": "absent"}],
        },
        headers=headers,
    )
    assert past.status_code == 200
    assert past.json()["session_date"] == yesterday

    tomorrow = (local_today() + timedelta(days=1)).isoformat()
    future = await client.put(
        f"/groups/{group['id']}/attendance",
        json={"session_date": tomorrow, "records": []},
        headers=headers,
    )
    assert future.status_code == 422
    assert "Kelajak" in future.json()["detail"]


async def test_archived_group_is_read_only(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group, _ = await _group_with_students(client, headers, count=1)
    await client.post(f"/groups/{group['id']}/archive", headers=headers)

    blocked = await client.put(
        f"/groups/{group['id']}/attendance", json={"records": []}, headers=headers
    )
    assert blocked.status_code == 409

    readable = await client.get(f"/groups/{group['id']}/attendance", headers=headers)
    assert readable.status_code == 200
    assert readable.json()["is_editable"] is False


async def test_monthly_matrix_and_student_summary(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group, student_ids = await _group_with_students(client, headers, count=2)
    today = local_today()

    for offset in range(3):
        day = today - timedelta(days=offset)
        records = [{"student_id": student_ids[0], "status": "absent"}] if offset else []
        response = await client.put(
            f"/groups/{group['id']}/attendance",
            json={"session_date": day.isoformat(), "records": records},
            headers=headers,
        )
        assert response.status_code == 200

    monthly = await client.get(
        f"/groups/{group['id']}/attendance/monthly",
        params={"year": today.year, "month": today.month},
        headers=headers,
    )
    assert monthly.status_code == 200
    rows = {row["student_id"]: row for row in monthly.json()["students"]}
    # Oy chegarasida kunlar o'tgan oyga tushishi mumkin — shu oyga tushganlari
    # tekshiriladi.
    assert rows[student_ids[1]]["absent_count"] == 0

    summary = await client.get(
        f"/students/{student_ids[0]}/attendance", headers=headers
    )
    group_summary = summary.json()["groups"][0]
    assert group_summary["absent_count"] == 2
    assert group_summary["total_sessions"] == 3
    assert group_summary["attendance_rate"] == 33.3
