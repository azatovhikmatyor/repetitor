"""O'quvchi kartasi: profil maydonlari va rasm."""

from io import BytesIO

from httpx import AsyncClient
from PIL import Image

from tests.conftest import add_student, approved_teacher, create_group


def _png(size: tuple[int, int] = (600, 400)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (40, 120, 90)).save(buffer, format="PNG")
    return buffer.getvalue()


async def _student(client: AsyncClient, admin_headers: dict):
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    return headers, created["student"]["student"]["id"]


async def test_profile_fields_are_saved_and_returned(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, student_id = await _student(client, admin_headers)

    response = await client.patch(
        f"/students/{student_id}",
        json={
            "birth_date": "2010-04-15",
            "parent_name": "Nodira Rahimova",
            "parent_phone": "+998901112200",
            "school": "24-maktab, 9-sinf",
            "note": "Shanba kunlari kechroq keladi",
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text

    body = (await client.get(f"/students/{student_id}", headers=headers)).json()
    assert body["birth_date"] == "2010-04-15"
    assert body["parent_name"] == "Nodira Rahimova"
    assert body["parent_phone"] == "+998901112200"
    assert body["school"] == "24-maktab, 9-sinf"
    assert body["note"] == "Shanba kunlari kechroq keladi"


async def test_teacher_uploads_and_removes_student_photo(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, student_id = await _student(client, admin_headers)

    uploaded = await client.post(
        f"/students/{student_id}/avatar",
        files={"file": ("photo.png", _png(), "image/png")},
        headers=headers,
    )
    assert uploaded.status_code == 200, uploaded.text
    url = uploaded.json()["avatar_url"]
    assert url and url.startswith("/media/avatars/")

    # Ro'yxatlarda ham ko'rinadi.
    listed = (await client.get("/students", headers=headers)).json()
    assert listed["items"][0]["avatar_url"] == url

    removed = await client.delete(f"/students/{student_id}/avatar", headers=headers)
    assert removed.status_code == 200
    assert removed.json()["avatar_url"] is None


async def test_photo_must_be_a_real_image(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, student_id = await _student(client, admin_headers)

    response = await client.post(
        f"/students/{student_id}/avatar",
        files={"file": ("fake.png", b"not an image at all", "image/png")},
        headers=headers,
    )
    assert response.status_code == 422
    assert "rasm emas" in response.json()["detail"]


async def test_photo_of_another_teachers_student_is_not_found(
    client: AsyncClient, admin_headers: dict
) -> None:
    _, student_id = await _student(client, admin_headers)
    other, _ = await approved_teacher(
        client, admin_headers, username="boshqa", phone="+998900000009"
    )

    response = await client.post(
        f"/students/{student_id}/avatar",
        files={"file": ("photo.png", _png(), "image/png")},
        headers=other,
    )
    assert response.status_code == 404


async def test_list_carries_groups_and_debt(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, name="IELTS", fee=400_000)
    await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    # Hisob ochilsin.
    await client.get(
        f"/groups/{group['id']}/payments",
        params={"year": 2026, "month": 9},
        headers=headers,
    )

    item = (await client.get("/students", headers=headers)).json()["items"][0]
    assert item["group_count"] == 1
    assert item["group_names"] == ["IELTS"]
    assert item["debt"] > 0


async def test_list_filters_by_group_and_debt(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    first = await create_group(client, headers, name="Birinchi")
    second = await create_group(client, headers, name="Ikkinchi")
    await add_student(
        client, headers, first["id"], first_name="Aziza", phone="+998901112233"
    )
    await add_student(
        client, headers, second["id"], first_name="Bekzod", phone="+998901112244"
    )

    only_first = await client.get(
        "/students", params={"group_id": first["id"]}, headers=headers
    )
    assert [item["first_name"] for item in only_first.json()["items"]] == ["Aziza"]

    # Hech kimda hali hisob yo'q — qarzdorlar ro'yxati bo'sh.
    debtors = await client.get(
        "/students", params={"only_debtors": True}, headers=headers
    )
    assert debtors.json()["total"] == 0


async def test_search_also_looks_at_parent_and_school(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, student_id = await _student(client, admin_headers)
    await client.patch(
        f"/students/{student_id}",
        json={"parent_name": "Nodira", "school": "24-maktab"},
        headers=headers,
    )

    by_parent = await client.get(
        "/students", params={"search": "Nodira"}, headers=headers
    )
    assert by_parent.json()["total"] == 1

    by_school = await client.get(
        "/students", params={"search": "24-maktab"}, headers=headers
    )
    assert by_school.json()["total"] == 1


async def test_pagination_splits_the_list(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers)
    for index in range(5):
        await add_student(
            client,
            headers,
            group["id"],
            first_name=f"Talaba{index}",
            phone=f"+99890111{index:04d}",
        )

    first_page = (
        await client.get("/students", params={"size": 2, "page": 1}, headers=headers)
    ).json()
    second_page = (
        await client.get("/students", params={"size": 2, "page": 2}, headers=headers)
    ).json()

    assert first_page["total"] == 5
    assert first_page["pages"] == 3
    assert len(first_page["items"]) == 2
    # Sahifalar kesishmaydi.
    assert {item["id"] for item in first_page["items"]}.isdisjoint(
        item["id"] for item in second_page["items"]
    )
