import 'package:intl/intl.dart';

import '../l10n/strings.dart';

/// Son, pul va sana formati.
///
/// Valyuta butun son sifatida (tiyinsiz) keladi va bu yerda `500 000` ko'rinishiga
/// keltiriladi — backend hech qachon formatlangan matn qaytarmaydi.
class Fmt {
  const Fmt._();

  /// `500000` -> `500 000`
  static String money(int amount) {
    final isNegative = amount < 0;
    final digits = amount.abs().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) {
        buffer.write(' '); // uzilmaydigan probel
      }
      buffer.write(digits[i]);
    }
    return isNegative ? '-$buffer' : buffer.toString();
  }

  /// `500000` -> `500 000 so'm`
  static String soum(int amount) => "${money(amount)} so‘m";

  /// Katta raqamlar uchun qisqa ko'rinish: `2 725 000` -> `2,7 mln`
  static String compact(int amount) {
    if (amount.abs() >= 1000000) {
      final millions = amount / 1000000;
      // O'zbek tilida kasr vergul bilan yoziladi: 2,7 mln
      final text = millions
          .toStringAsFixed(millions.abs() >= 10 ? 0 : 1)
          .replaceAll('.', ',');
      return '$text mln';
    }
    if (amount.abs() >= 1000) {
      return '${(amount / 1000).round()} ming';
    }
    return money(amount);
  }

  /// Oy nomi: `9` -> `Sentabr`
  static String monthLabel(int month) => S.monthName(month);

  static String percent(double value) =>
      '${value.toStringAsFixed(value == value.roundToDouble() ? 0 : 1)}%';

  static String date(DateTime value) =>
      DateFormat('dd.MM.yyyy').format(value.toLocal());

  /// `21 Sentabr` — oy nomi o'zbekcha, `S.months` dan olinadi (intl locale
  /// ma'lumotlari yuklanmagani uchun `DateFormat('MMMM')` ishlatilmaydi).
  static String dayMonth(DateTime value) {
    final local = value.toLocal();
    return '${local.day} ${S.monthName(local.month)}';
  }

  static String dateTime(DateTime value) =>
      DateFormat('dd.MM.yyyy HH:mm').format(value.toLocal());

  /// `2026-09-21` — API sana formatida
  static String isoDate(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-'
      '${value.month.toString().padLeft(2, '0')}-'
      '${value.day.toString().padLeft(2, '0')}';
}
