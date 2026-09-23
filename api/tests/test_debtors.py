"""Qarzdorlar ro'yxati — bosh sahifadagi "Qarz" raqamining tafsiloti."""

from httpx import AsyncClient

from app.core.clock import current_period
from tests.conftest import add_student, approved_teacher, create_group

YEAR, MONTH = current_period()


async def test_debtors_list_matches_dashboard(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=500_000)
    first = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    second = await add_student(
        client, headers, group["id"], first_name="Bekzod", phone="+998901112244"
    )
    paid_fully = second["student"]["student"]["id"]

    # Bittasi to'liq to'laydi — ro'yxatda qolmasligi kerak.
    await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": paid_fully,
            "year": YEAR,
            "month": MONTH,
            "amount": 500_000,
        },
        headers=headers,
    )

    response = await client.get("/reports/debtors", headers=headers)
    assert response.status_code == 200
    body = response.json()

    assert [item["student_id"] for item in body["items"]] == [
        first["student"]["student"]["id"]
    ]
    assert body["total_debt"] == 500_000

    dashboard = (await client.get("/reports/dashboard", headers=headers)).json()
    assert dashboard["debt"] == body["total_debt"]
    assert dashboard["debtor_count"] == len(body["items"])


async def test_partial_payment_stays_in_list_with_remaining_balance(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=400_000)
    created = await add_student(
        client, headers, group["id"], first_name="Dilnoza", phone="+998901112255"
    )
    student_id = created["student"]["student"]["id"]

    await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": YEAR,
            "month": MONTH,
            "amount": 150_000,
        },
        headers=headers,
    )

    body = (await client.get("/reports/debtors", headers=headers)).json()
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["amount_paid"] == 150_000
    assert item["balance"] == 250_000
    assert item["group_name"] == group["name"]


async def test_teacher_sees_only_own_debtors(
    client: AsyncClient, admin_headers: dict
) -> None:
    alice_headers, _ = await approved_teacher(
        client, admin_headers, username="alice", phone="+998900000001"
    )
    bob_headers, _ = await approved_teacher(
        client, admin_headers, username="bob", phone="+998900000002"
    )

    group = await create_group(client, alice_headers, name="Alisa guruhi")
    await add_student(
        client, alice_headers, group["id"], first_name="Aziza", phone="+998901112233"
    )

    assert (await client.get("/reports/debtors", headers=bob_headers)).json()[
        "items"
    ] == []
    assert (
        len(
            (await client.get("/reports/debtors", headers=alice_headers)).json()[
                "items"
            ]
        )
        == 1
    )
