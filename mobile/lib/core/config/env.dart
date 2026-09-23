/// Muhit sozlamalari.
///
/// Qiymatlar `--dart-define` orqali beriladi, shunda bir xil kod turli
/// muhitlarga (lokal, staging, prod) qayta kompilyatsiya bilan chiqadi:
///
/// ```
/// flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
/// ```
class Env {
  const Env._();

  /// Android emulyatorda `localhost` emulyatorning o'zi — kompyuterga
  /// `10.0.2.2` orqali murojaat qilinadi. iOS simulyatorda `localhost` ishlaydi.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );

  static const String apiPrefix = '/api/v1';

  static String get apiUrl => '$apiBaseUrl$apiPrefix';

  /// Sekin tarmoqda (mobil internet) so'rov kutish vaqti.
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 20);
}
