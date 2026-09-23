# Repetitor — mobil ilova (Flutter)

`app/api` dagi FastAPI backend'ining mobil clienti. Mobil-first: barcha
ekranlar avvalo telefon uchun, asosiy amallar 2-3 tegishdan oshmaydi.

## Ishga tushirish

Platforma papkalari allaqachon yaratilgan (`flutter create` bajarilgan),
paketlar o'rnatilgan. Backend ishlab turgani holda:

```bash
cd mobile
flutter run -d chrome --web-port=5173 --dart-define=API_BASE_URL=http://localhost:8000
```

**Muhim:** `--web-port` ni o'zgartirmang yoki o'zgartirsangiz API'ning
`.env` dagi `CORS_ORIGINS` ga yangi portni qo'shing. `localhost` va
`127.0.0.1` — brauzer uchun ikki xil origin, ikkalasi ham ro'yxatda.

| Qurilma | `API_BASE_URL` |
|---|---|
| Chrome / Edge (web) | `http://localhost:8000` |
| Android emulyator | `http://10.0.2.2:8000` |
| iOS simulyator | `http://localhost:8000` |
| Haqiqiy telefon | `http://<kompyuter-IP>:8000` |

Demo hisob (`api` da `make seed` bajarilgan bo'lsa):
`ustoz@example.com` / `ustoz12345`

Testlar va analiz:

```bash
flutter test
flutter analyze
```

### Telefon/emulyatorda ishlatish uchun nima kerak

Hozircha faqat **web** target ishlaydi — `flutter doctor` ikkita bo'shliqni
ko'rsatadi:

* **Android SDK yo'q** → Android Studio o'rnatiladi, birinchi ishga
  tushirishda SDK komponentlarini o'zi yuklaydi. Keyin `flutter doctor
  --android-licenses` va `flutter emulators --create`.
* **Visual Studio C++ komponentlari yo'q** → faqat Windows desktop build
  uchun kerak; mobil ilova uchun shart emas.

iOS uchun macOS kerak.

## Arxitektura

Backend'dagi modulli tuzilish takrorlangan — har bir modul o'z
`domain / data / state / ui` qatlamiga ega:

```
lib/
  core/
    config/     Env — API manzili --dart-define orqali
    network/    ApiClient (Dio), token saqlash, xatolik modeli, Paged
    theme/      Material 3 temasi va holat ranglari
    format/     pul, foiz, sana formati (500 000 so'm)
    l10n/       barcha matnlar bitta joyda (S)
    widgets/    AsyncView, StatusChip, StatTile, MonthSelector...
    providers   repository'lar uchun DI
  features/
    auth/       kirish, ro'yxat, parol oqimlari, sessiya holati
    dashboard/  bosh ekran
    groups/     guruhlar, guruhdagi o'quvchilar, o'quvchi qo'shish
    students/   o'quvchilar ro'yxati va kartasi
    attendance/ kunlik davomat, oylik jadval
    payments/   oylik holat, to'lov kiritish, bekor qilish
    reports/    oylik hisobot, daromad tendentsiyasi, davomat
    profile/    profil va chiqish
  router/       go_router, auth holatiga qarab yo'naltirish
```

**Holat:** Riverpod, kod generatsiyasisiz. `riverpod_generator` va
`freezed` ataylab qo'shilmadi — loyihani klonlagan odam `flutter pub get`
dan keyin darrov ishga tushira oladi, `build_runner` bosqichi yo'q.
`fromJson` qo'lda yozilgan.

**Tarmoq:** `ApiClient` uch ishni bir joyda qiladi — access token qo'shadi,
401 da refresh qilib so'rovni qayta yuboradi (bir vaqtda kelgan bir nechta
401 uchun refresh faqat bir marta ketadi) va har qanday xatolikni
`ApiException` ga aylantiradi. Repository'lar bularning hech birini
bilmaydi.

**Tokenlar** `flutter_secure_storage` da (Android Keystore / iOS Keychain),
`SharedPreferences` da emas.

## Asosiy oqimlar

**Davomat** — talabning eng muhim UX qoidasi. Ekran ochilganda hamma
"Bor" holatida keladi; o'qituvchi kelmaganlarni bir tegish bilan
belgilaydi va bitta "Saqlash" bosadi. Serverga **faqat kelmaganlar**
yuboriladi: 30 kishilik guruhda 5 ta kelmagan bo'lsa, so'rovda 5 ta
element bo'ladi. Uzoq bosish "Kech qoldi"/"Sababli" menyusini ochadi.
Kelajakdagi sana tanlab bo'lmaydi, o'tgan kunni tuzatish mumkin.

**To'lov** — summa maydoni qarz bilan oldindan to'ldirilgan, odatiy
holatda faqat "Saqlash" bosiladi. Qisman to'lov qo'llab-quvvatlanadi
(bir oyga bir nechta to'lov). To'lov **o'chirilmaydi** — tarix ro'yxatidagi
"bekor qilish" tugmasi serverda manfiy summali tuzatuvchi yozuv yaratadi
va ikkala yozuv ham ko'rinib turadi.

**O'quvchi qo'shish** — bitta oynada ikki yo'l: yangi account yaratish yoki
mavjud o'quvchini qidiruvdan topib qo'shish. Yangi account yaratilganda
vaqtinchalik parol bir marta ko'rsatiladi (nusxa olish tugmasi bilan) —
o'qituvchi uni o'quvchiga aytadi, o'quvchi birinchi kirishda almashtiradi.

**Parol almashtirish majburiyati** — `must_change_password` bo'lsa router
foydalanuvchini parol ekranida ushlab turadi, orqaga qaytarib bo'lmaydi.

## Til

Interfeys o'zbek (lotin). Barcha matn `core/l10n/strings.dart` dagi `S`
klassida — `intl` arb fayllariga o'tkazish mexanik ish bo'ladi va
widget'lar o'zgarmaydi. Sana va pul mahalliy formatda: `500 000 so'm`,
`21 Sentabr`.

## Qilinmagan / keyingi bosqich

* **Offline (PWA/kesh)** — talabda "MVP'da faqat offline o'qish" deyilgan;
  hozircha kesh yo'q, har ekran tarmoqdan o'qiydi.
* **Push bildirishnoma**, test moduli, material/blog — keyingi bosqichlar.
* **Super Admin ekranlari** — backend'da `/admin/*` bor, mobil ilovada yo'q
  (admin veb'dan ishlaydi degan taxmin bilan).
* **Platforma papkalari** — `flutter create .` bilan yaratiladi, shuning
  uchun `.gitignore` da.
* **Widget/integration testlar** — hozircha faqat sof mantiq testlari
  (format, davr hisobi, davomat payload'i).

## Tekshirish holati

```
flutter analyze  — No issues found
flutter test     — 11 passed (format, davr hisobi, davomat payload'i)
```

Chrome'da jonli tekshirilgan (backend SQLite + demo ma'lumot bilan):
kirish → bosh ekran (1 500 000 / 3 200 000, 46.9%, 5 qarzdor) → guruh
kartasi → davomat ekrani → o'quvchini "Yo'q" qilish → saqlash. Butun zanjir
ishlaydi.

Hali qo'lda sinalmagan: to'lov kiritish va bekor qilish, o'quvchi qo'shish,
hisobot ekrani, parol oqimlari.
