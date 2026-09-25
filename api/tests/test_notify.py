"""Email/SMS yuborish klasslarining haqiqiy tarmoqqa chiqmasdan tekshiruvi.

`smtplib`/`httpx` chaqiruvlari mock qilingan — haqiqiy SMTP server yoki
Eskiz akkaunti kerak emas, faqat to'g'ri parametr bilan chaqirilgani va
javob to'g'ri talqin qilingani tekshiriladi.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.core.notify import EskizSmsSender, SmtpEmailSender


def test_smtp_email_sender_sends_via_smtplib() -> None:
    smtp_client = MagicMock()
    smtp_client.__enter__.return_value = smtp_client

    with (
        patch("app.core.notify.smtplib.SMTP", return_value=smtp_client) as smtp_cls,
        patch("app.core.notify.settings") as settings,
    ):
        settings.smtp_host = "smtp.example.com"
        settings.smtp_port = 587
        settings.smtp_username = "bot@example.com"
        settings.smtp_password = "secret"
        settings.smtp_from = "bot@example.com"
        settings.smtp_use_tls = True

        import asyncio

        asyncio.run(
            SmtpEmailSender().send(to="user@example.com", subject="Salom", body="Matn")
        )

    smtp_cls.assert_called_once_with("smtp.example.com", 587, timeout=10)
    smtp_client.starttls.assert_called_once()
    smtp_client.login.assert_called_once_with("bot@example.com", "secret")
    smtp_client.send_message.assert_called_once()
    sent = smtp_client.send_message.call_args[0][0]
    assert sent["To"] == "user@example.com"
    assert sent["Subject"] == "Salom"


def _response(status_code: int, url: str, **kwargs: object) -> httpx.Response:
    """`raise_for_status()` javobga bog'langan so'rovni talab qiladi."""
    return httpx.Response(status_code, request=httpx.Request("POST", url), **kwargs)


@pytest.mark.asyncio
async def test_eskiz_sms_sender_authenticates_then_sends() -> None:
    auth_response = _response(
        200, EskizSmsSender._AUTH_URL, json={"data": {"token": "tok123"}}
    )
    send_response = _response(200, EskizSmsSender._SEND_URL, json={"status": "ok"})

    with patch("app.core.notify.settings") as settings:
        settings.eskiz_email = "acc@example.com"
        settings.eskiz_password = "pw"
        settings.eskiz_from = "4546"

        sender = EskizSmsSender()
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(side_effect=[auth_response, send_response]),
        ) as mock_post:
            await sender.send(to="+998901234567", subject="x", body="Kod: 1234")

        assert mock_post.call_count == 2
        auth_call, send_call = mock_post.call_args_list
        assert auth_call.args[0] == EskizSmsSender._AUTH_URL
        assert send_call.args[0] == EskizSmsSender._SEND_URL
        assert send_call.kwargs["data"]["mobile_phone"] == "998901234567"
        assert sender._token == "tok123"


@pytest.mark.asyncio
async def test_eskiz_sms_sender_reauthenticates_on_401() -> None:
    expired_response = _response(401, EskizSmsSender._SEND_URL)
    auth_response = _response(
        200, EskizSmsSender._AUTH_URL, json={"data": {"token": "fresh-token"}}
    )
    send_response = _response(200, EskizSmsSender._SEND_URL, json={"status": "ok"})

    with patch("app.core.notify.settings") as settings:
        settings.eskiz_email = "acc@example.com"
        settings.eskiz_password = "pw"
        settings.eskiz_from = "4546"

        sender = EskizSmsSender()
        sender._token = "stale-token"
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(side_effect=[expired_response, auth_response, send_response]),
        ) as mock_post:
            await sender.send(to="+998901234567", subject="x", body="Kod: 1234")

        assert mock_post.call_count == 3
        assert sender._token == "fresh-token"
