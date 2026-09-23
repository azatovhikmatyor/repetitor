"""Alohida narx: chegirma va bepul o'qiydiganlar."""

from httpx import AsyncClient

from app.core.clock import current_period
from tests.conftest import add_student, approved_teacher, create_group

YEAR, MONTH = current_period()


async def _group(client: AsyncClient, admin_headers: dict, fee: int = 400_000):
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=fee)
    return headers, group


async def _add(client: AsyncClient, headers: dict, group_id: int, **kwargs):
    payload = {"first_name": kwargs.pop("first_name"), "phone": kwargs.pop("phone")}
    payload.update(kwargs)
    response = await client.post(
        f"/groups/{group_id}/students", json=payload, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()["student"]


async def test_student_can_be_added_with_a_discounted_fee(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group = await _group(client, admin_headers)

    entry = await _add(
        client,
        headers,
        group["id"],
        first_name="Aziza",
        phone="+998901112233",
        custom_fee=350_000,
        fee_note="Ikki fan uchun chegirma",
    )

    assert entry["monthly_fee"] == 350_000
    assert entry["discount"] == 50_000
    assert entry["fee_note"] == "Ikki fan uchun chegirma"


async def test_free_student_is_charged_zero_but_still_counted(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Bepul o'qiydigan ham hisobga tushadi — davomati va hisobi bor."""
    headers, group = await _group(client, admin_headers)

    entry = await _add(
        client,
        headers,
        group["id"],
        first_name="Bekzod",
        phone="+998901112244",
        custom_fee=0,
        fee_note="O'qituvchining jiyani",
    )
    assert entry["custom_fee"] == 0
    assert entry["monthly_fee"] == 0
    assert entry["discount"] == 400_000

    month = (
        await client.get(
            f"/groups/{group['id']}/payments",
            params={"year": YEAR, "month": MONTH},
            headers=headers,
        )
    ).json()

    charge = month["students"][0]
    assert charge["amount_due"] == 0
    assert charge["balance"] == 0
    # To'lovsiz ham qarzdor emas.
    assert charge["status"] == "paid"
    assert month["total_debt"] == 0


async def test_expected_monthly_uses_each_students_own_fee(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group = await _group(client, admin_headers)

    await _add(client, headers, group["id"], first_name="Aziza", phone="+998901112233")
    await _add(
        client,
        headers,
        group["id"],
        first_name="Bekzod",
        phone="+998901112244",
        custom_fee=200_000,
    )
    await _add(
        client,
        headers,
        group["id"],
        first_name="Dilnoza",
        phone="+998901112255",
        custom_fee=0,
    )

    body = (await client.get(f"/groups/{group['id']}", headers=headers)).json()
    assert body["student_count"] == 3
    # 400 000 + 200 000 + 0 — "3 × 400 000" emas.
    assert body["expected_monthly"] == 600_000


async def test_changing_a_fee_does_not_touch_past_months(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Narx o'zgarsa o'tgan oyning hisobi muzlatilgan holicha qoladi."""
    headers, group = await _group(client, admin_headers)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    student_id = created["student"]["student"]["id"]

    # Shu oyning hisobi ochiladi (400 000).
    before = (
        await client.get(
            f"/groups/{group['id']}/payments",
            params={"year": YEAR, "month": MONTH},
            headers=headers,
        )
    ).json()
    assert before["students"][0]["amount_due"] == 400_000

    updated = await client.patch(
        f"/groups/{group['id']}/students/{student_id}",
        json={"custom_fee": 250_000, "fee_note": "Moddiy ahvoli og'ir"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["monthly_fee"] == 250_000

    after = (
        await client.get(
            f"/groups/{group['id']}/payments",
            params={"year": YEAR, "month": MONTH},
            headers=headers,
        )
    ).json()
    assert after["students"][0]["amount_due"] == 400_000


async def test_resetting_the_fee_clears_the_note(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group = await _group(client, admin_headers)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    student_id = created["student"]["student"]["id"]

    await client.patch(
        f"/groups/{group['id']}/students/{student_id}",
        json={"custom_fee": 0, "fee_note": "Qarindosh"},
        headers=headers,
    )
    reset = await client.patch(
        f"/groups/{group['id']}/students/{student_id}",
        json={"reset_custom_fee": True},
        headers=headers,
    )

    body = reset.json()
    assert body["custom_fee"] is None
    assert body["fee_note"] is None
    assert body["monthly_fee"] == 400_000
    assert body["discount"] == 0


async def test_new_fee_can_be_applied_to_the_open_month(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Chegirma kelishuvi oy boshida bo'ladi — shu oydan qo'llash mumkin."""
    headers, group = await _group(client, admin_headers)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    student_id = created["student"]["student"]["id"]

    await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )

    await client.patch(
        f"/groups/{group['id']}/students/{student_id}",
        json={"custom_fee": 0, "apply_current_month": True},
        headers=headers,
    )

    month = (
        await client.get(
            f"/groups/{group['id']}/payments",
            params={"year": YEAR, "month": MONTH},
            headers=headers,
        )
    ).json()
    assert month["students"][0]["amount_due"] == 0
    assert month["total_debt"] == 0


async def test_open_month_is_not_touched_once_money_came_in(
    client: AsyncClient, admin_headers: dict
) -> None:
    """To'lov kiritilgan hisob o'zgarmaydi — u allaqachon hisob-kitobda."""
    headers, group = await _group(client, admin_headers)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    student_id = created["student"]["student"]["id"]

    await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": YEAR,
            "month": MONTH,
            "amount": 100_000,
        },
        headers=headers,
    )

    await client.patch(
        f"/groups/{group['id']}/students/{student_id}",
        json={"custom_fee": 0, "apply_current_month": True},
        headers=headers,
    )

    month = (
        await client.get(
            f"/groups/{group['id']}/payments",
            params={"year": YEAR, "month": MONTH},
            headers=headers,
        )
    ).json()
    assert month["students"][0]["amount_due"] == 400_000
