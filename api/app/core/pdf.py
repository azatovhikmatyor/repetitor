"""Kvitansiya va oylik hisobotni PDF fayl sifatida chiqarish.

Brauzerning "Chop etish → PDF saqlash" imkoniyati mavjud (frontend'da
`Printable` komponenti), lekin bu haqiqiy fayl beradi — email'ga
biriktirish, arxivlash yoki ota-onaga to'g'ridan-to'g'ri yuborish uchun
qulayroq. `reportlab` sof Python, tashqi tizim kutubxonasi (masalan
wkhtmltopdf) talab qilmaydi.
"""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.modules.payments import schemas as payment_schemas
from app.modules.reports import schemas as report_schemas

_MONTH_NAMES = [
    "",
    "Yanvar",
    "Fevral",
    "Mart",
    "Aprel",
    "May",
    "Iyun",
    "Iyul",
    "Avgust",
    "Sentabr",
    "Oktabr",
    "Noyabr",
    "Dekabr",
]

_METHOD_LABELS = {
    "cash": "Naqd",
    "card": "Karta",
    "transfer": "O'tkazma",
    "other": "Boshqa",
}

_INK = colors.HexColor("#0f172a")
_MUTED = colors.HexColor("#64748b")
_LINE = colors.HexColor("#e2e8f0")


def month_name(month: int) -> str:
    return _MONTH_NAMES[month]


def money(amount: int) -> str:
    """`500000` -> `"500 000"` — frontend bilan bir xil ko'rinish."""
    return f"{amount:,}".replace(",", " ")


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "DocTitle", parent=base["Heading1"], fontSize=16, spaceAfter=2
        ),
        "small": ParagraphStyle(
            "Small", parent=base["Normal"], fontSize=9, textColor=_MUTED
        ),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontSize=12, spaceBefore=8),
    }


def build_receipt_pdf(
    *, payment: payment_schemas.PaymentOut, teacher_name: str
) -> bytes:
    """Bitta to'lov uchun kvitansiya — `receipt-modal.tsx` bilan bir xil ma'lumot."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=25 * mm,
        bottomMargin=25 * mm,
        leftMargin=25 * mm,
        rightMargin=25 * mm,
        title="To'lov kvitansiyasi",
    )
    styles = _styles()
    number = f"{payment.year}{payment.month:02d}-{payment.id}"

    elements = [
        Paragraph("To'lov kvitansiyasi", styles["title"]),
        Paragraph(
            f"No {number} · {payment.paid_at.strftime('%d.%m.%Y %H:%M')}",
            styles["small"],
        ),
        Spacer(1, 10 * mm),
    ]

    method = (
        payment.method.value if hasattr(payment.method, "value") else payment.method
    )
    rows = [
        ["O'quvchi", payment.full_name],
        ["Guruh", payment.group_name],
        ["Davr", f"{month_name(payment.month)} {payment.year}"],
        ["To'lov usuli", _METHOD_LABELS.get(method, method)],
    ]
    if payment.note:
        rows.append(["Izoh", payment.note])

    info_table = Table(rows, colWidths=[40 * mm, 110 * mm])
    info_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("TEXTCOLOR", (0, 0), (0, -1), _MUTED),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -2), 0.4, _LINE),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 8 * mm))

    amount_table = Table(
        [["Summa", f"{money(payment.amount)} so'm"]], colWidths=[40 * mm, 110 * mm]
    )
    amount_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 14),
                ("FONTNAME", (1, 0), (1, 0), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("LINEABOVE", (0, 0), (-1, 0), 0.8, _INK),
            ]
        )
    )
    elements.append(amount_table)
    elements.append(Spacer(1, 15 * mm))
    elements.append(Paragraph(f"Qabul qildi: {teacher_name}", styles["small"]))

    doc.build(elements)
    return buffer.getvalue()


def build_monthly_report_pdf(
    *,
    report: report_schemas.MonthlyReportOut,
    attendance: report_schemas.AttendanceReportOut | None,
    teacher_name: str,
) -> bytes:
    """Oylik moliyaviy hisobot — `PrintableReport` (frontend) bilan bir xil tarkib."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title="Oylik hisobot",
    )
    styles = _styles()

    elements = [
        Paragraph("Oylik hisobot", styles["title"]),
        Paragraph(
            f"{month_name(report.month)} {report.year} — {teacher_name}",
            styles["small"],
        ),
        Spacer(1, 8 * mm),
    ]

    data = [["Guruh", "O'quvchi", "Kutilgan", "Yig'ilgan", "Qarz"]]
    for group in report.groups:
        data.append(
            [
                group.group_name,
                str(group.student_count),
                money(group.total_due),
                money(group.total_paid),
                money(group.total_debt),
            ]
        )
    data.append(
        [
            "JAMI",
            "",
            money(report.total_due),
            money(report.total_paid),
            money(report.total_debt),
        ]
    )

    table = Table(
        data, colWidths=[55 * mm, 25 * mm, 30 * mm, 30 * mm, 30 * mm], repeatRows=1
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, _INK),
                ("LINEABOVE", (0, -1), (-1, -1), 0.6, _INK),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 6 * mm))

    totals = Table(
        [
            ["Xarajat", f"{money(report.total_expenses)} so'm"],
            ["Foyda", f"{money(report.profit)} so'm"],
        ],
        colWidths=[100 * mm, 40 * mm],
    )
    totals.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ]
        )
    )
    elements.append(totals)

    if attendance and attendance.groups:
        elements.append(Spacer(1, 8 * mm))
        elements.append(Paragraph("Davomat", styles["h2"]))
        att_data = [["Guruh", "Darslar", "Foiz"]]
        for group in attendance.groups:
            att_data.append(
                [
                    group.group_name,
                    f"{group.session_count} dars",
                    f"{group.attendance_rate:.0f}%",
                ]
            )
        att_table = Table(att_data, colWidths=[80 * mm, 45 * mm, 45 * mm])
        att_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ]
            )
        )
        elements.append(att_table)

    elements.append(Spacer(1, 20 * mm))
    signature = Table(
        [["Sana: ____________", "Imzo: ____________"]], colWidths=[80 * mm, 80 * mm]
    )
    signature.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 10)]))
    elements.append(signature)

    doc.build(elements)
    return buffer.getvalue()
