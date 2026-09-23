"""Super Admin: tasdiqlash, zaxira nusxa va butunlay o'chirish."""

from httpx import AsyncClient

from tests.conftest import add_student, approved_teacher, create_group


async def _teacher_with_data(client: AsyncClient, admin_headers: dict):
    """Guruhi, o'quvchisi, davomati va to'lovi bor o'qituvchi."""
    from app.core.clock import current_period

    headers, user = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=500_000)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    student_id = created["student"]["student"]["id"]

    await client.put(
        f"/groups/{group['id']}/attendance",
        json={"records": [{"student_id": student_id, "status": "absent"}]},
        headers=headers,
    )

    year, month = current_period()
    await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": year,
            "month": month,
            "amount": 500_000,
        },
        headers=headers,
    )
    return headers, user, group, student_id


async def test_delete_preview_shows_what_is_lost(
    client: AsyncClient, admin_headers: dict
) -> None:
    _, user, _, _ = await _teacher_with_data(client, admin_headers)

    preview = await client.get(
        f"/admin/teachers/{user['id']}/delete-preview", headers=admin_headers
    )
    assert preview.status_code == 200
    body = preview.json()
    assert body["group_count"] == 1
    assert body["student_count"] == 1
    assert body["attendance_session_count"] == 1
    assert body["payment_count"] == 1
    assert body["total_collected"] == 500_000


async def test_export_contains_everything(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Zaxira nusxa o'chirishdan oldin butun ma'lumotni beradi."""
    _, user, group, student_id = await _teacher_with_data(client, admin_headers)

    export = await client.get(
        f"/admin/teachers/{user['id']}/export", headers=admin_headers
    )
    assert export.status_code == 200
    body = export.json()

    assert body["teacher"]["username"] == "ustoz"
    # Parol hash'i zaxiraga tushmaydi.
    assert "password_hash" not in body["teacher"]

    assert [g["id"] for g in body["groups"]] == [group["id"]]
    assert [s["id"] for s in body["students"]] == [student_id]
    assert len(body["enrollments"]) == 1
    assert len(body["attendance_sessions"]) == 1
    assert len(body["attendance_records"]) == 1
    assert len(body["monthly_charges"]) == 1
    assert body["payments"][0]["amount"] == 500_000


async def test_delete_requires_exact_username(
    client: AsyncClient, admin_headers: dict
) -> None:
    _, user, _, _ = await _teacher_with_data(client, admin_headers)

    wrong = await client.delete(
        f"/admin/teachers/{user['id']}?confirm=boshqa", headers=admin_headers
    )
    assert wrong.status_code == 422
    assert "username" in wrong.json()["detail"]

    # Hisob hali joyida.
    assert (await client.get("/admin/teachers", headers=admin_headers)).json()[
        "total"
    ] == 1


async def test_delete_removes_everything(
    client: AsyncClient, admin_headers: dict
) -> None:
    """O'chirish kaskad: o'quvchilar, guruhlar, davomat va to'lovlar ham."""
    teacher_headers, user, group, student_id = await _teacher_with_data(
        client, admin_headers
    )

    deleted = await client.delete(
        f"/admin/teachers/{user['id']}?confirm=ustoz", headers=admin_headers
    )
    assert deleted.status_code == 204

    listing = await client.get("/admin/teachers", headers=admin_headers)
    assert listing.json()["total"] == 0

    stats = await client.get("/admin/stats", headers=admin_headers)
    body = stats.json()
    assert body["teacher_count"] == 0
    assert body["student_count"] == 0
    assert body["group_count"] == 0

    # Eski token endi ishlamaydi — foydalanuvchi yo'q.
    assert (
        await client.get(f"/groups/{group['id']}", headers=teacher_headers)
    ).status_code == 401

    # O'quvchi ham kira olmaydi.
    assert (
        await client.get(f"/students/{student_id}", headers=teacher_headers)
    ).status_code == 401


async def test_admin_cannot_delete_or_block_self(
    client: AsyncClient, admin_headers: dict
) -> None:
    me = await client.get("/auth/me", headers=admin_headers)
    admin_id = me.json()["id"]

    # Super admin `/admin/teachers` ro'yxatida yo'q — faqat o'qituvchilar.
    blocked = await client.post(
        f"/admin/teachers/{admin_id}/block", headers=admin_headers
    )
    assert blocked.status_code == 409


async def test_teacher_cannot_use_admin_endpoints(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)

    assert (await client.get("/admin/teachers", headers=headers)).status_code == 403
    assert (await client.get("/admin/stats", headers=headers)).status_code == 403
    assert (
        await client.delete("/admin/teachers/1?confirm=ustoz", headers=headers)
    ).status_code == 403
