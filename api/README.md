# Repetitor CRM — API

Repetitor o'qituvchilar uchun guruh, davomat va oylik to'lov boshqaruvi.
Bitta backend barcha clientlarga xizmat qiladi: web (React), mobil (Flutter),
keyinroq Telegram bot.

## Stek

| Qatlam | Texnologiya |
|---|---|
| Framework | FastAPI (async), Python 3.12+ |
| ORM / migratsiya | SQLAlchemy 2.x (async) + Alembic |
| Baza | PostgreSQL (testlarda SQLite) |
| Validatsiya | Pydantic v2 |
| Auth | JWT: access + bekor qilinadigan refresh |
| Parol | argon2id |

## Tez boshlash

```bash
cd api
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
cp .env.example .env          # SECRET_KEY ni o'zgartiring
docker compose up -d db
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m app.cli seed-demo          # demo ma'lumot (ixtiyoriy)
.venv/Scripts/python -m app.cli seed-teacher --username fteacher   # namuna tarix
.venv/Scripts/python -m uvicorn app.main:app --reload
```

Swagger: <http://localhost:8000/docs> · ReDoc: `/redoc` · Tiriklik: `/health`

Super admin yaratish:

```bash
.venv/Scripts/python -m app.cli create-admin --username admin --password <parol>
```

Testlar va linter (Postgres kerak emas — SQLite ustida ishlaydi):

```bash
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m ruff check app tests
```

## Arxitektura

Haqiqiy microservice emas — **modulli monolith**. Har bir modul o'z
`models / schemas / service / router` iga ega; biznes-mantiq `service` da,
router faqat HTTP bilan ishlaydi. Keyinchalik modulni alohida servisga
ajratish oson.

```
app/
  core/        config, security (JWT, argon2), clock (Asia/Tashkent),
               exceptions, pagination, rate_limit, email
  db/          Base + mixin, async session, registry (Alembic uchun)
  api/         deps.py (auth va rol tekshiruvi), v1.py (router yig'uvchi)
  modules/
    users/     User, RefreshToken, PasswordResetToken
    auth/      ro'yxat, login, refresh rotatsiyasi, parol oqimlari
    groups/    Group, Enrollment + guruh va o'quvchi boshqaruvi
    attendance/AttendanceSession, AttendanceRecord
    payments/  MonthlyCharge, Payment
    reports/   dashboard, oylik hisobot, tendentsiya, davomat hisoboti
    admin/     o'qituvchilarni boshqarish, platforma statistikasi
  cli.py       create-admin, seed-demo, seed-teacher
  sample_data.py  mavjud o'qituvchiga bir necha oylik namuna tarix
```

### Ma'lumot modeli

```
User(role: super_admin|teacher|student,
     status: pending|active|blocked,
     first_name + last_name + middle_name, username (unikal),
     teacher_id → o'quvchining ustozi)
  └── Group(teacher_id, monthly_fee, status: active|archived)
        └── Enrollment(group, student, custom_fee, status)   ← UI'da "guruhdagi o'quvchi"
              ├── AttendanceRecord ← AttendanceSession(group, session_date)
              └── MonthlyCharge(year, month, amount_due)
                    └── Payment(amount ±, method, paid_at, reverses_id)
```

Dublikat oldini olish baza darajasida kafolatlangan:
`UNIQUE(group_id, student_id)`, `UNIQUE(enrollment_id, year, month)`,
`UNIQUE(group_id, session_date)`, `UNIQUE(session_id, enrollment_id)`.

### Nega to'lov ikki jadvalda

`MonthlyCharge` — "qancha to'lashi kerak", `Payment` — "qancha pul keldi".

* Guruh narxi o'zgarsa o'tgan oylar o'zgarmaydi: `amount_due` hisob ochilgan
  paytda muzlatiladi.
* Qisman to'lov tabiiy chiqadi — bir hisobga bir nechta to'lov.
* To'lov **o'chirilmaydi**. Xato kiritilgan to'lov `reverses_id` bilan
  bog'langan manfiy summali yozuv orqali bekor qilinadi; ikkala yozuv ham
  tarixda qoladi. Balans har doim `SUM(payments.amount)`.
* Holat (`unpaid/partial/paid/overpaid`) saqlanmaydi — hisoblanadi, shuning
  uchun hech qachon eskirib qolmaydi.

Hisoblar **lazy** ochiladi: oy birinchi marta so'ralganda. Cron yoki fon
vazifasi kerak emas.

### Hisob hayotiy sikli

O'qituvchi o'zi ro'yxatdan o'tadi, lekin hisob `pending` holatida bo'ladi va
token qaytarilmaydi. Super admin tasdiqlagandan keyingina kira oladi.

```
ro'yxat → pending → (admin tasdiqlaydi) → active ⇄ blocked → (o'chirish)
```

* **Ism** uch bo'lakka ajratilgan (ism, familiya, sharifi), chunki bir xil
  ism-familiyali odamlar bo'lishi mumkin. Hisobning yagona identifikatori —
  `username`, u o'zgartirilmaydi.
* **Email va telefon ixtiyoriy.** Ularsiz parolni mustaqil tiklab bo'lmaydi:
  `/auth/password/forgot` shunda "administratorga murojaat qiling" deb
  javob beradi, admin esa `/admin/teachers/{id}/reset-password` orqali
  vaqtinchalik parol beradi.
* **Bloklash zanjirli:** o'qituvchi bloklansa, uning o'quvchilari ham
  tizimga kira olmaydi (`users.service.effective_status`).
* **O'chirish kaskad va qaytarilmas.** Avval `/admin/teachers/{id}/export`
  orqali zaxira nusxa olinadi, `/delete-preview` nima yo'qolishini
  ko'rsatadi, so'ng `DELETE ?confirm=<username>` hammasini o'chiradi:
  guruhlar, o'quvchi hisoblari, davomat va to'lov tarixi.

### Ruxsat va izolyatsiya

Tekshiruv `app/api/deps.py` da markazlashgan. Har bir o'qituvchi so'rovi
`teacher_id` bo'yicha filtrlanadi; begona resurs uchun javob **404** (403
emas — resurs umuman ko'rinmasligi kerak). Buni `tests/test_isolation.py`
tekshiradi.

`must_change_password=true` bo'lsa `/auth/me` va parol almashtirishdan
boshqa hamma narsa yopiq.

## Endpointlar (58 ta)

| Guruh | Endpointlar |
|---|---|
| auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET·PATCH /auth/me`, `POST·DELETE /auth/me/avatar`, `POST /auth/password/{forgot,reset,change}` |
| groups | `GET·POST /groups`, `GET·PATCH·DELETE /groups/{id}`, `POST /groups/{id}/{archive,unarchive}` |
| jadval | `GET·PUT /groups/{id}/schedule`, `GET /groups/{id}/schedule/lessons` |
| guruhdagi o'quvchilar | `GET·POST /groups/{id}/students`, `PATCH·DELETE /groups/{id}/students/{sid}` |
| students | `GET /students`, `GET·PATCH /students/{id}`, `POST /students/{id}/reset-password`, `POST·DELETE /students/{id}/avatar` |
| attendance | `GET·PUT /groups/{id}/attendance`, `GET /groups/{id}/attendance/monthly`, `GET /students/{id}/attendance` |
| payments | `GET·POST /groups/{id}/payments`, `GET /groups/{id}/payments/history`, `GET /payments/{id}`, `POST /payments/{id}/reverse`, `GET /students/{id}/payments` |
| reports | `GET /reports/{dashboard,monthly,revenue-trend,attendance,debtors}` |
| admin | `GET /admin/teachers`, `GET /admin/teachers/pending-count`, `POST /admin/teachers/{id}/{approve,block,unblock,reset-password}`, `GET /admin/teachers/{id}/{delete-preview,export}`, `DELETE /admin/teachers/{id}`, `GET /admin/stats` |

### O'quvchi maydonlari

Barchasi `users` jadvalida — o'quvchi ham shu yerda yashaydi:

```
identifikatsiya  first_name, last_name, middle_name, username, phone, email
hisob            password_hash, status, must_change_password, last_login_at
rasm             avatar_url
karta            birth_date, parent_name, parent_phone, school, note
bog'lanish       teacher_id (kim yaratgan — izolyatsiya va bloklash zanjiri)
```

Oxirgi to'rtta guruh faqat o'quvchi rolida to'ldiriladi (`teacher_id`
kabi) — shuning uchun alohida jadval qilinmadi.

Rasmni **o'qituvchi** yuklaydi (`POST /students/{id}/avatar`), o'quvchining
o'zi tizimga kirishi shart emas. Tekshiruv va kichraytirish profil rasmi
bilan bir xil (`app/core/storage.py`).

### Dars jadvali

Jadval **versiyalangan**: har bir tahrir yangi `ScheduleVersion` ochadi,
eskisi `effective_to` bilan yopiladi. Sabab — jadval bitta bo'lsa, uni
o'zgartirgan zahoti o'tgan oylarning "rejadagi darslari" ham o'zgarib
ketardi.

```
ScheduleVersion(group_id, effective_from, effective_to)
  └── ScheduleSlot(weekday 0-6, start_time, end_time)
```

Bir kunda bir nechta slot bo'lishi mumkin va har kuni o'z vaqtida —
unikallik `(version, weekday, start_time)` bo'yicha.

`AttendanceSession` dars vaqtini **ko'chirib** oladi (`start_time`),
`slot_id` esa faqat ma'lumot uchun. Shuning uchun jadval keyin o'zgarsa
ham o'tgan darsning vaqti o'zgarmaydi. Sessiya unikalligi endi
`(group, date, coalesce(start_time,'00:00'))` — bir kunga ikki dars
sig'adi. Vaqtsiz sessiya "jadvalsiz dars" (eski yozuvlar va jadval
kiritilmagan guruhlar).

`groups.schedule` ustuni endi **kesh**: amaldagi versiyadan hosil
qilinadigan qisqa matn (`Du/Chor 08:00`), ro'yxat so'rovlarida slotlarni
yuklamaslik uchun.

### Alohida narx (chegirma va bepul o'qish)

Har bir `Enrollment` o'z narxiga ega bo'lishi mumkin:

| `custom_fee` | ma'nosi |
|---|---|
| `null` | guruh narxi (guruh narxi o'zgarsa bu ham o'zgaradi) |
| `250000` | shu o'quvchi uchun alohida summa |
| `0` | bepul o'qiydi — hisob ochiladi, lekin summasi 0 |

`fee_note` — nega chegirma berilgani (bir necha oydan keyin esda
qolmaydi). `GroupStudentOut` `discount` (guruh narxidan farq) va
`GroupOut` `expected_monthly` (alohida narxlar hisobga olingan oylik
kutilma) qaytaradi — "o'quvchi soni × narx" noto'g'ri bo'ladi.

Bepul o'quvchi **qarzdor emas**: `amount_due = 0` va to'lovsiz ham hisob
`paid` holatida, qarzdorlar ro'yxatiga tushmaydi.

Narx o'zgarganda o'tgan oylar tegilmaydi (`amount_due` muzlatilgan). Joriy
oy esa `apply_current_month: true` bilan yangilanadi — **agar shu oyda
hali to'lov bo'lmagan bo'lsa**. Kelishuv odatda oy boshida bo'ladi,
shuning uchun bu standart holat.

### Davomat oqimi

`GET /groups/{id}/attendance` — hamma `present` holatida qaytadi.
`PUT` ga **faqat kelmaganlar** yuboriladi:

```json
{ "session_date": "2026-09-21", "records": [{"student_id": 12, "status": "absent"}] }
```

30 kishilik guruhda 5 ta kelmagan bo'lsa — so'rovda 5 ta element. Amal
idempotent: qayta yuborilsa o'sha sessiya yangilanadi.

## Qabul qilingan qarorlar

Talablarda ochiq qolgan yoki tanlov talab qilgan joylar — tasdiqlashingiz
uchun:

1. **O'qituvchi o'zi ro'yxatdan o'tadi, lekin super admin tasdiqlaydi.**
   Yangi o'qituvchi haqidagi bildirishnoma admin panelidagi "Tasdiq
   kutmoqda" ro'yxati va hisoblagichi orqali beriladi; `ADMIN_EMAILS`
   sozlangan bo'lsa email ham yuboriladi (hozircha logga).
2. **Super admin o'qituvchi endpointlariga kira olmaydi.** Talabda
   "texnik jihatdan kira oladi" deyilgan, lekin 9-bo'limda "alohida
   o'qituvchining aniq daromadini ko'rmaydi" deyilgan. Qat'iyroq variant
   tanlandi — `/admin/*` alohida va moliyaviy raqamlarsiz.
3. **"Bugungi darslar" o'rniga "bugun davomat qilinmagan guruhlar."**
   Guruhning `schedule` maydoni erkin matn (talab: alohida jadval entity
   yo'q), shuning uchun "bugun dars bormi" ni hisoblab bo'lmaydi.
   Strukturali jadval kerak bo'lsa alohida model qo'shiladi.
4. **Davomat ro'yxati `joined_on` bo'yicha filtrlanmaydi.** O'qituvchi
   ilovani bugun o'rnatib o'tgan hafta davomatini kiritishi odatiy holat.
   To'lovda esa `joined_on` qat'iy hisobga olinadi — u pul masalasi.
5. **Telefon/username/email butun platforma bo'ylab unikal.** Dublikat
   account oldini oladi; xatolik xabari neytral, boshqa o'qituvchining
   o'quvchisi borligini oshkor qilmaydi.
6. **To'lov davri** o'tgan, joriy va kelasi oy bilan cheklangan (12-bo'lim).
7. **O'qituvchini o'chirish kaskad.** Talablar hujjatining 12-bo'limida
   "MVP'da account o'chirish yo'q" deyilgan, lekin mahsulot egasi buni
   ataylab o'zgartirdi: o'chirishdan oldin zaxira nusxa olinadi va
   username qo'lda yozib tasdiqlanadi.

## Hali qilinmagan

* **Email va SMS** — `app/core/notify.py` da interfeys bor, MVP
  implementatsiyasi xabarni logga yozadi. SMTP yoki SMS provayderi
  (Eskiz, Play Mobile) qo'shilganda faqat shu klasslar almashtiriladi.
  Parol tiklash kodi hozircha loglarda ko'rinadi.
* **Profil rasmi saqlash joyi** — hozircha lokal disk (`MEDIA_ROOT`,
  standart `./media`), FastAPI uni `/media` ostida beradi. Prod'da bu
  S3 yoki nginx'ga o'tadi: faqat `app/core/storage.py` almashtiriladi.
* **Rate limit** jarayon xotirasida (`app/core/rate_limit.py`). Bir nechta
  worker bilan ishlaganda Redis implementatsiyasi kerak — interfeys tayyor.
* **Redis, PWA/offline, eksport (PDF), test moduli, material/blog,
  bildirishnoma, Telegram bot** — talabning keyingi bosqichlari. Model va
  API ularni buzmasdan qo'shadigan qilib loyihalangan (o'quvchi hozirdanoq
  alohida account).
* **Audit** hozircha `created_by_id` + o'zgarmas to'lov yozuvlari
  darajasida. To'liq audit log alohida modul bo'ladi.

## Sinov holati

```
51 passed   — ro'yxat/tasdiqlash oqimi, bloklash zanjiri, parol tiklash
              kanallari, avatar yuklash, zaxira nusxa va kaskad o'chirish,
              ma'lumot izolyatsiyasi, guruh/o'quvchi, davomat, to'lov,
              hisobotlar
ruff        — toza
alembic     — bitta migratsiya; Postgres DDL tekshirilgan
```

**Diqqat:** ism/username/status o'zgarishi bilan `alembic/versions` dagi
migratsiya qayta yaratilgan (loyihada faqat demo ma'lumot bor edi). Agar
sizda saqlanishi kerak bo'lgan baza bo'lsa, uni qo'lda migratsiya qilish
kerak.

Jonli tekshiruv (demo ma'lumot bilan): 43 endpoint, dashboard raqamlari
oylik hisobot bilan mos, `/admin/*` o'qituvchi uchun 403.
