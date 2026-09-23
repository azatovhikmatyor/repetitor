"""Test muhiti.

Testlar SQLite (aiosqlite) ustida ishlaydi — tez va tashqi xizmatsiz.
Sxema `Base.metadata` dan yaratiladi, shuning uchun modellar va constraint'lar
xuddi Postgres'dagidek tekshiriladi (UNIQUE va CHECK ikkalasida ham bor).
"""

import os
import tempfile
from collections.abc import AsyncGenerator
from pathlib import Path

# Testlar yuklagan fayllar loyihaning `media/` papkasiga tushmasligi uchun
# vaqtinchalik katalog ishlatiladi. Sozlama `Settings` o'qilishidan oldin
# qo'yilishi shart.
_MEDIA_DIR = Path(tempfile.mkdtemp(prefix="repetitor-test-media-"))
os.environ.setdefault("MEDIA_ROOT", str(_MEDIA_DIR))

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DEBUG", "false")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL_OVERRIDE", "sqlite+aiosqlite:///:memory:")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.registry import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.users.models import User, UserRole, UserStatus  # noqa: E402

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin12345"


@pytest_asyncio.fixture
async def engine():
    # StaticPool: SQLite'ning :memory: bazasi ulanishga bog'liq, shuning
    # uchun barcha sessiyalar bitta ulanishdan foydalanishi shart.
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(session_factory) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient, session_factory) -> dict:
    """Super admin — o'qituvchilarni tasdiqlaydigan rol.

    CLI orqali emas, to'g'ridan-to'g'ri bazaga yoziladi: platformada
    birinchi admin shu tarzda paydo bo'ladi.
    """
    async with session_factory() as session:
        session.add(
            User(
                role=UserRole.SUPER_ADMIN,
                status=UserStatus.ACTIVE,
                first_name="Super",
                last_name="Admin",
                username=ADMIN_USERNAME,
                password_hash=hash_password(ADMIN_PASSWORD),
            )
        )
        await session.commit()

    response = await client.post(
        "/auth/login", json={"login": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    from app.core.rate_limit import login_limiter

    login_limiter._hits.clear()  # type: ignore[attr-defined]
    yield


# ------------------------------------------------------------ yordamchilar


async def register_teacher(
    client: AsyncClient,
    *,
    username: str = "ustoz",
    first_name: str = "Dilshod",
    last_name: str = "Karimov",
    password: str = "parol12345",
    email: str | None = None,
    phone: str | None = None,
) -> dict:
    """Ro'yxatdan o'tadi. Hisob hali `pending` — tokenlar qaytmaydi."""
    response = await client.post(
        "/auth/register",
        json={
            "first_name": first_name,
            "last_name": last_name,
            "username": username,
            "password": password,
            "password_confirm": password,
            **({"email": email} if email else {}),
            **({"phone": phone} if phone else {}),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def approved_teacher(
    client: AsyncClient,
    admin_headers: dict,
    *,
    username: str = "ustoz",
    password: str = "parol12345",
    **kwargs,
) -> tuple[dict, dict]:
    """Ro'yxatdan o'tadi, admin tasdiqlaydi va kiradi.

    (headers, user) qaytaradi — testlarning aksariyati shundan boshlanadi.
    """
    registered = await register_teacher(
        client, username=username, password=password, **kwargs
    )

    approve = await client.post(
        f"/admin/teachers/{registered['user_id']}/approve", headers=admin_headers
    )
    assert approve.status_code == 200, approve.text

    login = await client.post(
        "/auth/login", json={"login": username, "password": password}
    )
    assert login.status_code == 200, login.text
    body = login.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]


async def create_group(
    client: AsyncClient, headers: dict, *, name: str = "Guruh", fee: int = 500_000
) -> dict:
    response = await client.post(
        "/groups", json={"name": name, "monthly_fee": fee}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


async def add_student(
    client: AsyncClient,
    headers: dict,
    group_id: int,
    *,
    first_name: str,
    phone: str,
    last_name: str | None = None,
) -> dict:
    response = await client.post(
        f"/groups/{group_id}/students",
        json={
            "first_name": first_name,
            "phone": phone,
            **({"last_name": last_name} if last_name else {}),
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()
