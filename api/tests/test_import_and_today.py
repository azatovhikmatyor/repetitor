"""Ro'yxatni bir yo'la qo'shish va bosh sahifadagi bugungi darslar."""

from httpx import AsyncClient

from app.core.clock import local_today
from tests.conftest import add_student, approved_teacher, create_group


async def test_import_adds_the_whole_list(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=400_000)

    response = await client.post(
        f"/groups/{group['id']}/students/import",
        json={
            "rows": [
                {
                    "first_name": "Aziza",
                    "last_name": "Rahimova",
                    "phone": "+998901112233",
                },
                {"first_name": "Bekzod", "phone": "+998901112244", "custom_fee": 0},
                # Telefonsiz qator — o'quvchi tizimga kira olmaydi.
                {"first_name": "Dilnoza"},
            ]
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["added"] == 2
    assert body["failed"] == 1
    assert "Telefon" in body["rows"][2]["error"]
    # Har bir yangi hisob uchun vaqtinchalik parol qaytadi.
    assert all(row["temporary_password"] for row in body["rows"][:2])

    students = (
        await client.get(f"/groups/{group['id']}/students", headers=headers)
    ).json()
    assert len(students) == 2
    free = next(item for item in students if item["student"]["first_name"] == "Bekzod")
    assert free["monthly_fee"] == 0


async def test_one_bad_row_does_not_stop_the_rest(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)

    await client.post(
        f"/groups/{group['id']}/students/import",
        json={"rows": [{"first_name": "Aziza", "phone": "+998901112233"}]},
        headers=headers,
    )

    response = await client.post(
        f"/groups/{group['id']}/students/import",
        json={
            "rows": [
                # Takroriy telefon — o'tmaydi.
                {"first_name": "Nusxa", "phone": "+998901112233"},
                {"first_name": "Yangi", "phone": "+998901112255"},
            ]
        },
        headers=headers,
    )
    body = response.json()

    assert body["added"] == 1
    assert body["failed"] == 1
    assert body["rows"][0]["error"]
    assert body["rows"][1]["error"] is None

    students = (
        await client.get(f"/groups/{group['id']}/students", headers=headers)
    ).json()
    assert {item["student"]["first_name"] for item in students} == {"Aziza", "Yangi"}


async def test_dashboard_lists_todays_lessons(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, name="IELTS")
    await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    today = local_today()

    await client.put(
        f"/groups/{group['id']}/schedule",
        json={
            "slots": [
                {"weekday": today.weekday(), "start_time": "08:00"},
                {"weekday": today.weekday(), "start_time": "18:00"},
            ]
        },
        headers=headers,
    )
    await client.put(
        f"/groups/{group['id']}/attendance",
        json={"session_date": today.isoformat(), "start_time": "08:00"},
        headers=headers,
    )

    dashboard = (await client.get("/reports/dashboard", headers=headers)).json()
    lessons = dashboard["today_lessons"]

    assert [item["start_time"] for item in lessons] == ["08:00:00", "18:00:00"]
    assert lessons[0]["is_saved"] is True
    assert lessons[1]["is_saved"] is False
    assert lessons[0]["group_name"] == "IELTS"


async def test_today_lessons_are_empty_without_a_schedule(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    await create_group(client, headers)

    dashboard = (await client.get("/reports/dashboard", headers=headers)).json()
    assert dashboard["today_lessons"] == []
