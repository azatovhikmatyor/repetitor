"""Profil rasmini yuklash."""

from io import BytesIO

from httpx import AsyncClient
from PIL import Image

from tests.conftest import approved_teacher


def _image(size: tuple[int, int] = (64, 64), fmt: str = "PNG") -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (27, 107, 80)).save(buffer, format=fmt)
    return buffer.getvalue()


async def test_upload_and_replace_avatar(
    client: AsyncClient, admin_headers: dict
) -> None:
    headers, _ = await approved_teacher(client, admin_headers)

    first = await client.post(
        "/auth/me/avatar",
        files={"file": ("avatar.png", _image(), "image/png")},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    url = first.json()["avatar_url"]
    assert url.startswith("/media/avatars/")
    assert url.endswith(".png")

    # Qayta yuklaganda yangi manzil beriladi.
    second = await client.post(
        "/auth/me/avatar",
        files={"file": ("avatar.jpg", _image(fmt="JPEG"), "image/jpeg")},
        headers=headers,
    )
    assert second.json()["avatar_url"] != url
    assert second.json()["avatar_url"].endswith(".jpg")


async def test_large_image_is_downscaled(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Katta rasm 512×512 gacha kichraytiriladi."""
    from pathlib import Path

    from app.core.config import settings

    headers, _ = await approved_teacher(client, admin_headers)

    response = await client.post(
        "/auth/me/avatar",
        files={"file": ("big.png", _image((2000, 1500)), "image/png")},
        headers=headers,
    )
    assert response.status_code == 200

    url = response.json()["avatar_url"]
    stored = Path(settings.media_root) / url.removeprefix(f"{settings.media_url}/")
    with Image.open(stored) as saved:
        assert saved.width <= 512
        assert saved.height <= 512


async def test_non_image_is_rejected(client: AsyncClient, admin_headers: dict) -> None:
    """Tekshiruv Content-Type ga emas, fayl mazmuniga qarab bajariladi."""
    headers, _ = await approved_teacher(client, admin_headers)

    response = await client.post(
        "/auth/me/avatar",
        files={"file": ("virus.png", b"MZ\x90\x00 bu rasm emas", "image/png")},
        headers=headers,
    )
    assert response.status_code == 422
    assert "rasm emas" in response.json()["detail"]


async def test_avatar_can_be_removed(client: AsyncClient, admin_headers: dict) -> None:
    headers, _ = await approved_teacher(client, admin_headers)

    await client.post(
        "/auth/me/avatar",
        files={"file": ("avatar.png", _image(), "image/png")},
        headers=headers,
    )
    removed = await client.delete("/auth/me/avatar", headers=headers)
    assert removed.status_code == 200
    assert removed.json()["avatar_url"] is None
