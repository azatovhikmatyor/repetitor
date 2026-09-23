"""Hisobot ekranlari — har bir endpoint haqiqatda javob berishi kerak."""

from httpx import AsyncClient

from app.core.clock import current_period, local_today
from tests.conftest import add_student, approved_teacher, create_group

YEAR, MONTH = current_period()


async def _setup(client: AsyncClient, admin_headers: dict):
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, name="IELTS", fee=400_000)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    return headers, group, created["student"]["student"]["id"]


async def test_attendance_report_returns_groups_and_absentees(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Regressiya: `User.full_name` property, uni SQL'da tanlab bo'lmaydi."""
    headers, group, student_id = await _setup(client, admin_headers)

    await client.put(
        f"/groups/{group['id']}/attendance",
        json={
            "session_date": local_today().isoformat(),
            "records": [{"student_id": student_id, "status": "absent"}],
        },
        headers=headers,
    )

    response = await client.get(
        "/reports/attendance", params={"year": YEAR, "month": MONTH}, headers=headers
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert [item["group_name"] for item in body["groups"]] == ["IELTS"]
    assert body["groups"][0]["session_count"] == 1
    assert body["groups"][0]["attendance_rate"] == 0.0

    absentee = body["frequent_absentees"][0]
    assert absentee["full_name"] == "Aziza"
    assert absentee["absent_count"] == 1


async def test_attendance_report_without_a_period_covers_everything(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)
    await client.put(
        f"/groups/{group['id']}/attendance",
        json={"session_date": local_today().isoformat(), "records": []},
        headers=headers,
    )

    response = await client.get("/reports/attendance", headers=headers)
    assert response.status_code == 200
    assert response.json()["groups"][0]["attendance_rate"] == 100.0


async def test_attendance_report_is_empty_but_valid_without_data(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _, _ = await _setup(client, admin_headers)

    body = (
        await client.get(
            "/reports/attendance",
            params={"year": YEAR, "month": MONTH},
            headers=headers,
        )
    ).json()
    assert body == {"groups": [], "frequent_absentees": []}


async def test_every_report_endpoint_answers(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Hisobot sahifasi bir nechta so'rov yuboradi — biri yiqilsa bo'lim
    bo'sh qoladi, shuning uchun hammasi tekshiriladi."""
    headers, _, _ = await _setup(client, admin_headers)

    period = {"year": YEAR, "month": MONTH}
    for path, params in [
        ("/reports/dashboard", None),
        ("/reports/monthly", period),
        ("/reports/revenue-trend", {"months": 6}),
        ("/reports/attendance", period),
        ("/reports/debtors", period),
    ]:
        response = await client.get(path, params=params, headers=headers)
        assert response.status_code == 200, f"{path}: {response.text}"
