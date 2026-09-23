"""Xabar yuborish kanallari — email va SMS.

Ikkalasi ham interfeys sifatida ajratilgan: hozircha xabar logga yoziladi,
haqiqiy provayder (SMTP, Eskiz/Play Mobile va h.k.) ulanganda faqat shu
yerdagi implementatsiya almashtiriladi, chaqiruvchi kod o'zgarmaydi.
"""

import logging

logger = logging.getLogger("app.notify")


class MessageSender:
    async def send(self, *, to: str, subject: str, body: str) -> None:
        raise NotImplementedError


class ConsoleSender(MessageSender):
    def __init__(self, channel: str) -> None:
        self.channel = channel

    async def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info("%s -> %s | %s\n%s", self.channel.upper(), to, subject, body)


email_sender: MessageSender = ConsoleSender("email")
sms_sender: MessageSender = ConsoleSender("sms")


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
    hisoblagichi; bu esa qo'shimcha kanal (hozircha logda).
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
