"""Ma'lumot izolyatsiyasi — loyihaning eng muhim xavfsizlik talabi.

O'qituvchi boshqa o'qituvchining resursini hech qanday yo'l bilan ko'ra
olmaydi va javob 404 bo'ladi (403 emas — resurs umuman mavjud emasdek).
"""

from httpx import AsyncClient

from tests.conftest import add_student, approved_teacher, create_group


async def test_teacher_cannot_see_another_teachers_group(
    client: AsyncClient, admin_headers: dict
) -> None:
    alice_headers, _ = await approved_teacher(client, admin_headers, username="alice")
    bob_headers, _ = await approved_teacher(client, admin_headers, username="bob")

    alice_group = await create_group(client, alice_headers, name="Alice guruhi")

    # Bob ro'yxatida Alice guruhi yo'q.
    listing = await client.get("/groups", headers=bob_headers)
    assert listing.json()["items"] == []

    for method, url in [
        ("get", f"/groups/{alice_group['id']}"),
        ("get", f"/groups/{alice_group['id']}/students"),
        ("get", f"/groups/{alice_group['id']}/attendance"),
    ]:
        response = await getattr(client, method)(url, headers=bob_headers)
        assert response.status_code == 404, url
        assert response.json()["code"] == "not_found"

    patched = await client.patch(
        f"/groups/{alice_group['id']}",
        json={"monthly_fee": 1},
        headers=bob_headers,
    )
    assert patched.status_code == 404

    deleted = await client.delete(f"/groups/{alice_group['id']}", headers=bob_headers)
    assert deleted.status_code == 404


async def test_teacher_cannot_touch_another_teachers_student(
    client: AsyncClient, admin_headers: dict
) -> None:
    alice_headers, _ = await approved_teacher(client, admin_headers, username="alice")
    bob_headers, _ = await approved_teacher(client, admin_headers, username="bob")

    alice_group = await create_group(client, alice_headers)
    created = await add_student(
        client, alice_headers, alice_group["id"], first_name="Aziza", phone="+998901"
    )
    student_id = created["student"]["student"]["id"]

    assert (
        await client.get(f"/students/{student_id}", headers=bob_headers)
    ).status_code == 404
    assert (
        await client.post(f"/students/{student_id}/reset-password", headers=bob_headers)
    ).status_code == 404
    assert (
        await client.get(f"/students/{student_id}/payments", headers=bob_headers)
    ).status_code == 404


async def test_dashboard_only_counts_own_data(
    client: AsyncClient, admin_headers: dict
) -> None:
    alice_headers, _ = await approved_teacher(client, admin_headers, username="alice")
    bob_headers, _ = await approved_teacher(client, admin_headers, username="bob")

    group = await create_group(client, alice_headers, fee=500_000)
    await add_student(
        client, alice_headers, group["id"], first_name="Aziza", phone="+998902"
    )

    alice_dashboard = await client.get("/reports/dashboard", headers=alice_headers)
    assert alice_dashboard.json()["expected"] == 500_000

    bob_dashboard = await client.get("/reports/dashboard", headers=bob_headers)
    body = bob_dashboard.json()
    assert body["expected"] == 0
    assert body["groups"] == []


async def test_teacher_cannot_use_admin_endpoints(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    assert (await client.get("/admin/teachers", headers=headers)).status_code == 403
    assert (await client.get("/admin/stats", headers=headers)).status_code == 403
