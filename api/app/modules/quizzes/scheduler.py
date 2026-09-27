"""Muddati o'tgan imtihonlarni davriy tekshirish.

`main.py` lifespan ichida fon vazifasi sifatida ishga tushiriladi. Har bir
tikda muddati o'tgan, hali xabar yuborilmagan imtihonlarni topib, reyting
hisoblab, Telegram/email orqali xabar yuboradi (`service.check_due_exam_assignments`).
Bu shunchaki muddatni kutish uchun — o'qituvchi barcha essay javoblarni
qo'lda baholab, "Yakunlash" tugmasini bossa ham xuddi shu natija darhol
hisoblanadi (`POST /quizzes/assignments/{id}/finalize`).
"""

import asyncio
import logging

from app.db.session import SessionLocal
from app.modules.quizzes.service import check_due_exam_assignments

logger = logging.getLogger("app.quizzes.scheduler")

CHECK_INTERVAL_SECONDS = 60


async def run_forever() -> None:
    while True:
        try:
            async with SessionLocal() as db:
                await check_due_exam_assignments(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Imtihon tekshiruvchisida kutilmagan xato")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
