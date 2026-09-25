import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from app.api.v1 import api_router
from app.core.config import settings
from app.core.exceptions import AppError

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
)
logger = logging.getLogger("app")

DESCRIPTION = """
Repetitor o'qituvchilar uchun guruh, davomat va to'lov boshqaruvi.

**Ruxsatlar**

* `teacher` — guruh, o'quvchi, davomat, to'lov, hisobot (faqat o'ziniki)
* `super_admin` — o'qituvchilarni boshqarish va platforma statistikasi
* `student` — hozircha faqat `/auth/me` va parol almashtirish

Barcha `/groups`, `/students`, `/payments`, `/reports` endpoint'lari
so'rov yuborgan o'qituvchining ma'lumoti bilan cheklangan. Begona resursga
murojaat `404` qaytaradi — resurs umuman ko'rinmasligi kerak.
"""

TAGS_METADATA = [
    {"name": "auth", "description": "Ro'yxatdan o'tish, kirish, parol"},
    {"name": "groups", "description": "Guruhlar va ularning o'quvchilari"},
    {"name": "students", "description": "O'qituvchining o'quvchilari"},
    {"name": "attendance", "description": "Kunlik davomat va uning tarixi"},
    {"name": "payments", "description": "Oylik hisoblar va to'lovlar"},
    {"name": "reports", "description": "Dashboard va hisobotlar"},
    {"name": "admin", "description": "Super Admin amallari"},
]

app = FastAPI(
    title=settings.app_name,
    description=DESCRIPTION,
    version="0.1.0",
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    """Domen xatoliklarini yagona shaklga keltiradi."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "detail": exc.message, "details": exc.details},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "code": "validation_error",
            "detail": "Yuborilgan ma'lumot noto'g'ri",
            "details": [
                {
                    "field": ".".join(str(part) for part in error["loc"][1:]),
                    "message": error["msg"],
                }
                for error in exc.errors()
            ],
        },
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError) -> JSONResponse:
    """Baza darajasidagi cheklovlar — oxirgi himoya chizig'i.

    Dublikat oldini olish qoidalari (bir oyga bitta to'lov, bir kunga bitta
    sessiya, bir guruhda bir o'quvchi) baza constraint'lari bilan
    kafolatlanadi; service qatlami ularni oldindan tekshirsa ham, poyga
    holatida shu handler ishlaydi.
    """
    logger.warning("IntegrityError: %s", exc.orig)
    return JSONResponse(
        status_code=409,
        content={
            "code": "conflict",
            "detail": "Bu yozuv allaqachon mavjud",
            "details": None,
        },
    )


# Yuklangan fayllar (profil rasmlari). Prod'da bu ishni nginx yoki S3
# bajaradi — o'shanda shu mount olib tashlanadi.
_media_root = Path(settings.media_root)
_media_root.mkdir(parents=True, exist_ok=True)
app.mount(settings.media_url, StaticFiles(directory=_media_root), name="media")


@app.get("/health", tags=["system"], summary="Tiriklik tekshiruvi")
async def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


app.include_router(api_router, prefix=settings.api_v1_prefix)


# Web ilova (`web/npm run build` natijasi). Mavjud bo'lsa backend o'zi
# beradi: bitta process, bitta origin — alohida nginx/CDN, CORS ham
# kerak emas. Papka topilmasa (masalan faqat API bilan ishlanadigan
# lokal dev'da) bu bo'lim jim o'tkazib yuboriladi, API o'zgarishsiz
# ishlayveradi.
#
# MUHIM: bu bo'lim eng oxirida ro'yxatdan o'tishi shart — Starlette
# marshrutlarni ro'yxatga qo'shilgan tartibda tekshiradi, shuning uchun
# `/{full_path:path}` yuqoridagi `/api/v1/...` va `/media` yo'llaridan
# keyin kelmasa, ularni "yutib" qo'yadi.
_web_dist = (Path(__file__).resolve().parent.parent / settings.web_dist_dir).resolve()
_web_assets = _web_dist / "assets"

if _web_dist.is_dir():
    if _web_assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_web_assets), name="web-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_web(full_path: str) -> FileResponse:
        """SPA fallback: haqiqiy fayl bo'lsa o'shani, aks holda `index.html`.

        React Router marshrutlashni brauzer tomonida qiladi (`/groups/5`
        kabi manzillar serverda alohida mavjud emas) — shuning uchun so'ralgan
        yo'lga mos fayl topilmasa (masalan sahifa yangilanganda) doim
        `index.html` qaytariladi, qolgan marshrutlashni frontend o'zi qiladi.
        """
        candidate = _web_dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_web_dist / "index.html")
