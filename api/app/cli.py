"""Boshqaruv buyruqlari.

python -m app.cli create-admin --username admin --password ...
python -m app.cli seed-demo
python -m app.cli seed-teacher --username fteacher
"""

import argparse
import asyncio
import random
from datetime import timedelta

from sqlalchemy import select

from app.core.clock import current_period, local_today, shift_period, utc_now
from app.core.security import hash_password
from app.db.registry import (
    AttendanceRecord,
    AttendanceSession,
    Enrollment,
    Group,
    MonthlyCharge,
    Payment,
    User,
)
from app.db.session import SessionLocal
from app.modules.attendance.models import AttendanceStatus
from app.modules.payments.models import PaymentMethod
from app.modules.users.models import UserRole, UserStatus
from app.sample_data import seed_teacher


async def create_admin(
    username: str, password: str, first_name: str, last_name: str, email: str | None
) -> None:
    username = username.strip().lower()
    async with SessionLocal() as db:
        existing = await db.scalar(select(User).where(User.username == username))
        if existing is not None:
            print(f"'{username}' allaqachon mavjud (id={existing.id})")
            return
        db.add(
            User(
                role=UserRole.SUPER_ADMIN,
                status=UserStatus.ACTIVE,
                first_name=first_name,
                last_name=last_name,
                username=username,
                email=email.lower() if email else None,
                password_hash=hash_password(password),
            )
        )
        await db.commit()
        print(f"Super admin yaratildi: {username}")


async def seed_demo() -> None:
    """Bitta o'qituvchi, ikki guruh, o'quvchilar, davomat va to'lovlar.

    Qayta ishga tushirilsa hech narsa qilmaydi — demo o'qituvchi mavjud
    bo'lsa chiqib ketadi.
    """
    demo_username = "ustoz"
    async with SessionLocal() as db:
        if await db.scalar(select(User).where(User.username == demo_username)):
            print("Demo ma'lumot allaqachon mavjud")
            return

        teacher = User(
            role=UserRole.TEACHER,
            status=UserStatus.ACTIVE,
            first_name="Dilshod",
            last_name="Karimov",
            middle_name="Anvarovich",
            username=demo_username,
            email="ustoz@example.com",
            phone="+998901234567",
            password_hash=hash_password("ustoz12345"),
        )
        db.add(teacher)
        await db.flush()

        today = local_today()
        year, month = current_period()
        groups = []
        for name, fee, schedule in [
            ("IELTS ertalabki", 500_000, "Du/Chor/Ju 08:00"),
            ("Matematika 9-sinf", 350_000, "Se/Pay 15:00"),
        ]:
            group = Group(
                teacher_id=teacher.id,
                name=name,
                monthly_fee=fee,
                schedule=schedule,
                description=f"{name} — demo guruh",
            )
            db.add(group)
            groups.append(group)
        await db.flush()

        names = [
            ("Aziza", "Rahimova"),
            ("Bekzod", "To'rayev"),
            ("Dilnoza", "Yusupova"),
            ("Eldor", "Qosimov"),
            ("Feruza", "Abdullayeva"),
            ("G'ayrat", "Sharipov"),
            ("Hilola", "Nazarova"),
            ("Islom", "Tursunov"),
        ]
        enrollments: list[Enrollment] = []
        for index, (first_name, last_name) in enumerate(names):
            student = User(
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
                first_name=first_name,
                last_name=last_name,
                phone=f"+99890{1000000 + index}",
                password_hash=hash_password("demo12345"),
                must_change_password=True,
                teacher_id=teacher.id,
            )
            db.add(student)
            await db.flush()

            group = groups[index % len(groups)]
            enrollment = Enrollment(
                group_id=group.id,
                student_id=student.id,
                joined_on=today - timedelta(days=60),
                custom_fee=300_000 if index == 0 else None,
            )
            db.add(enrollment)
            enrollments.append(enrollment)
        await db.flush()

        # Oxirgi ikki oy uchun hisob va to'lovlar.
        for offset in (1, 0):
            period_year, period_month = shift_period(year, month, -offset)
            for enrollment in enrollments:
                group = next(g for g in groups if g.id == enrollment.group_id)
                charge = MonthlyCharge(
                    enrollment_id=enrollment.id,
                    year=period_year,
                    month=period_month,
                    amount_due=enrollment.custom_fee or group.monthly_fee,
                )
                db.add(charge)
                await db.flush()

                roll = random.random()
                if roll < 0.6:
                    amount = charge.amount_due
                elif roll < 0.8:
                    amount = charge.amount_due // 2
                else:
                    amount = 0
                if amount:
                    db.add(
                        Payment(
                            charge_id=charge.id,
                            amount=amount,
                            method=random.choice(list(PaymentMethod)),
                            paid_at=utc_now() - timedelta(days=offset * 30),
                            created_by_id=teacher.id,
                        )
                    )

        # Oxirgi 10 kunlik davomat.
        for group in groups:
            group_enrollments = [e for e in enrollments if e.group_id == group.id]
            for day_offset in range(10):
                session = AttendanceSession(
                    group_id=group.id, session_date=today - timedelta(days=day_offset)
                )
                db.add(session)
                await db.flush()
                for enrollment in group_enrollments:
                    db.add(
                        AttendanceRecord(
                            session_id=session.id,
                            enrollment_id=enrollment.id,
                            status=(
                                AttendanceStatus.ABSENT
                                if random.random() < 0.15
                                else AttendanceStatus.PRESENT
                            ),
                        )
                    )

        await db.commit()
        print(f"Demo tayyor. Kirish: {demo_username} / ustoz12345")


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    admin = sub.add_parser("create-admin", help="Super admin yaratish")
    admin.add_argument("--username", required=True)
    admin.add_argument("--password", required=True)
    admin.add_argument("--first-name", default="Super")
    admin.add_argument("--last-name", default="Admin")
    admin.add_argument("--email", default=None)

    sub.add_parser("seed-demo", help="Demo ma'lumot to'ldirish")

    sample = sub.add_parser(
        "seed-teacher", help="Mavjud o'qituvchiga namuna ma'lumot qo'shish"
    )
    sample.add_argument("--username", required=True)

    args = parser.parse_args()
    if args.command == "create-admin":
        asyncio.run(
            create_admin(
                args.username,
                args.password,
                args.first_name,
                args.last_name,
                args.email,
            )
        )
    elif args.command == "seed-teacher":
        asyncio.run(seed_teacher(args.username))
    else:
        asyncio.run(seed_demo())


if __name__ == "__main__":
    main()
