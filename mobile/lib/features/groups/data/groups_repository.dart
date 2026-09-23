import '../../../core/network/api_client.dart';
import '../../../core/network/paged.dart';
import '../domain/group.dart';
import '../domain/group_student.dart';

class GroupsRepository {
  GroupsRepository(this._api);

  final ApiClient _api;

  Future<Paged<Group>> list({
    GroupStatus? status,
    String? search,
    int page = 1,
    int size = 50,
  }) async {
    final json = await _api.getJson('/groups', query: {
      'page': page,
      'size': size,
      if (status != null) 'status': status.wire,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
    return Paged.fromJson(json, Group.fromJson);
  }

  Future<Group> byId(int groupId) async =>
      Group.fromJson(await _api.getJson('/groups/$groupId'));

  Future<Group> create({
    required String name,
    required int monthlyFee,
    String? description,
    String? schedule,
  }) async {
    final json = await _api.post('/groups', body: {
      'name': name.trim(),
      'monthly_fee': monthlyFee,
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      if (schedule != null && schedule.trim().isNotEmpty)
        'schedule': schedule.trim(),
    });
    return Group.fromJson(json);
  }

  /// Narx o'zgarsa faqat kelajakdagi oylarga ta'sir qiladi — o'tgan oylarning
  /// hisobi serverda muzlatilgan.
  Future<Group> update(
    int groupId, {
    String? name,
    int? monthlyFee,
    String? description,
    String? schedule,
  }) async {
    final json = await _api.patch('/groups/$groupId', body: {
      if (name != null) 'name': name.trim(),
      if (monthlyFee != null) 'monthly_fee': monthlyFee,
      if (description != null) 'description': description.trim(),
      if (schedule != null) 'schedule': schedule.trim(),
    });
    return Group.fromJson(json);
  }

  Future<Group> setArchived(int groupId, {required bool archived}) async {
    final path = archived ? 'archive' : 'unarchive';
    return Group.fromJson(await _api.post('/groups/$groupId/$path'));
  }

  /// Faqat mutlaqo bo'sh guruh o'chiriladi; aks holda server 409 qaytaradi.
  Future<void> delete(int groupId) => _api.delete('/groups/$groupId');

  Future<List<GroupStudent>> students(
    int groupId, {
    bool includeLeft = false,
  }) async {
    final list = await _api.getList(
      '/groups/$groupId/students',
      query: {'include_left': includeLeft},
    );
    return list
        .map((item) => GroupStudent.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  /// Yangi o'quvchi yaratadi (`fullName` + telefon/username) yoki mavjudini
  /// qo'shadi (`studentId`).
  Future<AddStudentResult> addStudent(
    int groupId, {
    int? studentId,
    String? fullName,
    String? phone,
    String? username,
    int? customFee,
    DateTime? joinedOn,
  }) async {
    final json = await _api.post('/groups/$groupId/students', body: {
      if (studentId != null) 'student_id': studentId,
      if (fullName != null) 'full_name': fullName.trim(),
      if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      if (username != null && username.trim().isNotEmpty)
        'username': username.trim(),
      if (customFee != null) 'custom_fee': customFee,
      if (joinedOn != null)
        'joined_on': joinedOn.toIso8601String().split('T').first,
    });
    return AddStudentResult.fromJson(json);
  }

  Future<GroupStudent> setCustomFee(
    int groupId,
    int studentId, {
    int? customFee,
  }) async {
    final json = await _api.patch(
      '/groups/$groupId/students/$studentId',
      body: customFee == null
          ? {'reset_custom_fee': true}
          : {'custom_fee': customFee},
    );
    return GroupStudent.fromJson(json);
  }

  /// Guruhdan chiqarish — account o'chmaydi, tarix saqlanadi.
  Future<void> removeStudent(int groupId, int studentId) =>
      _api.delete('/groups/$groupId/students/$studentId');
}
