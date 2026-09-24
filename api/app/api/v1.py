"""v1 API — modul router'larini bitta joyda yig'adi."""

from fastapi import APIRouter

from app.modules.admin.router import router as admin_router
from app.modules.attendance.router import router as attendance_router
from app.modules.auth.router import router as auth_router
from app.modules.expenses.router import router as expenses_router
from app.modules.groups.router import router as groups_router
from app.modules.groups.router import students_router
from app.modules.payments.router import router as payments_router
from app.modules.reports.router import router as reports_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(groups_router)
api_router.include_router(students_router)
# Davomat va to'lov router'lari `/groups/...` va `/students/...` ostida
# ham endpoint qo'shadi — shuning uchun ular o'z prefiksini o'zi belgilaydi.
api_router.include_router(attendance_router)
api_router.include_router(payments_router)
api_router.include_router(expenses_router)
api_router.include_router(reports_router)
api_router.include_router(admin_router)
