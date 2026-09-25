"""Kvitansiya va hisobotning PDF eksporti."""

from httpx import AsyncClient

from app.core.clock import current_period
from tests.conftest import add_student, approved_teacher, create_group

YEAR, MONTH = current_period()


async def _setup(client: AsyncClient, admin_headers: dict):
    headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, headers, fee=500_000)
    created = await add_student(
        client, headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    student_id = created["student"]["student"]["id"]
    return headers, group, student_id


async def test_receipt_pdf_download(client: AsyncClient, admin_headers: dict) -> None:
    headers, group, student_id = await _setup(client, admin_headers)

    payment = await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": YEAR,
            "month": MONTH,
            "amount": 500_000,
            "method": "cash",
        },
        headers=headers,
    )
    assert payment.status_code == 201, payment.text
    payment_id = payment.json()["id"]

    response = await client.get(f"/payments/{payment_id}/receipt.pdf", headers=headers)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


async def test_receipt_pdf_is_teacher_scoped(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Boshqa o'qituvchi begona kvitansiyani yuklab ololmaydi."""
    headers, group, student_id = await _setup(client, admin_headers)
    payment = await client.post(
        f"/groups/{group['id']}/payments",
        json={
            "student_id": student_id,
            "year": YEAR,
            "month": MONTH,
            "amount": 500_000,
            "method": "cash",
        },
        headers=headers,
    )
    payment_id = payment.json()["id"]

    other_headers, _ = await approved_teacher(client, admin_headers, username="bob2")
    response = await client.get(
        f"/payments/{payment_id}/receipt.pdf", headers=other_headers
    )

    assert response.status_code == 404


async def test_monthly_report_pdf_download(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _group, _student_id = await _setup(client, admin_headers)

    response = await client.get(
        "/reports/monthly.pdf",
        params={"year": YEAR, "month": MONTH},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
