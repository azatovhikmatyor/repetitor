/// Interfeys matnlari.
///
/// Hozircha faqat o'zbek (lotin). Barcha matn shu yerda to'plangan — keyin
/// `intl` arb fayllariga o'tkazish mexanik ish bo'ladi va widget'lar
/// o'zgarmaydi (talab 13: struktura i18n'ga tayyor).
class S {
  const S._();

  // Umumiy
  static const appName = 'Repetitor';
  static const save = 'Saqlash';
  static const cancel = 'Bekor qilish';
  static const delete = "O'chirish";
  static const edit = 'Tahrirlash';
  static const add = "Qo'shish";
  static const search = 'Qidirish';
  static const retry = 'Qayta urinish';
  static const close = 'Yopish';
  static const confirm = 'Tasdiqlash';
  static const loading = 'Yuklanmoqda...';
  static const somethingWentWrong = 'Xatolik yuz berdi';
  static const noConnection = 'Internet aloqasi yo‘q';
  static const nothingHere = "Hozircha bo'sh";

  // Auth
  static const login = 'Kirish';
  static const logout = 'Chiqish';
  static const register = "Ro'yxatdan o'tish";
  static const loginHint = 'Email, telefon yoki username';
  static const password = 'Parol';
  static const currentPassword = 'Joriy parol';
  static const newPassword = 'Yangi parol';
  static const fullName = 'Ism familiya';
  static const email = 'Email';
  static const phone = 'Telefon';
  static const forgotPassword = 'Parolni unutdingizmi?';
  static const changePassword = "Parolni o'zgartirish";
  static const mustChangePassword =
      'Davom etish uchun avval yangi parol qo‘ying';
  static const passwordChanged = "Parol o'zgartirildi. Qaytadan kiring.";
  static const resetCodeSent =
      'Agar bu email tizimda bo‘lsa, tiklash kodi yuborildi';
  static const resetCode = 'Email’ga kelgan kod';
  static const haveAccount = 'Hisobingiz bormi?';
  static const noAccount = 'Hisobingiz yo‘qmi?';

  // Navigatsiya
  static const home = 'Bosh sahifa';
  static const groups = 'Guruhlar';
  static const reports = 'Hisobot';
  static const profile = 'Profil';

  // Dashboard
  static const thisMonth = 'Shu oy';
  static const collected = "Yig'ilgan";
  static const expected = 'Kutilgan';
  static const debt = 'Qarz';
  static const debtors = 'Qarzdorlar';
  static const attendanceReminder = 'Bugun davomat qilinmagan';
  static const noGroupsYet = "Hali guruh yo'q";
  static const createFirstGroup = 'Birinchi guruhni yarating';

  // Guruh
  static const newGroup = 'Yangi guruh';
  static const groupName = 'Guruh nomi';
  static const description = 'Izoh';
  static const monthlyFee = 'Oylik to‘lov';
  static const schedule = 'Jadval';
  static const scheduleHint = 'Masalan: Du/Chor/Ju 08:00';
  static const archive = 'Arxivlash';
  static const unarchive = 'Arxivdan qaytarish';
  static const archived = 'Arxivlangan';
  static const activeGroups = 'Faol guruhlar';
  static const archivedGroups = 'Arxiv';
  static const deleteGroupConfirm =
      "Guruh o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.";
  static const archiveGroupHint =
      "Arxivlangan guruhda tarix saqlanadi, lekin yangi davomat va to'lov qo'shilmaydi.";

  // O'quvchi
  static const students = "O'quvchilar";
  static const newStudent = "Yangi o'quvchi";
  static const addStudent = "O'quvchi qo'shish";
  static const existingStudent = "Mavjud o'quvchi";
  static const searchStudent = "O'quvchini qidirish";
  static const removeFromGroup = 'Guruhdan chiqarish';
  static const removeFromGroupConfirm =
      "O'quvchi guruhdan chiqarilsinmi? Tarixi saqlanadi.";
  static const customFee = 'Alohida narx';
  static const customFeeHint = "Bo'sh bo'lsa guruh narxi qo'llanadi";
  static const resetStudentPassword = 'Parolni tiklash';
  static const temporaryPassword = 'Vaqtinchalik parol';
  static const temporaryPasswordHint =
      "Bu parolni o'quvchiga ayting. U faqat hozir ko'rsatiladi.";
  static const usernameOptional = 'Username (ixtiyoriy)';

  // Davomat
  static const attendance = 'Davomat';
  static const present = 'Bor';
  static const absent = "Yo'q";
  static const late = 'Kech';
  static const excused = 'Sababli';
  static const attendanceHint = 'Kelmaganlarni belgilang';
  static const attendanceSaved = 'Davomat saqlandi';
  static const attendanceMonthly = 'Oylik jadval';
  static const noFutureAttendance =
      "Kelajakdagi sanaga davomat qo'yib bo'lmaydi";
  static const attendanceRate = 'Davomat foizi';

  // To'lov
  static const payments = "To'lovlar";
  static const recordPayment = "To'lovni qayd etish";
  static const amount = 'Summa';
  static const method = "To'lov turi";
  static const cash = 'Naqd';
  static const card = 'Karta';
  static const transfer = "O'tkazma";
  static const other = 'Boshqa';
  static const note = 'Izoh';
  static const paid = "To'langan";
  static const partial = 'Qisman';
  static const unpaid = "To'lanmagan";
  static const overpaid = 'Ortiqcha';
  static const paymentHistory = "To'lovlar tarixi";
  static const reversePayment = "To'lovni bekor qilish";
  static const reversePaymentConfirm =
      "To'lov bekor qilinsinmi? Yozuv o'chmaydi — tuzatuvchi yozuv qo'shiladi.";
  static const reversed = 'Bekor qilingan';
  static const payFull = "To'liq to'lov";

  // Hisobot
  static const monthlyReport = 'Oylik hisobot';
  static const revenueTrend = 'Daromad tendentsiyasi';
  static const totalDue = 'Jami kutilgan';
  static const totalPaid = "Jami yig'ilgan";
  static const totalDebt = 'Jami qarz';

  static const months = <String>[
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ];

  static String monthName(int month) => months[month - 1];
}
