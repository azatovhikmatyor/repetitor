"""Ilovani vaqtincha "desktop app" sifatida ishga tushirish.

`web/dist` (`npm run build` natijasi) mavjud bo'lishi shart — backend
uni o'zi serve qiladi (`app/main.py`dagi SPA fallback, "Deploy" bo'limiga
qarang: `README.md`). Bu skript qo'shimcha ravishda:

1. uvicorn serverni background thread'da ko'taradi (brauzer o'rniga
   alohida oyna ochish uchun asosiy thread bo'sh turishi kerak);
2. natijani pywebview orqali native oynada ochadi — URL satri, tablar
   yo'q, xuddi oddiy desktop dastur kabi;
3. oyna yopilganda serverni ham to'xtatadi.

Ishga tushirish:

    .venv\\Scripts\\python.exe desktop.py

Yoki Desktop'dagi yorliq orqali (`scripts/create_desktop_shortcut.py`
bilan yaratiladi).
"""

from __future__ import annotations

import contextlib
import ctypes
import sys
import threading
import time
from pathlib import Path

import uvicorn
import webview

# Odatiy dev portlar (backend 8000, Vite 5174) bilan to'qnashmasligi
# uchun boshqa port — bu skript ular bilan bir vaqtda ham ishlaydi.
HOST = "127.0.0.1"
PORT = 8765

# `scripts/create_desktop_shortcut.py` shuni generatsiya qiladi.
ICON_PATH = Path(__file__).resolve().parent / "desktop_icon.ico"

# Server ishga tushishini kutish uchun maksimal vaqt (masalan port band
# bo'lsa, cheksiz kutib qolmaslik uchun).
STARTUP_TIMEOUT_SECONDS = 10


def _dist_ready() -> Path | None:
    from app.core.config import settings

    dist = (Path(__file__).resolve().parent / settings.web_dist_dir).resolve()
    return dist if (dist / "index.html").is_file() else None


def _fix_taskbar_icon() -> None:
    """Taskbar hali `pythonw.exe`ning umumiy ikonkasini ko'rsatishining sababi:

    Windows taskbar ikonkasini odatda ishga tushirgan `.exe`ga (bu yerda
    `pythonw.exe`) qarab guruhlaydi, `Form.Icon` esa faqat sarlavha panelini
    o'zgartiradi. "AppUserModelID"ni o'zimiznikiga o'rnatsak, Windows bu
    jarayonni alohida ilova deb hisoblaydi va taskbar'da ham bizning
    ikonkamizni ko'rsatadi.
    """
    if sys.platform != "win32":
        return
    with contextlib.suppress(OSError):
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            "Repetitor.DesktopApp"
        )


def main() -> None:
    _fix_taskbar_icon()

    dist = _dist_ready()
    if dist is None:
        print(
            "web/dist topilmadi — avval frontend'ni build qiling:\n"
            "  cd ../web && npm run build"
        )
        sys.exit(1)

    from app.main import app

    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="warning")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    while not server.started:
        if not thread.is_alive():
            print(f"{PORT}-port band ko'rinadi — serverni ko'tarib bo'lmadi.")
            sys.exit(1)
        if time.monotonic() > deadline:
            print("Server juda uzoq ishga tushmadi.")
            sys.exit(1)
        time.sleep(0.05)

    webview.create_window(
        "Repetitor",
        f"http://{HOST}:{PORT}",
        width=1280,
        height=800,
        min_size=(960, 640),
        # To'liq ekranda ochiladi, lekin sarlavha paneli (yopish tugmasi)
        # ko'rinib turadi — haqiqiy borderless fullscreen emas, shunga
        # o'xshash, faqat "chiqib bo'lmay qolish" xavfisiz.
        maximized=True,
    )
    icon = str(ICON_PATH) if ICON_PATH.is_file() else None
    webview.start(icon=icon)

    # Oyna yopildi — server ham shu bilan to'xtaydi.
    server.should_exit = True
    thread.join(timeout=5)


if __name__ == "__main__":
    main()
