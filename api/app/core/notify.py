"""Xabar yuborish kanallari — email va SMS.

Ikkalasi ham interfeys sifatida ajratilgan (`MessageSender`). Sozlamalar
(`.env`) bo'sh bo'lsa xabar shunchaki logga yoziladi — dev/test uchun
xavfsiz standart holat. SMTP yoki Eskiz ma'lumotlari to'ldirilsa,
quyidagi `email_sender`/`sms_sender` avtomatik ravishda haqiqiy
implementatsiyaga almashadi; chaqiruvchi kod (`send_password_reset_code`
va h.k.) o'zgarmaydi.
"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import settings

logger = logging.getLogger("app.notify")


class MessageSender:
    async def send(self, *, to: str, subject: str, body: str) -> None:
        raise NotImplementedError


class ConsoleSender(MessageSender):
    """Sozlanmagan kanal — xabar faqat logga yoziladi."""

    def __init__(self, channel: str) -> None:
        self.channel = channel

    async def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info("%s -> %s | %s\n%s", self.channel.upper(), to, subject, body)


class SmtpEmailSender(MessageSender):
    """Oddiy SMTP orqali email — Gmail, Yandex va boshqa har qanday provayder."""

    async def send(self, *, to: str, subject: str, body: str) -> None:
        await asyncio.to_thread(self._send_sync, to, subject, body)

    def _send_sync(self, to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = settings.smtp_from or settings.smtp_username
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_use_tls:
                client.starttls()
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)


class EskizSmsSender(MessageSender):
    """Eskiz.uz SMS API.

    Token bir necha kunga amal qiladi — xotirada saqlanadi va faqat
    401 kelganda (muddati o'tganda) qayta olinadi.
    """

    _AUTH_URL = "https://notify.eskiz.uz/api/auth/login"
    _SEND_URL = "https://notify.eskiz.uz/api/message/sms/send"

    def __init__(self) -> None:
        self._token: str | None = None

    async def _authenticate(self, client: httpx.AsyncClient) -> str:
        response = await client.post(
            self._AUTH_URL,
            data={"email": settings.eskiz_email, "password": settings.eskiz_password},
        )
        response.raise_for_status()
        token: str = response.json()["data"]["token"]
        self._token = token
        return token

    async def _send_once(
        self, client: httpx.AsyncClient, *, to: str, body: str
    ) -> httpx.Response:
        token = self._token or await self._authenticate(client)
        return await client.post(
            self._SEND_URL,
            headers={"Authorization": f"Bearer {token}"},
            data={
                # Eskiz "998xxxxxxxxx" formatini kutadi, "+" belgisiz.
                "mobile_phone": to.lstrip("+"),
                "message": body,
                "from": settings.eskiz_from,
            },
        )

    async def send(self, *, to: str, subject: str, body: str) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await self._send_once(client, to=to, body=body)
            if response.status_code == 401:
                # Token eskirgan — bir marta qayta autentifikatsiya qilib ko'ramiz.
                self._token = None
                response = await self._send_once(client, to=to, body=body)
            response.raise_for_status()


class TelegramSender:
    """Telegram bot API orqali bitta chat'ga xabar.

    Email/SMS'dan farqli o'laroq manzil (`to`) chat_id, subject ishlatilmaydi
    — shuning uchun `MessageSender` interfeysini emas, alohida `send_chat`
    metodini ishlatadi.
    """

    _BASE_URL = "https://api.telegram.org/bot{token}/sendMessage"

    async def send_chat(self, *, chat_id: str, text: str) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                self._BASE_URL.format(token=settings.telegram_bot_token),
                json={"chat_id": chat_id, "text": text},
            )
            response.raise_for_status()


class ConsoleTelegramSender(TelegramSender):
    async def send_chat(self, *, chat_id: str, text: str) -> None:
        logger.info("TELEGRAM -> %s | %s", chat_id, text)


email_sender: MessageSender = (
    SmtpEmailSender() if settings.smtp_host else ConsoleSender("email")
)
sms_sender: MessageSender = (
    EskizSmsSender()
    if settings.eskiz_email and settings.eskiz_password
    else ConsoleSender("sms")
)
telegram_sender: TelegramSender = (
    TelegramSender() if settings.telegram_bot_token else ConsoleTelegramSender()
)


async def send_password_reset_code(
    *, to: str, channel: str, token: str, minutes: int
) -> None:
    sender = sms_sender if channel == "sms" else email_sender
    await sender.send(
        to=to,
        subject="Parolni tiklash",
        body=(
            "Parolni tiklash kodi:\n\n"
            f"{token}\n\n"
            f"Kod {minutes} daqiqa amal qiladi. "
            "Agar bu so'rovni siz yubormagan bo'lsangiz, e'tiborsiz qoldiring."
        ),
    )


async def notify_admin_new_teacher(*, admin_emails: list[str], teacher: str) -> None:
    """Yangi o'qituvchi tasdiqlashni kutmoqda.

    Asosiy bildirishnoma — admin panelidagi "Tasdiq kutmoqda" ro'yxati va
    hisoblagichi; bu esa qo'shimcha kanal.
    """
    if not admin_emails:
        return
    for address in admin_emails:
        await email_sender.send(
            to=address,
            subject="Yangi o'qituvchi tasdiqlashni kutmoqda",
            body=(
                f"{teacher} ro'yxatdan o'tdi va hisobi tasdiqlanishini kutmoqda.\n"
                "Admin panelidagi «O'qituvchilar → Tasdiq kutmoqda» bo'limiga qarang."
            ),
        )


async def notify_teacher_password_reset_request(
    *, teacher_email: str | None, teacher_phone: str | None, student_name: str
) -> None:
    """O'quvchi ilovaga kira olmay, parolni tiklashni so'radi.

    Asosiy bildirishnoma — o'quvchi kartasidagi "Parol so'ralgan" belgisi;
    bu esa o'qituvchi ilovani ochib o'tirmasa ham bilib qolishi uchun.
    Email bo'lsa shu orqali, bo'lmasa (lekin telefon bo'lsa) SMS orqali.
    """
    body = (
        f"{student_name} ilovaga kira olmay, parolni tiklashni so'radi.\n"
        "O'quvchi kartasidan yangi vaqtinchalik parol bering."
    )
    if teacher_email:
        await email_sender.send(
            to=teacher_email, subject="O'quvchi parol so'radi", body=body
        )
    elif teacher_phone:
        await sms_sender.send(
            to=teacher_phone, subject="O'quvchi parol so'radi", body=body
        )


async def notify_exam_result_to_parent(
    *,
    chat_id: str,
    student_name: str,
    quiz_title: str,
    score: float,
    rank: int,
    out_of: int,
) -> None:
    """Imtihon muddati tugab, natija hisoblangach ota-onaga Telegram xabari."""
    await telegram_sender.send_chat(
        chat_id=chat_id,
        text=(
            f'{student_name} "{quiz_title}" testini topshirdi.\n'
            f"Ball: {score:g}\n"
            f"O'rin: guruhda {out_of} o'quvchi orasida {rank}-o'rin"
        ),
    )


async def notify_teacher_exam_ready(
    *,
    teacher_email: str | None,
    teacher_phone: str | None,
    quiz_title: str,
    participant_count: int,
) -> None:
    """Imtihon reytingi tayyor bo'lganda o'qituvchiga xabar."""
    body = (
        f'"{quiz_title}" imtihonining natijalari tayyor '
        f"({participant_count} o'quvchi baholandi)."
    )
    if teacher_email:
        await email_sender.send(
            to=teacher_email, subject="Imtihon natijalari tayyor", body=body
        )
    elif teacher_phone:
        await sms_sender.send(
            to=teacher_phone, subject="Imtihon natijalari tayyor", body=body
        )
