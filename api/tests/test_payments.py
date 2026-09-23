"""To'lov mantiqi — talab 12 dagi biznes qoidalari."""

from httpx import AsyncClient

from app.core.clock import current_period, shift_period
from tests.conftest import add_student, approved_teacher, create_group

YEAR, MONTH = current_period()


async def _setup(client: AsyncClient, admin_headers: dict, fee: int = 500_000):
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=fee)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    return headers, group, created["student"]["student"]["id"]


async def test_charges_are_created_lazily_and_start_unpaid(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)

    response = await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )
    body = response.json()
    assert body["total_due"] == 500_000
    assert body["total_paid"] == 0
    assert body["students"][0]["status"] == "unpaid"
    assert body["students"][0]["balance"] == 500_000


async def test_partial_then_full_payment(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)

    first = await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": YEAR,
            "month": MONTH,
            "amount": 200_000,
            "method": "cash",
        },
        headers=headers,
    )
    assert first.status_code == 201

    partial = await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )
    assert partial.json()["students"][0]["status"] == "partial"
    assert partial.json()["students"][0]["balance"] == 300_000

    await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": YEAR,
            "month": MONTH,
            "amount": 300_000,
        },
        headers=headers,
    )
    paid = await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )
    assert paid.json()["students"][0]["status"] == "paid"
    assert paid.json()["total_paid"] == 500_000


async def test_payment_is_reversed_not_deleted(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)

    payment = await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": YEAR,
            "month": MONTH,
            "amount": 500_000,
        },
        headers=headers,
    )
    payment_id = payment.json()["id"]

    reversal = await client.post(
        f"/payments/{payment_id}/reverse",
        json={"note": "Xato kiritilgan"},
        headers=headers,
    )
    assert reversal.status_code == 201
    assert reversal.json()["amount"] == -500_000
    assert reversal.json()["is_reversal"] is True

    balance = await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )
    assert balance.json()["students"][0]["status"] == "unpaid"

    # Ikkala yozuv ham tarixda qoladi.
    history = await client.get(
        f"/groups/{group['id']}/payments/history", headers=headers
    )
    assert len(history.json()) == 2

    # Ikkinchi marta bekor qilib bo'lmaydi.
    again = await client.post(
        f"/payments/{payment_id}/reverse", json={}, headers=headers
    )
    assert again.status_code == 409


async def test_payment_period_is_limited_to_next_month(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers)
    far_year, far_month = shift_period(YEAR, MONTH, 2)

    response = await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": far_year,
            "month": far_month,
            "amount": 500_000,
        },
        headers=headers,
    )
    assert response.status_code == 422

    next_year, next_month = shift_period(YEAR, MONTH, 1)
    allowed = await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": next_year,
            "month": next_month,
            "amount": 500_000,
        },
        headers=headers,
    )
    assert allowed.status_code == 201


async def test_fee_change_does_not_affect_existing_charges(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Narx o'zgarsa faqat kelajakdagi oylarga ta'sir qiladi."""
    headers, group, student_id = await _setup(client, admin_headers, fee=500_000)

    # Joriy oy hisobi ochiladi (500 000 bilan muzlaydi).
    await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )

    await client.patch(
        f"/groups/{group['id']}", json={"monthly_fee": 700_000}, headers=headers
    )

    unchanged = await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )
    assert unchanged.json()["students"][0]["amount_due"] == 500_000

    next_year, next_month = shift_period(YEAR, MONTH, 1)
    future = await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": next_year, "month": next_month},
        headers=headers,
    )
    assert future.json()["students"][0]["amount_due"] == 700_000


async def test_mid_month_join_pays_full_fee(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Proratsiya yo'q — oy o'rtasida qo'shilgan o'quvchi to'liq to'laydi."""
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=400_000)
    from app.core.clock import local_today

    mid_month = local_today().replace(day=15).isoformat()
    created = await client.post(
        f"/groups/{group['id']}/students",
        json={
            "first_name": "Kech",
            "last_name": "Qoshilgan",
            "phone": "+998909",
            "joined_on": mid_month,
        },
        headers=headers,
    )
    assert created.status_code == 201

    charges = await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )
    assert charges.json()["students"][0]["amount_due"] == 400_000


async def test_dashboard_and_monthly_report_agree(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, group, student_id = await _setup(client, admin_headers, fee=500_000)
    await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": YEAR,
            "month": MONTH,
            "amount": 200_000,
        },
        headers=headers,
    )

    dashboard = (await client.get("/reports/dashboard", headers=headers)).json()
    assert dashboard["expected"] == 500_000
    assert dashboard["collected"] == 200_000
    assert dashboard["debt"] == 300_000
    assert dashboard["debtor_count"] == 1
    assert dashboard["collection_rate"] == 40.0
    assert dashboard["groups_without_attendance_today"][0]["group_id"] == group["id"]

    monthly = (
        await client.get(
            "/reports/monthly",
            params={"year": YEAR, "month": MONTH},
            headers=headers,
        )
    ).json()
    assert monthly["total_due"] == dashboard["expected"]
    assert monthly["total_paid"] == dashboard["collected"]
    assert monthly["groups"][0]["partial_count"] == 1

    trend = (
        await client.get(
            "/reports/revenue-trend", params={"months": 3}, headers=headers
        )
    ).json()
    assert len(trend["points"]) == 3
    assert trend["points"][-1]["collected"] == 200_000
