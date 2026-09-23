"""Email yuborish — interfeys va MVP implementatsiyasi.

Hozircha haqiqiy SMTP ulanmagan: lokal/dev muhitda xabar logga yoziladi.
Parol tiklash oqimi shu interfeysga tayanadi, shuning uchun SMTP yoki
tashqi provayder qo'shilganda faqat `EmailSender` ning yangi
implementatsiyasi yoziladi — chaqiruvchi kod o'zgarmaydi.
"""

import logging

logger = logging.getLogger("app.email")


class EmailSender:
    async def send(self, *, to: str, subject: str, body: str) -> None:
        raise NotImplementedError


class ConsoleEmailSender(EmailSender):
    async def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info("EMAIL -> %s | %s\n%s", to, subject, body)


email_sender: EmailSender = ConsoleEmailSender()


async def send_password_reset_email(*, to: str, token: str, minutes: int) -> None:
    await email_sender.send(
        to=to,
        subject="Parolni tiklash",
        body=(
            "Parolni tiklash uchun quyidagi kodni kiriting:\n\n"
            f"{token}\n\n"
            f"Kod {minutes} daqiqa amal qiladi. "
            "Agar bu so'rovni siz yubormagan bo'lsangiz, e'tiborsiz qoldiring."
        ),
    )
