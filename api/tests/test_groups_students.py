"""Guruh va o'quvchi boshqaruvi — talablardagi acceptance ro'yxati."""

from httpx import AsyncClient

from tests.conftest import add_student, approved_teacher, create_group


async def test_one_student_two_groups_single_account(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Bir o'quvchi ikki guruhda — bitta account, ikki a'zolik."""
    headers, _ = await approved_teacher(client, admin_headers)
    ielts = await create_group(client, headers, name="IELTS", fee=500_000)
    math = await create_group(client, headers, name="Matematika", fee=350_000)

    created = await add_student(
        client, headers, ielts["id"], first_name="Aziza", phone="+998901112233"
    )
    student_id = created["student"]["student"]["id"]

    # Mavjud o'quvchini ikkinchi guruhga qo'shish — yangi account yaratilmaydi.
    second = await client.post(
        f"/groups/{math['id']}/students",
        json={"student_id": student_id},
        headers=headers,
    )
    assert second.status_code == 201
    assert second.json()["temporary_password"] is None

    detail = await client.get(f"/students/{student_id}", headers=headers)
    groups = detail.json()["groups"]
    assert len(groups) == 2
    assert {g["monthly_fee"] for g in groups} == {500_000, 350_000}

    students = await client.get("/students", headers=headers)
    assert students.json()["total"] == 1


async def test_custom_fee_overrides_group_fee(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=500_000)
    created = await add_student(
        client, headers, group["id"], first_name="Bekzod", phone="+998902"
    )
    student_id = created["student"]["student"]["id"]

    updated = await client.patch(
        f"/groups/{group['id']}/students/{student_id}",
        json={"custom_fee": 300_000},
        headers=headers,
    )
    assert updated.json()["monthly_fee"] == 300_000

    reset = await client.patch(
        f"/groups/{group['id']}/students/{student_id}",
        json={"reset_custom_fee": True},
        headers=headers,
    )
    assert reset.json()["monthly_fee"] == 500_000


async def test_removed_student_keeps_history_and_account(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    created = await add_student(
        client, headers, group["id"], first_name="Dilnoza", phone="+998903"
    )
    student_id = created["student"]["student"]["id"]

    removed = await client.delete(
        f"/groups/{group['id']}/students/{student_id}", headers=headers
    )
    assert removed.status_code == 204

    active = await client.get(f"/groups/{group['id']}/students", headers=headers)
    assert active.json() == []

    with_left = await client.get(
        f"/groups/{group['id']}/students?include_left=true", headers=headers
    )
    body = with_left.json()
    assert len(body) == 1
    assert body[0]["status"] == "inactive"
    assert body[0]["left_on"] is not None

    # Account o'chmagan.
    assert (
        await client.get(f"/students/{student_id}", headers=headers)
    ).status_code == 200


async def test_duplicate_phone_is_rejected(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    await add_student(client, headers, group["id"], first_name="Aziza", phone="+998904")

    duplicate = await client.post(
        f"/groups/{group['id']}/students",
        json={"first_name": "Boshqa", "last_name": "Aziza", "phone": "+998904"},
        headers=headers,
    )
    assert duplicate.status_code == 409


async def test_group_with_data_cannot_be_deleted_only_archived(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    await add_student(client, headers, group["id"], first_name="Eldor", phone="+998905")

    refused = await client.delete(f"/groups/{group['id']}", headers=headers)
    assert refused.status_code == 409

    archived = await client.post(f"/groups/{group['id']}/archive", headers=headers)
    assert archived.json()["status"] == "archived"

    # Arxivlangan guruhga yangi o'quvchi qo'shilmaydi.
    blocked = await client.post(
        f"/groups/{group['id']}/students",
        json={"first_name": "Feruza", "phone": "+998906"},
        headers=headers,
    )
    assert blocked.status_code == 409

    restored = await client.post(f"/groups/{group['id']}/unarchive", headers=headers)
    assert restored.json()["status"] == "active"


async def test_empty_group_can_be_deleted(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    assert (
        await client.delete(f"/groups/{group['id']}", headers=headers)
    ).status_code == 204
    assert (
        await client.get(f"/groups/{group['id']}", headers=headers)
    ).status_code == 404


async def test_student_search(client: AsyncClient, admin_headers: dict) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    await add_student(
        client, headers, group["id"], first_name="Gulnora Aliyeva", phone="+998907"
    )
    await add_student(
        client, headers, group["id"], first_name="Sardor Bekov", phone="+998908"
    )

    found = await client.get("/students?search=gulnora", headers=headers)
    assert found.json()["total"] == 1
    assert found.json()["items"][0]["full_name"] == "Gulnora Aliyeva"

    by_phone = await client.get("/students?search=998908", headers=headers)
    assert by_phone.json()["total"] == 1
