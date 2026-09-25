# Repetitor — web ilova (React)

`app/api` dagi FastAPI backend'ining web clienti. Bitta ilova ikki rolga
xizmat qiladi: **o'qituvchi** (guruh, davomat, to'lov, hisobot) va
**super admin** (o'qituvchilarni boshqarish, platforma statistikasi).

Mobil ilova telefon uchun mo'ljallangan, bu esa desktop uchun: keng
jadvallar, bir ekranda ko'proq ma'lumot, klaviatura bilan ishlash.

## Stek

| Qatlam | Texnologiya |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript (strict) |
| Stil | Tailwind CSS v4 (CSS-first, konfiguratsiyasiz) |
| Server holati | TanStack Query v5 |
| Navigatsiya | React Router v8 (data router) |
| Komponentlar | Loyihaning o'z to'plami (`src/components/ui`) |

Tashqi UI kutubxona qo'shilmadi — dizayn mobil ilova bilan bir xil tilda
qolishi va bundle kichik bo'lishi uchun. Modal uchun native `<dialog>`,
grafik uchun oddiy `div` ustunlar ishlatilgan.

## Ishga tushirish

Backend ishlab turgani holda (`cd ../api && make run`):

```bash
cd web
npm install
npm run dev
```

<http://localhost:5174> ochiladi.

**CORS kerak emas:** Vite dev-server `/api` so'rovlarini backend'ga proxy
qiladi (`vite.config.ts`), shuning uchun brauzer uchun origin bir xil.
Backend boshqa manzilda bo'lsa:

```bash
VITE_API_TARGET=http://127.0.0.1:9000 npm run dev
```

Prod build uchun ikki yo'l bor:

* **Alohida domenlar** (frontend CDN/static hosting'da, backend boshqa
  joyda) — backend manzili `VITE_API_URL` orqali beriladi va backend'da
  `CORS_ORIGINS`ga frontend domeni qo'shiladi:

  ```bash
  VITE_API_URL=https://api.example.uz/api/v1 npm run build
  ```

* **Bitta process** (tavsiya — kichik loyiha uchun soddaroq): `VITE_API_URL`
  berilmaydi (standart `/api/v1` — nisbiy), build natijasini backend o'zi
  serve qiladi. CORS, alohida hosting kerak emas. Batafsil: `api/README.md`
  dagi "Deploy" bo'limi.

Demo hisob (`api` da `make seed` bajarilgan bo'lsa):
`ustoz` / `ustoz12345` · admin: `admin` / <yaratganingizdagi parol>

Tekshirish:

```bash
npm run build   # tsc -b && vite build
npx oxlint
```

## Tuzilish

```
src/
  lib/
    api/client.ts    fetch wrapper: token, 401 da refresh, ApiError
    api/types.ts     backend javoblarining tiplari (snake_case)
    api/queries.ts   barcha query kalitlari va so'rovlari bitta joyda
    auth/            AuthProvider, useAuth
    format.ts        pul, foiz, sana (500 000 so'm)
    period.ts        (yil, oy) juftligi bilan ishlash
    labels.ts        enum -> o'zbekcha nom va rang
  components/
    ui/              Button, Badge, Card, Input, Modal, Toast, Icon...
    ui/data-table.tsx  keng ekranda jadval, telefonda karta — bir ta'rifdan
    ui/avatar.tsx, ui/avatar-uploader.tsx  rasm (profil ham, o'quvchi ham)
    ui/pagination.tsx  sahifalash (raqamlar derazasi: 1 … 4 5 6 … 20)
    ui/highlight.tsx   qidiruvga mos qismni <mark> bilan ajratish
    use-debounced.ts   qidiruv uchun kechiktirish (300 ms)
    layout/          AppShell (yon panel), PageHeader
  features/
    auth/            kirish, ro'yxat, parol oqimlari
    dashboard/       o'qituvchi bosh sahifasi
    groups/          guruhlar, guruh kartasi, jadval, o'quvchi qo'shish
    students/        o'quvchilar ro'yxati, kartasi va tahrirlash oynasi
    attendance/      kunlik davomat, oylik jadval (ustun = dars, sana emas)
    payments/        oylik holat, to'lov kiritish, bekor qilish, qarzdorlar
    expenses/        xarajatlar va foyda
    reports/         oylik hisobot, daromad tendentsiyasi, davomat
    admin/           platforma statistikasi, o'qituvchilar
    profile/         profil
  routes/router.tsx  yo'llar va rol/auth qo'riqchilari
```

**Tarmoq qatlami** (`lib/api/client.ts`) uch ishni bir joyda qiladi: access
token qo'shadi, 401 da refresh qilib so'rovni bir marta qaytaradi (bir
vaqtda kelgan bir nechta 401 uchun refresh faqat bir marta ketadi) va har
qanday xatolikni `ApiError` ga aylantiradi. Sahifalar bularning hech birini
bilmaydi.

**Query kalitlari** `lib/api/queries.ts` da to'plangan — mutatsiyadan keyin
nimani yangilash kerakligi bir qarashda ko'rinadi.

## Hisob hayotiy sikli (admin paneli)

O'qituvchi ro'yxatdan o'tganda hisob darhol faollashmaydi:

```
ro'yxat → «Tasdiq kutmoqda» → (admin tasdiqlaydi) → Faol ⇄ Bloklangan → o'chirish
```

* **Bildirishnoma** — yon menyudagi «O'qituvchilar» yonida qizil raqam va
  Platforma sahifasidagi banner. Har daqiqada yangilanadi.
* **Ro'yxatdan o'tish** — ism va familiya alohida, username majburiy va
  unikal (band bo'lsa xatolik aynan shu maydon ostida chiqadi), parol ikki
  marta kiritiladi. Email va telefon ixtiyoriy.
* **Bloklash** — o'qituvchi ham, uning o'quvchilari ham tizimga kira
  olmaydi. Tasdiqlash oynasida o'quvchilar soni ko'rsatiladi.
* **Parolni tiklash** — email/telefoni yo'q o'qituvchi uchun admin
  vaqtinchalik parol beradi (ro'yxatda «yo'q» deb qizil rangda belgilanadi).
* **O'chirish** — uch bosqichli himoya: nima yo'qolishi ko'rsatiladi, zaxira
  nusxa JSON fayl sifatida yuklab olinadi, so'ng username qo'lda yoziladi.
  Shundan keyingina tugma faollashadi.

## Rollar

Router `RequireAuth` / `RequireAdmin` qo'riqchilari bilan ajratadi:
o'qituvchi `/admin/*` ga kira olmaydi, super admin esa bosh sahifada
avtomatik `/admin` ga yo'naltiriladi. Bu faqat qulaylik uchun —
haqiqiy cheklov backend'da (403), frontend'ga ishonilmaydi.

Super admin panelida moliyaviy raqamlar ataylab yo'q: alohida
o'qituvchining daromadi shaxsiy (talab 9), backend ham uni bermaydi.

## Asosiy oqimlar

**Jadval** — guruh sozlamalarida emas, alohida oynada: hafta kuniga bir
nechta dars qo'shiladi, har biri o'z vaqti bilan. Saqlash eski jadvalni
o'chirmaydi, "qaysi sanadan" ko'rsatilgan kundan yangi versiya ochadi;
o'sha oynada o'zgarishlar tarixi ham ko'rinadi.

**Xarajatlar** — alohida sahifa: yuqorida uchta raqam (yig'ilgan −
xarajat = foyda), toifalar kesimi va yozuvlar. Har oy takrorlanadigan
xarajat ("Har oy" yorlig'i) keyingi oyga bir bosishda ko'chiriladi.
Foyda bosh sahifada ham, oylik hisobotda ham, daromad grafigida ham
ko'rinadi (grafikda xarajat punktir chiziq bo'lib tushadi).

**Bosh sahifa** — yangi o'qituvchiga to'rt qadamli yo'riqnoma (guruh →
jadval → o'quvchilar → davomat), guruh paydo bo'lgach uning o'rniga
**bugungi darslar** vaqti bilan va "Davomat olish" tugmasi bilan
chiqadi.

**Dars bo'lmadi** — davomat sahifasidagi tugma. Kun "o'tkazilmagan" deb
belgilanadi, yozuvlar o'chadi va u davomat foiziga kirmaydi. Qaytarish
ham bir bosishda.

**Chop etish va eksport** — to'lov kvitansiyasi va oylik hisobot
brauzerning "Chop etish → PDF" imkoniyati orqali (`.print-root` portali,
`@media print`), ro'yxatlar esa CSV bo'lib yuklanadi (`;` ajratgichi va
BOM — Excel o'zbekcha harflarni to'g'ri ochishi uchun).

**Ro'yxatdan qo'shish** — Excel'dan nusxa ko'chirilgan matn qatorlarga
ajratiladi, yuborishdan oldin "shunday tushunildi" jadvali ko'rsatiladi.
Xatoli qator qolganlarini to'xtatmaydi.

**Davomat** — hamma standart "Bor" holatida keladi, o'qituvchi
kelmaganlarni belgilaydi va bir marta saqlaydi. "Hammasi: Bor / Yo'q"
tugmalari dars bekor bo'lgan kun uchun; saqlash tugmasi ekran pastida
yopishib turadi; saqlagandan keyin davomat qilinmagan keyingi guruh
taklif qilinadi. Serverga faqat "Bor" dan
farq qiladiganlar yuboriladi. Sana o'zgarganda qoralama `key` orqali qayta
boshlanadi (effekt ichida `setState` yo'q). Kelajak sana tanlab bo'lmaydi. Kunda bir nechta dars bo'lsa sana ostida
vaqt tugmalari chiqadi (saqlangani ✓ bilan) — har bir dars alohida
yuritiladi.

O'tgan kun avval **faqat ko'rish** uchun ochiladi: holat tugmalari
o'chirilgan, o'zgartirish "O'zgartirish" tugmasi bilan ochiladi. Eski
davomatga odatda qarab ketiladi — tasodifan bosilgan tugma yozuvni
jimgina buzmasligi kerak. "Bekor qilish" qoralamani serverdagi holatga
qaytaradi, saqlangandan keyin esa kun yana qulflanadi.

**To'lov** — bosh sahifadagi "To'lov qabul qilish" tugmasi qarzdorlar
ro'yxatini ochadi, o'quvchi tanlanadi va summa qarz bilan oldindan
to'ldiriladi: ikki bosishda kiritiladi. "Qarz" raqami `/debtors`
sahifasiga olib boradi. Odatda faqat "Saqlash" bosiladi. Qisman to'lov ishlaydi. To'lov o'chirilmaydi: "Bekor qilish"
serverda manfiy summali tuzatuvchi yozuv yaratadi va ikkala yozuv ham
tarixda qoladi.

**O'quvchilar ro'yxati** — kartalar yoki jadval (tugma bilan almashadi),
sahifalash (24 tadan), guruh bo'yicha filtr va "qarzi borlar". Har bir
kartada rasm, telefon, guruh yorliqlari va qarz ko'rinadi.

Qidiruv ism, telefon, username, ota-ona va maktab bo'yicha ishlaydi, mos
kelgan joy sariq bilan ajratiladi. Agar moslik ism yoki telefonda emas,
ko'rinmaydigan maydonda bo'lsa (masalan maktab), karta ostida o'sha
maydon ko'rsatiladi — "nega bu chiqdi?" degan savol qolmasin.

**O'quvchi kartasi** — yuqorida "kim" (rasm, ism, holat yorliqlari va
to'rtta raqam: guruhlar, oyiga, davomat, qarz), ostida ikki ustun:
ma'lumotlar (aloqa, ota-ona, maktab, izoh) va o'qishi (guruhlar, to'lov
tarixi). O'qituvchi bu sahifani ko'pincha ota-onaga qo'ng'iroq qilishdan
oldin ochadi, shuning uchun raqamlar bosiladigan `tel:` havolalari.

**Alohida narx** — o'quvchi qo'shayotganda ham, keyin "Narx" tugmasi
orqali ham: uch tugma (guruh narxi / boshqa summa / bepul) va sabab
maydoni. Bo'sh maydonni "0 so'm" deb tushunmaslik uchun bepul alohida
tanlov. Ro'yxatda chegirma miqdori (−50 000) va sabab ko'rinadi, guruh
sarlavhasida esa "oylik kutilma" — chegirmalar hisobga olingan summa.

**O'quvchi qo'shish** — bitta oynada yangi account yaratish yoki mavjudini
qidiruvdan topish. Yangi account'da vaqtinchalik parol bir marta
ko'rsatiladi (nusxa olish tugmasi bilan).

## Qaror va cheklovlar

* **Tokenlar `localStorage` da.** Backend `httpOnly` cookie bermaydi, SPA
  esa sahifa yangilanganda sessiyani saqlashi kerak. XSS tokenni o'qiy
  oladi — cookie'ga o'tilsa faqat `lib/api/client.ts` o'zgaradi.
* **Formalar** `react-hook-form`/`zod`siz, oddiy controlled state bilan.
  Validatsiya backend'da va uning maydon xatoliklari (`details`) maydon
  ostida ko'rsatiladi — ikki joyda takrorlanmaydi.
* **Amalni qaytarish** — guruhdan chiqarish tasdiq oynasisiz bajariladi,
  o'rniga bildirishnomada "Qaytarish" turadi (`toast.undo`). Ma'lumot
  yo'qolmagani uchun bu xavfsiz va tezroq. O'chirish kabi qaytarib
  bo'lmaydigan amallarda tasdiq oynasi qoladi.
* **Ikkita ko'rinish, bitta ta'rif** — `DataTable` ustunlar ro'yxatidan
  keng ekranda jadval, telefonda karta chizadi. Ikkalasi ham DOM da
  bo'ladi (CSS bilan yashiriladi), ro'yxatlar kichik bo'lgani uchun bu
  qimmat emas.
* **Matnlar** JSX ichida yozilgan (i18n kutubxonasi yo'q). Faqat backend
  enum'lari `lib/labels.ts` da tarjima qilingan.

## Qilinmagan

* O'quvchi roli uchun ekranlar — hozircha o'quvchi faqat `/auth/me` ga
  kira oladi (talab: test moduli 2-bosqichda).
* Eksport (PDF/rasm), bildirishnomalar, offline kesh.
* Testlar (Vitest/Playwright) — hozircha yo'q.
* `oxlint` da `react(only-export-components)` ogohlantirishlari qolgan:
  router va context fayllari komponent bilan birga hook/konstanta
  eksport qiladi. Bu faqat HMR donadorligiga taalluqli, xatolik emas.

## Tekshirish holati

```
tsc -b     — xatosiz
vite build — 443 KB (gzip 131 KB)
oxlint     — 7 ta HMR ogohlantirishi, xatolik yo'q
```

Chrome'da jonli tekshirilgan (backend SQLite + demo ma'lumot bilan):

* O'qituvchi: kirish → bosh ekran (1 500 000 / 3 200 000) → guruhlar →
  to'lov sahifasi → 500 000 to'lov kiritildi → jadval va yig'indi darhol
  yangilandi.
* Admin: kirish → bildirishnoma hisoblagichi (1) → o'qituvchilar ro'yxati →
  yangi o'qituvchini tasdiqlash → hisoblagich nolga tushdi → tasdiqlangan
  o'qituvchi tizimga kira oldi.
* O'chirish oynasi: yo'qoladigan ma'lumot (2 guruh, 8 o'quvchi, 20 davomat
  kuni, 13 to'lov / 4 125 000 so'm), zaxira nusxa tugmasi va username
  tasdiqlashi ko'rsatildi (o'chirish bajarilmadi).

Hali qo'lda sinalmagan: davomat saqlash, o'quvchi qo'shish, hisobot,
parol tiklash oqimi.
