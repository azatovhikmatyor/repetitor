"""Xarajatlar va foyda."""

from httpx import AsyncClient

from app.core.clock import current_period, local_today, shift_period
from tests.conftest import add_student, approved_teacher, create_group

YEAR, MONTH = current_period()


async def _earning_teacher(client: AsyncClient, admin_headers: dict):
    """400 000 so'm yig'ib olgan o'qituvchi."""
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=400_000)
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
            "amount": 400_000,
        },
        headers=headers,
    )
    return headers, group


async def test_profit_is_collected_minus_expenses(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await _earning_teacher(client, admin_headers)

    await client.post(
        "/expenses",
        json={"title": "Ijara", "amount": 150_000, "category": "rent"},
        headers=headers,
    )
    await client.post(
        "/expenses",
        json={"title": "Internet", "amount": 50_000, "category": "utilities"},
        headers=headers,
    )

    body = (
        await client.get(
            "/expenses", params={"year": YEAR, "month": MONTH}, headers=headers
        )
    ).json()
    assert body["total"] == 200_000
    assert body["collected"] == 400_000
    assert body["profit"] == 200_000
    assert [item["category"] for item in body["by_category"]] == ["rent", "utilities"]

    # Hisobot va bosh sahifa ham bir xil raqamni ko'rsatadi.
    monthly = (
        await client.get(
            "/reports/monthly", params={"year": YEAR, "month": MONTH}, headers=headers
        )
    ).json()
    assert monthly["total_expenses"] == 200_000
    assert monthly["profit"] == 200_000

    dashboard = (await client.get("/reports/dashboard", headers=headers)).json()
    assert dashboard["expenses"] == 200_000
    assert dashboard["profit"] == 200_000


async def test_profit_can_be_negative(client: AsyncClient, admin_headers: dict) -> None:
    """Yangi markazda xarajat daromaddan ko'p bo'lishi odatiy."""
    headers, _ = await approved_teacher(client, admin_headers)

    await client.post(
        "/expenses",
        json={"title": "Jihoz", "amount": 900_000, "category": "supplies"},
        headers=headers,
    )

    body = (await client.get("/expenses", headers=headers)).json()
    assert body["collected"] == 0
    assert body["profit"] == -900_000


async def test_expense_belongs_to_its_teacher_only(
    client: AsyncClient, admin_headers: dict
) -> None:
    alice, _ = await approved_teacher(
        client, admin_headers, username="alice", phone="+998900000001"
    )
    bob, _ = await approved_teacher(
        client, admin_headers, username="bob", phone="+998900000002"
    )

    created = await client.post(
        "/expenses", json={"title": "Ijara", "amount": 100_000}, headers=alice
    )
    expense_id = created.json()["id"]

    assert (await client.get("/expenses", headers=bob)).json()["total"] == 0
    # Begona yozuv — 403 emas, 404.
    assert (
        await client.patch(f"/expenses/{expense_id}", json={"amount": 1}, headers=bob)
    ).status_code == 404
    assert (
        await client.delete(f"/expenses/{expense_id}", headers=bob)
    ).status_code == 404


async def test_recurring_expenses_are_copied_to_the_next_month(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    today = local_today()
    previous_year, previous_month = shift_period(YEAR, MONTH, -1)

    await client.post(
        "/expenses",
        json={
            "title": "Ijara",
            "amount": 1_500_000,
            "category": "rent",
            "spent_on": f"{previous_year}-{previous_month:02d}-05",
            "is_recurring": True,
        },
        headers=headers,
    )
    # Takrorlanmaydigan xarajat ko'chirilmaydi.
    await client.post(
        "/expenses",
        json={
            "title": "Bir martalik xarid",
            "amount": 200_000,
            "spent_on": f"{previous_year}-{previous_month:02d}-07",
        },
        headers=headers,
    )

    result = await client.post(
        "/expenses/copy-previous",
        params={"year": today.year, "month": today.month},
        headers=headers,
    )
    assert result.json() == {"copied": 1, "skipped": 0}

    body = (await client.get("/expenses", headers=headers)).json()
    assert [item["title"] for item in body["items"]] == ["Ijara"]
    assert body["total"] == 1_500_000

    # Ikkinchi marta bosilsa — nusxa ko'paymaydi.
    again = await client.post(
        "/expenses/copy-previous",
        params={"year": today.year, "month": today.month},
        headers=headers,
    )
    assert again.json() == {"copied": 0, "skipped": 1}


async def test_expense_can_be_edited_and_deleted(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    created = await client.post(
        "/expenses", json={"title": "Reklama", "amount": 100_000}, headers=headers
    )
    expense_id = created.json()["id"]

    updated = await client.patch(
        f"/expenses/{expense_id}",
        json={"amount": 120_000, "category": "marketing"},
        headers=headers,
    )
    assert updated.json()["amount"] == 120_000
    assert updated.json()["category"] == "marketing"

    assert (
        await client.delete(f"/expenses/{expense_id}", headers=headers)
    ).status_code == 204
    assert (await client.get("/expenses", headers=headers)).json()["items"] == []


async def test_trend_carries_expenses_and_profit(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await _earning_teacher(client, admin_headers)
    await client.post(
        "/expenses",
        json={"title": "Ijara", "amount": 100_000, "category": "rent"},
        headers=headers,
    )

    points = (
        await client.get(
            "/reports/revenue-trend", params={"months": 3}, headers=headers
        )
    ).json()["points"]
    current = points[-1]

    assert current["collected"] == 400_000
    assert current["expenses"] == 100_000
    assert current["profit"] == 300_000
