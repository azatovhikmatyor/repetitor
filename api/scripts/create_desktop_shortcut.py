"""Desktop'da "Repetitor" nomli ikonka (yorliq) yaratadi.

Ishga tushirish (bir marta, `api/` papkasidan):

    .venv\\Scripts\\python.exe scripts\\create_desktop_shortcut.py

Yorliq bosilganda `desktop.py` `pythonw.exe` orqali ishga tushadi
(konsol oynasi chiqmaydi) va ilova alohida oynada ochiladi.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

API_DIR = Path(__file__).resolve().parent.parent
ICON_PATH = API_DIR / "desktop_icon.ico"

# Ilovaning o'zidagi logo bilan bir xil: yashil dumaloq kvadrat + oq "R"
# (web/src/components/layout/app-shell.tsx dagi "R" belgisi, brand-600 rangi).
BRAND_GREEN = (26, 122, 82, 255)


def _make_icon() -> None:
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=size // 5, fill=BRAND_GREEN
    )

    try:
        font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(size * 0.55))
    except OSError:
        font = ImageFont.load_default()

    text = "R"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - text_w) / 2 - bbox[0], (size - text_h) / 2 - bbox[1]),
        text,
        font=font,
        fill=(255, 255, 255, 255),
    )

    img.save(ICON_PATH, sizes=[(16, 16), (32, 32), (48, 48), (128, 128), (256, 256)])


def _make_shortcut() -> Path:
    pythonw = API_DIR / ".venv" / "Scripts" / "pythonw.exe"
    if not pythonw.exists():
        raise SystemExit(f"pythonw.exe topilmadi: {pythonw}")

    desktop = Path.home() / "Desktop"
    desktop.mkdir(exist_ok=True)
    shortcut_path = desktop / "Repetitor.lnk"

    # WScript.Shell COM obyekti — Windows'da .lnk yaratishning standart yo'li,
    # qo'shimcha pip paket (pywin32) talab qilmaydi.
    ps_script = f"""
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('{shortcut_path}')
$s.TargetPath = '{pythonw}'
$s.Arguments = '"{API_DIR / "desktop.py"}"'
$s.WorkingDirectory = '{API_DIR}'
$s.IconLocation = '{ICON_PATH}'
$s.Description = 'Repetitor CRM — vaqtincha desktop rejimida'
$s.Save()
"""
    subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
        check=True,
    )
    return shortcut_path


def main() -> None:
    _make_icon()
    shortcut = _make_shortcut()
    print(f"Ikonka: {ICON_PATH}")
    print(f"Yorliq yaratildi: {shortcut}")
    print("Endi Desktop'dagi 'Repetitor' ikonkasiga ikki marta bosing.")


if __name__ == "__main__":
    main()
