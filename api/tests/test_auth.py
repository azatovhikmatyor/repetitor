"""Ro'yxatdan o'tish, tasdiqlash va kirish oqimlari."""

from httpx import AsyncClient

from tests.conftest import (
    add_student,
    approved_teacher,
    create_group,
    register_teacher,
)


async def test_registration_waits_for_approval(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Ro'yxatdan o'tgan o'qituvchi darhol kira olmaydi."""
    registered = await register_teacher(client)
    assert registered["username"] == "ustoz"
    # Token qaytarilmaydi — hisob hali faol emas.
    assert "access_token" not in registered

    blocked = await client.post(
        "/auth/login", json={"login": "ustoz", "password": "parol12345"}
    )
    assert blocked.status_code == 403
    assert "tasdiqlanmagan" in blocked.json()["detail"]

    approve = await client.post(
        f"/admin/teachers/{registered['user_id']}/approve", headers=admin_headers
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "active"

    allowed = await client.post(
        "/auth/login", json={"login": "ustoz", "password": "parol12345"}
    )
    assert allowed.status_code == 200
    assert allowed.json()["user"]["full_name"] == "Dilshod Karimov"


async def test_admin_sees_pending_teachers(
    client: AsyncClient, admin_headers: dict
) -> None:
    await register_teacher(client, username="ustoz1")
    await register_teacher(client, username="ustoz2")

    count = await client.get("/admin/teachers/pending-count", headers=admin_headers)
    assert count.json()["count"] == 2

    pending = await client.get(
        "/admin/teachers", params={"status": "pending"}, headers=admin_headers
    )
    assert pending.json()["total"] == 2

    stats = await client.get("/admin/stats", headers=admin_headers)
    assert stats.json()["pending_teacher_count"] == 2


async def test_username_must_be_unique(client: AsyncClient) -> None:
    await register_teacher(client, username="ustoz")

    duplicate = await client.post(
        "/auth/register",
        json={
            "first_name": "Boshqa",
            "last_name": "Odam",
            "username": "ustoz",
            "password": "parol12345",
            "password_confirm": "parol12345",
        },
    )
    assert duplicate.status_code == 409
    body = duplicate.json()
    # Forma xatoni aynan username maydoni ostida ko'rsatishi uchun.
    assert body["details"] == [
        {"field": "username", "message": "Bu username allaqachon band"}
    ]


async def test_username_is_case_insensitive(client: AsyncClient) -> None:
    await register_teacher(client, username="ustoz")

    duplicate = await client.post(
        "/auth/register",
        json={
            "first_name": "Boshqa",
            "last_name": "Odam",
            "username": "UstOz",
            "password": "parol12345",
            "password_confirm": "parol12345",
        },
    )
    assert duplicate.status_code == 409


async def test_passwords_must_match(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/register",
        json={
            "first_name": "Dilshod",
            "last_name": "Karimov",
            "username": "ustoz",
            "password": "parol12345",
            "password_confirm": "boshqaparol",
        },
    )
    assert response.status_code == 422
    assert "mos kelmadi" in str(response.json()["details"])


async def test_weak_password_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/register",
        json={
            "first_name": "Dilshod",
            "last_name": "Karimov",
            "username": "ustoz",
            "password": "123",
            "password_confirm": "123",
        },
    )
    assert response.status_code == 422


async def test_login_by_username_email_and_phone(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Email va telefon qo'yilgan bo'lsa, ular bilan ham kirish mumkin."""
    await approved_teacher(
        client,
        admin_headers,
        username="ustoz",
        email="ustoz@example.com",
        phone="+998901234567",
    )

    for login in ("ustoz", "ustoz@example.com", "+998901234567"):
        response = await client.post(
            "/auth/login", json={"login": login, "password": "parol12345"}
        )
        assert response.status_code == 200, login


async def test_login_is_rate_limited(client: AsyncClient, admin_headers: dict) -> None:
    await approved_teacher(client, admin_headers)
    payload = {"login": "ustoz", "password": "noto'g'ri"}

    for _ in range(5):
        assert (await client.post("/auth/login", json=payload)).status_code == 401

    blocked = await client.post("/auth/login", json=payload)
    assert blocked.status_code == 429


async def test_blocked_teacher_and_students_cannot_log_in(
    client: AsyncClient, admin_headers: dict
) -> None:
    """O'qituvchi bloklansa, uning o'quvchilari ham kira olmaydi."""
    headers, user = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    temp_password = created["temporary_password"]

    # Bloklashdan oldin o'quvchi kira oladi.
    before = await client.post(
        "/auth/login", json={"login": "+998901112233", "password": temp_password}
    )
    assert before.status_code == 200

    blocked = await client.post(
        f"/admin/teachers/{user['id']}/block", headers=admin_headers
    )
    assert blocked.json()["status"] == "blocked"

    teacher_login = await client.post(
        "/auth/login", json={"login": "ustoz", "password": "parol12345"}
    )
    assert teacher_login.status_code == 403
    assert "bloklangan" in teacher_login.json()["detail"]

    student_login = await client.post(
        "/auth/login", json={"login": "+998901112233", "password": temp_password}
    )
    assert student_login.status_code == 403

    # Tiklangach ikkalasi ham qaytadi.
    await client.post(f"/admin/teachers/{user['id']}/unblock", headers=admin_headers)
    assert (
        await client.post(
            "/auth/login", json={"login": "ustoz", "password": "parol12345"}
        )
    ).status_code == 200
    assert (
        await client.post(
            "/auth/login", json={"login": "+998901112233", "password": temp_password}
        )
    ).status_code == 200


async def test_forgot_password_without_contacts_points_to_admin(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Email ham, telefon ham yo'q bo'lsa — parolni faqat admin tiklaydi."""
    await approved_teacher(client, admin_headers, username="ustoz")

    response = await client.post("/auth/password/forgot", json={"login": "ustoz"})
    assert response.status_code == 200
    body = response.json()
    assert body["channel"] is None
    assert "administratorga murojaat" in body["detail"].lower()


async def test_forgot_password_picks_channel(
    client: AsyncClient, admin_headers: dict
) -> None:
    await approved_teacher(
        client,
        admin_headers,
        username="ustoz",
        email="ustoz@example.com",
        phone="+998901234567",
    )

    by_email = await client.post(
        "/auth/password/forgot", json={"login": "ustoz@example.com"}
    )
    assert by_email.json()["channel"] == "email"

    by_phone = await client.post(
        "/auth/password/forgot", json={"login": "+998901234567"}
    )
    assert by_phone.json()["channel"] == "sms"


async def test_admin_can_reset_teacher_password(
    client: AsyncClient, admin_headers: dict
) -> None:
    _, user = await approved_teacher(client, admin_headers)

    reset = await client.post(
        f"/admin/teachers/{user['id']}/reset-password", headers=admin_headers
    )
    assert reset.status_code == 200
    temporary = reset.json()["temporary_password"]

    login = await client.post(
        "/auth/login", json={"login": "ustoz", "password": temporary}
    )
    assert login.status_code == 200
    # Vaqtinchalik parol bilan kirgan — almashtirmaguncha boshqa ekranlar yopiq.
    assert login.json()["must_change_password"] is True

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert (await client.get("/groups", headers=headers)).status_code == 403


async def test_student_must_change_password_before_anything_else(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, name="IELTS")
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    temp_password = created["temporary_password"]

    login = await client.post(
        "/auth/login", json={"login": "+998901112233", "password": temp_password}
    )
    body = login.json()
    assert body["must_change_password"] is True
    student_headers = {"Authorization": f"Bearer {body['access_token']}"}

    assert (await client.get("/auth/me", headers=student_headers)).status_code == 200

    blocked = await client.get("/groups", headers=student_headers)
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"

    changed = await client.post(
        "/auth/password/change",
        json={
            "current_password": temp_password,
            "new_password": "yangiparol1",
            "new_password_confirm": "yangiparol1",
        },
        headers=student_headers,
    )
    assert changed.status_code == 200

    relogin = await client.post(
        "/auth/login", json={"login": "+998901112233", "password": "yangiparol1"}
    )
    assert relogin.json()["must_change_password"] is False


async def test_profile_update_keeps_username(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Sharif va email profildan qo'shiladi; username o'zgarmaydi."""
    headers, _ = await approved_teacher(client, admin_headers)

    response = await client.patch(
        "/auth/me",
        json={
            "middle_name": "Anvarovich",
            "email": "yangi@example.com",
            "username": "boshqa",  # e'tiborga olinmaydi
        },
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["middle_name"] == "Anvarovich"
    assert body["email"] == "yangi@example.com"
    assert body["username"] == "ustoz"
    assert body["can_reset_password_alone"] is True


async def test_profile_saves_without_email_or_phone(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Email va telefon ixtiyoriy — bo'sh qoldirilsa ham saqlanadi.

    Forma tozalangan maydonni bo'sh satr sifatida yuboradi; u `None` ga
    aylanishi va so'rov muvaffaqiyatli bo'lishi kerak.
    """
    headers, _ = await approved_teacher(client, admin_headers, email="eski@example.com")

    response = await client.patch(
        "/auth/me",
        json={
            "first_name": "Farrux",
            "last_name": "Azatov",
            "middle_name": "",
            "email": "",
            "phone": "",
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["first_name"] == "Farrux"
    assert body["last_name"] == "Azatov"
    assert body["email"] is None
    assert body["phone"] is None
    # Aloqa ma'lumoti qolmadi — parolni endi faqat admin tiklay oladi.
    assert body["can_reset_password_alone"] is False


async def test_refresh_rotates_and_revokes_old_token(
    client: AsyncClient, admin_headers: dict
) -> None:
    await approved_teacher(client, admin_headers)
    login = await client.post(
        "/auth/login", json={"login": "ustoz", "password": "parol12345"}
    )
    old_refresh = login.json()["refresh_token"]

    first = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert first.status_code == 200

    # Eski token endi ishlamaydi — rotatsiya.
    second = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert second.status_code == 401


async def test_unauthenticated_requests_are_rejected(client: AsyncClient) -> None:
    assert (await client.get("/groups")).status_code == 401
    assert (await client.get("/reports/dashboard")).status_code == 401
