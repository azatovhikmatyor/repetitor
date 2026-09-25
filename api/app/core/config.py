from functools import lru_cache
from typing import Literal

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Application
    app_name: str = "Repetitor CRM API"
    environment: Literal["local", "test", "staging", "production"] = "local"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "repetitor"
    postgres_user: str = "repetitor"
    postgres_password: str = "repetitor"
    database_url_override: str | None = None

    # Security
    secret_key: str = "insecure-dev-key-change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    password_reset_expire_minutes: int = 30
    jwt_algorithm: str = "HS256"

    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 900

    # Yuklangan fayllar
    media_root: str = "media"
    media_url: str = "/media"
    max_avatar_bytes: int = 5 * 1024 * 1024

    # `npm run build` chiqargan web ilova (`web/dist`). Mavjud bo'lsa,
    # backend uni o'zi serve qiladi — alohida nginx/CDN shart emas.
    # Papka topilmasa (masalan lokal devda, faqat API bilan ishlaganda)
    # bu funksiya jim o'chadi, API oddiy ishlashda davom etadi.
    web_dist_dir: str = "../web/dist"

    # Localisation
    timezone: str = "Asia/Tashkent"
    currency: str = "UZS"

    # CORS
    cors_origins: str = ""

    # Yangi o'qituvchi haqida xabar boradigan admin email'lari (vergul bilan).
    admin_emails: str = ""

    # --- Email (SMTP) ---
    # Bo'sh qolsa (standart), xabarlar haqiqatan yuborilmaydi — faqat
    # loglarga yoziladi (dev/test uchun xavfsiz standart holat).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

    # --- SMS (Eskiz.uz) ---
    # Ikkalasi ham bo'lmasa SMS ham loglarga yoziladi, xuddi email kabi.
    eskiz_email: str = ""
    eskiz_password: str = ""
    eskiz_from: str = "4546"

    @computed_field
    @property
    def database_url(self) -> str:
        """Async driver URL used by the application."""
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field
    @property
    def sync_database_url(self) -> str:
        """Sync driver URL — Alembic uses this when running offline."""
        return self.database_url.replace("+asyncpg", "+psycopg")

    @computed_field
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @computed_field
    @property
    def admin_email_list(self) -> list[str]:
        return [e.strip() for e in self.admin_emails.split(",") if e.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
