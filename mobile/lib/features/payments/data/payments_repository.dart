import '../../../core/network/api_client.dart';
import '../domain/payment.dart';

class PaymentsRepository {
  PaymentsRepository(this._api);

  final ApiClient _api;

  /// Guruhning oylik holati. Shu oyning hisoblari hali ochilmagan bo'lsa,
  /// server so'rov paytida ularni ochadi (narx o'sha paytda muzlatiladi).
  Future<GroupMonth> groupMonth(
    int groupId, {
    required int year,
    required int month,
  }) async {
    final json = await _api.getJson(
      '/groups/$groupId/payments',
      query: {'year': year, 'month': month},
    );
    return GroupMonth.fromJson(json);
  }

  /// To'liq yoki qisman to'lov. Bir oyga bir nechta to'lov qo'shilishi mumkin.
  Future<Payment> record(
    int groupId, {
    required int studentId,
    required int year,
    required int month,
    required int amount,
    PaymentMethod method = PaymentMethod.cash,
    String? note,
  }) async {
    final json = await _api.post('/groups/$groupId/payments', body: {
      'student_id': studentId,
      'year': year,
      'month': month,
      'amount': amount,
      'method': method.wire,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
    return Payment.fromJson(json);
  }

  Future<List<Payment>> history(
    int groupId, {
    int? year,
    int? month,
  }) async {
    final list = await _api.getList(
      '/groups/$groupId/payments/history',
      query: {
        if (year != null) 'year': year,
        if (month != null) 'month': month,
      },
    );
    return list
        .map((item) => Payment.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  /// To'lov o'chirilmaydi — manfiy summali tuzatuvchi yozuv qo'shiladi.
  /// Javobda aynan o'sha yangi yozuv keladi.
  Future<Payment> reverse(int paymentId, {String? note}) async {
    final json = await _api.post(
      '/payments/$paymentId/reverse',
      body: {if (note != null && note.trim().isNotEmpty) 'note': note.trim()},
    );
    return Payment.fromJson(json);
  }

  Future<List<StudentCharge>> forStudent(int studentId) async {
    final list = await _api.getList('/students/$studentId/payments');
    return list
        .map((item) => StudentCharge.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
