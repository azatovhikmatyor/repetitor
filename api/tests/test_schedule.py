"""Guruh jadvali: moslashuvchan slotlar va versiyalangan tarix."""

from datetime import date, timedelta

from httpx import AsyncClient

from app.core.clock import local_today
from tests.conftest import add_student, approved_teacher, create_group


async def _setup(client: AsyncClient, admin_headers: dict):
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    return headers, group


async def test_schedule_allows_several_lessons_a_day_at_different_times(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group = await _setup(client, admin_headers)

    response = await client.put(
        f"/groups/{group['id']}/schedule",
        json={
            "slots": [
                {"weekday": 0, "start_time": "08:00", "end_time": "09:30"},
                # Bir kunda ikkinchi dars — boshqa vaqtda.
                {"weekday": 0, "start_time": "18:00"},
                # Boshqa kun, boshqa soat.
                {"weekday": 3, "start_time": "15:00"},
            ]
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    current = response.json()["current"]
    assert len(current["slots"]) == 3
    assert current["display"] == "Du 08:00 · Pay 15:00 · Du 18:00"

    # Guruh kartasidagi matn ham shu jadvaldan hosil bo'ladi.
    group_out = (await client.get(f"/groups/{group['id']}", headers=headers)).json()
    assert group_out["schedule"] == current["display"]


async def test_same_weekday_and_time_twice_is_rejected(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group = await _setup(client, admin_headers)

    response = await client.put(
        f"/groups/{group['id']}/schedule",
        json={
            "slots": [
                {"weekday": 1, "start_time": "10:00"},
                {"weekday": 1, "start_time": "10:00"},
            ]
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert "ikki marta" in response.json()["detail"]


async def test_changing_schedule_does_not_rewrite_the_past(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Eng muhim qoida: yangi jadval o'tgan oyning rejasini o'zgartirmaydi."""
    headers, group = await _setup(client, admin_headers)
    today = local_today()
    switch_day = today.replace(day=1)  # shu oyning boshi

    # Eski jadval — dushanba 08:00, o'tgan oydan beri.
    old_start = (switch_day - timedelta(days=1)).replace(day=1)
    await client.put(
        f"/groups/{group['id']}/schedule",
        json={
            "effective_from": old_start.isoformat(),
            "slots": [{"weekday": 0, "start_time": "08:00"}],
        },
        headers=headers,
    )

    # Yangi jadval — shu oydan payshanba 15:00.
    await client.put(
        f"/groups/{group['id']}/schedule",
        json={
            "effective_from": switch_day.isoformat(),
            "slots": [{"weekday": 3, "start_time": "15:00"}],
        },
        headers=headers,
    )

    schedule = (
        await client.get(f"/groups/{group['id']}/schedule", headers=headers)
    ).json()
    assert len(schedule["history"]) == 2
    old, new = schedule["history"][1], schedule["history"][0]
    assert old["effective_to"] == (switch_day - timedelta(days=1)).isoformat()
    assert new["is_current"] is True
    assert old["is_current"] is False

    # O'tgan oydagi darslar hamon dushanba 08:00 da.
    previous = await client.get(
        f"/groups/{group['id']}/schedule/lessons",
        params={"year": old_start.year, "month": old_start.month},
        headers=headers,
    )
    lessons = previous.json()
    assert lessons, "o'tgan oyda dars bo'lishi kerak"
    assert {item["start_time"] for item in lessons} == {"08:00:00"}
    weekdays = {date.fromisoformat(item["lesson_date"]).weekday() for item in lessons}
    assert weekdays == {0}

    # Shu oyniki esa payshanba 15:00.
    current = await client.get(
        f"/groups/{group['id']}/schedule/lessons",
        params={"year": switch_day.year, "month": switch_day.month},
        headers=headers,
    )
    assert {item["start_time"] for item in current.json()} == {"15:00:00"}


async def test_attendance_is_kept_per_lesson_not_per_day(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group = await _setup(client, admin_headers)
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

    day = await client.get(f"/groups/{group['id']}/attendance", headers=headers)
    body = day.json()
    assert [lesson["start_time"] for lesson in body["day_lessons"]] == [
        "08:00:00",
        "18:00:00",
    ]
    # Ko'rsatilmasa — kunning birinchi darsi.
    assert body["start_time"] == "08:00:00"

    student_id = body["students"][0]["student_id"]

    # Ertalabki darsda kelmagan, kechqurungisida kelgan.
    await client.put(
        f"/groups/{group['id']}/attendance",
        json={
            "session_date": today.isoformat(),
            "start_time": "08:00",
            "records": [{"student_id": student_id, "status": "absent"}],
        },
        headers=headers,
    )
    await client.put(
        f"/groups/{group['id']}/attendance",
        json={
            "session_date": today.isoformat(),
            "start_time": "18:00",
            "records": [],
        },
        headers=headers,
    )

    morning = (
        await client.get(
            f"/groups/{group['id']}/attendance",
            params={"date": today.isoformat(), "start_time": "08:00"},
            headers=headers,
        )
    ).json()
    evening = (
        await client.get(
            f"/groups/{group['id']}/attendance",
            params={"date": today.isoformat(), "start_time": "18:00"},
            headers=headers,
        )
    ).json()

    assert morning["students"][0]["status"] == "absent"
    assert evening["students"][0]["status"] == "present"
    assert morning["session_id"] != evening["session_id"]


async def test_monthly_grid_has_a_column_per_lesson(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group = await _setup(client, admin_headers)
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

    monthly = (
        await client.get(
            f"/groups/{group['id']}/attendance/monthly",
            params={"year": today.year, "month": today.month},
            headers=headers,
        )
    ).json()

    keys = [column["key"] for column in monthly["columns"]]
    assert f"{today.isoformat()} 08:00" in keys
    # Davomat kiritilmagan dars ham ustun bo'lib turadi — o'tkazilmagani
    # ko'rinib tursin.
    assert f"{today.isoformat()} 18:00" in keys

    saved = {column["key"]: column["is_saved"] for column in monthly["columns"]}
    assert saved[f"{today.isoformat()} 08:00"] is True
    assert saved[f"{today.isoformat()} 18:00"] is False


async def test_lessons_before_the_first_version_are_empty(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Jadval kiritilmagan guruhda rejadagi dars bo'lmaydi."""
    headers, group = await _setup(client, admin_headers)
    today = local_today()

    lessons = await client.get(
        f"/groups/{group['id']}/schedule/lessons",
        params={"year": today.year, "month": today.month},
        headers=headers,
    )
    assert lessons.json() == []

    # Davomat baribir kiritiladi — vaqtsiz "ad-hoc" dars sifatida.
    saved = await client.put(
        f"/groups/{group['id']}/attendance",
        json={"session_date": today.isoformat()},
        headers=headers,
    )
    assert saved.status_code == 200
    assert saved.json()["start_time"] is None
