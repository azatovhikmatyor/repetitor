"""Telegram bot — faqat ota-onani o'quvchiga bog'lash uchun (`/start <kod>`).

Long polling (`getUpdates`) ishlatiladi — webhook uchun ochiq domen/SSL kerak
bo'lardi, bu esa hozirgi "backend o'zi frontendni serve qiladi" oddiy
deploy modeliga to'g'ri kelmaydi. Token bo'sh bo'lsa umuman ishga
tushmaydi (`main.py` shunga qarab tekshiradi).
"""

import asyncio
import logging

import httpx

from app.core.config import settings
from app.db.session import SessionLocal
from app.modules.quizzes.service import link_parent_chat

logger = logging.getLogger("app.quizzes.telegram_bot")

_API_URL = "https://api.telegram.org/bot{token}/{method}"


async def _handle_update(update: dict) -> None:
    message = update.get("message") or {}
    text: str = message.get("text") or ""
    chat_id = message.get("chat", {}).get("id")
    if chat_id is None or not text.startswith("/start"):
        return

    parts = text.split(maxsplit=1)
    if len(parts) != 2:
        return
    link_code = parts[1].strip()

    async with SessionLocal() as db:
        linked = await link_parent_chat(db, link_code=link_code, chat_id=str(chat_id))
        await db.commit()

    reply = (
        "Bog'landi! Endi farzandingizning imtihon natijalari shu yerga yuboriladi."
        if linked
        else "Kod topilmadi. O'qituvchidan to'g'ri kodni so'rang."
    )
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(
            _API_URL.format(token=settings.telegram_bot_token, method="sendMessage"),
            json={"chat_id": chat_id, "text": reply},
        )


async def run_forever() -> None:
    offset: int | None = None
    async with httpx.AsyncClient(timeout=35) as client:
        while True:
            try:
                response = await client.get(
                    _API_URL.format(
                        token=settings.telegram_bot_token, method="getUpdates"
                    ),
                    params={"timeout": 30, "offset": offset}
                    if offset
                    else {"timeout": 30},
                )
                response.raise_for_status()
                updates = response.json().get("result", [])
                for update in updates:
                    offset = update["update_id"] + 1
                    await _handle_update(update)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Telegram bot polling xatosi")
                await asyncio.sleep(5)
