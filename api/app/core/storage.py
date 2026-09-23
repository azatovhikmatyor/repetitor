"""Yuklangan fayllar bilan ishlash.

Hozircha fayllar lokal diskda (`MEDIA_ROOT`) saqlanadi va FastAPI ularni
`/media` ostida beradi. Prod'da bu S3 yoki nginx'ga o'tadi — o'shanda
faqat shu modul almashtiriladi, chaqiruvchi kod o'zgarmaydi.
"""

import secrets
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.exceptions import ValidationError

AVATAR_DIR = "avatars"

#: Avatar shu o'lchamgacha kichraytiriladi — ro'yxat va profil uchun yetarli,
#: disk va trafikni tejaydi.
AVATAR_MAX_SIZE = (512, 512)

#: Qabul qilinadigan formatlar. Tekshiruv `Content-Type` ga emas, faylning
#: haqiqiy mazmuniga qarab bajariladi.
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
_EXTENSIONS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


def _media_path(*parts: str) -> Path:
    return Path(settings.media_root).joinpath(*parts)


def save_avatar(content: bytes) -> str:
    """Rasmni saqlaydi va uning URL'ini qaytaradi.

    Fayl nomi tasodifiy generatsiya qilinadi: foydalanuvchi yuborgan nom
    ishlatilmaydi, shuning uchun katalogdan chiqib ketish (path traversal)
    imkoni yo'q.
    """
    if len(content) > settings.max_avatar_bytes:
        limit_mb = settings.max_avatar_bytes // (1024 * 1024)
        raise ValidationError(f"Rasm hajmi {limit_mb} MB dan oshmasin")

    try:
        image = Image.open(BytesIO(content))
        image.verify()  # buzilgan fayllarni ushlaydi
        image = Image.open(BytesIO(content))
    except (UnidentifiedImageError, OSError) as exc:
        raise ValidationError("Fayl rasm emas yoki buzilgan") from exc

    image_format = (image.format or "").upper()
    if image_format not in ALLOWED_FORMATS:
        raise ValidationError("Faqat JPG, PNG yoki WEBP formatdagi rasm")

    # Shaffoflikni yo'qotmaslik uchun PNG/WEBP o'z formatida qoladi,
    # qolgani JPEG bo'lib saqlanadi.
    if image_format == "JPEG" and image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    image.thumbnail(AVATAR_MAX_SIZE)

    directory = _media_path(AVATAR_DIR)
    directory.mkdir(parents=True, exist_ok=True)

    name = f"{secrets.token_hex(16)}{_EXTENSIONS[image_format]}"
    image.save(directory / name, format=image_format, quality=85)

    return f"{settings.media_url}/{AVATAR_DIR}/{name}"


def delete_avatar(url: str | None) -> None:
    """Eski avatarni diskdan o'chiradi.

    Tashqi manzil (S3, boshqa domen) bo'lsa tegilmaydi. Fayl topilmasa ham
    xatolik ko'tarilmaydi — bu amal hech qachon asosiy oqimni to'xtatmasligi
    kerak.
    """
    prefix = f"{settings.media_url}/{AVATAR_DIR}/"
    if not url or not url.startswith(prefix):
        return

    name = url[len(prefix) :]
    if "/" in name or "\\" in name or name in ("", ".", ".."):
        return

    _media_path(AVATAR_DIR, name).unlink(missing_ok=True)
