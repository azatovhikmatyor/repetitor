import '../../../core/network/api_client.dart';
import '../../../core/network/paged.dart';
import '../domain/student.dart';

class StudentsRepository {
  StudentsRepository(this._api);

  final ApiClient _api;

  /// Mavjud o'quvchini boshqa guruhga qo'shishdan oldin qidirish uchun ham
  /// shu endpoint ishlatiladi.
  Future<Paged<Student>> list({
    String? search,
    int page = 1,
    int size = 30,
  }) async {
    final json = await _api.getJson('/students', query: {
      'page': page,
      'size': size,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
    return Paged.fromJson(json, Student.fromJson);
  }

  Future<StudentDetail> byId(int studentId) async =>
      StudentDetail.fromJson(await _api.getJson('/students/$studentId'));

  Future<Student> update(
    int studentId, {
    String? fullName,
    String? phone,
    String? username,
  }) async {
    final json = await _api.patch('/students/$studentId', body: {
      if (fullName != null) 'full_name': fullName.trim(),
      if (phone != null) 'phone': phone.trim(),
      if (username != null) 'username': username.trim(),
    });
    return Student.fromJson(json);
  }

  /// O'quvchi parolni o'zi tiklay olmaydi — o'qituvchi yangi vaqtinchalik
  /// parol beradi va o'quvchining sessiyalari yopiladi.
  Future<String> resetPassword(int studentId) async {
    final json = await _api.post('/students/$studentId/reset-password');
    return json['temporary_password'] as String;
  }
}
