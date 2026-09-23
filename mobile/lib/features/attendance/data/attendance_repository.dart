import '../../../core/format/formatters.dart';
import '../../../core/network/api_client.dart';
import '../domain/attendance.dart';

class AttendanceRepository {
  AttendanceRepository(this._api);

  final ApiClient _api;

  Future<AttendanceSession> session(int groupId, {DateTime? date}) async {
    final json = await _api.getJson(
      '/groups/$groupId/attendance',
      query: {if (date != null) 'date': Fmt.isoDate(date)},
    );
    return AttendanceSession.fromJson(json);
  }

  /// Serverga FAQAT standartdan farq qiladigan o'quvchilar yuboriladi:
  /// ro'yxatda yo'q har bir o'quvchi `present` deb yoziladi. 30 kishilik
  /// guruhda 5 ta kelmagan bo'lsa — so'rovda 5 ta element.
  Future<AttendanceSession> save(
    int groupId, {
    required DateTime date,
    required List<AttendanceEntry> entries,
    String? note,
  }) async {
    final changed = entries
        .where((entry) => entry.status != AttendanceStatus.present)
        .map((entry) => {
              'student_id': entry.studentId,
              'status': entry.status.wire,
            })
        .toList();

    final json = await _api.put('/groups/$groupId/attendance', body: {
      'session_date': Fmt.isoDate(date),
      'records': changed,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
    return AttendanceSession.fromJson(json);
  }

  Future<MonthlyAttendance> monthly(
    int groupId, {
    required int year,
    required int month,
  }) async {
    final json = await _api.getJson(
      '/groups/$groupId/attendance/monthly',
      query: {'year': year, 'month': month},
    );
    return MonthlyAttendance.fromJson(json);
  }

  Future<List<StudentAttendanceSummary>> forStudent(int studentId) async {
    final json = await _api.getJson('/students/$studentId/attendance');
    return (json['groups'] as List<dynamic>? ?? const [])
        .map((item) =>
            StudentAttendanceSummary.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
