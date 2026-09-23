import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../core/providers.dart';
import '../domain/attendance.dart';

/// Davomat ekrani kaliti: qaysi guruh, qaysi sana.
class AttendanceKey {
  AttendanceKey(this.groupId, DateTime date)
      : date = DateTime(date.year, date.month, date.day);

  final int groupId;
  final DateTime date;

  String get isoDate => Fmt.isoDate(date);

  @override
  bool operator ==(Object other) =>
      other is AttendanceKey &&
      other.groupId == groupId &&
      other.date == date;

  @override
  int get hashCode => Object.hash(groupId, date);
}

/// Davomat ekranining holati.
///
/// Belgilash lokal (darhol, tarmoqsiz), saqlash esa bir marta — o'qituvchi
/// 5 ta kelmaganni belgilab bitta "Saqlash" bosadi.
class AttendanceController
    extends AutoDisposeFamilyAsyncNotifier<AttendanceSession, AttendanceKey> {
  @override
  Future<AttendanceSession> build(AttendanceKey arg) {
    return ref
        .watch(attendanceRepositoryProvider)
        .session(arg.groupId, date: arg.date);
  }

  AttendanceSession? get _session => state.valueOrNull;

  /// Bor <-> Yo'q. Bir marta bosish — asosiy harakat.
  void toggle(int studentId) {
    final session = _session;
    if (session == null || !session.isEditable) return;

    state = AsyncData(
      session.copyWith(
        entries: session.entries
            .map(
              (entry) => entry.studentId == studentId
                  ? entry.copyWith(
                      status: entry.status == AttendanceStatus.absent
                          ? AttendanceStatus.present
                          : AttendanceStatus.absent,
                    )
                  : entry,
            )
            .toList(),
      ),
    );
  }

  /// `late` / `excused` uchun — uzoq bosish menyusidan.
  void setStatus(int studentId, AttendanceStatus status) {
    final session = _session;
    if (session == null || !session.isEditable) return;

    state = AsyncData(
      session.copyWith(
        entries: session.entries
            .map((entry) => entry.studentId == studentId
                ? entry.copyWith(status: status)
                : entry)
            .toList(),
      ),
    );
  }

  void markAllPresent() {
    final session = _session;
    if (session == null || !session.isEditable) return;

    state = AsyncData(
      session.copyWith(
        entries: session.entries
            .map((entry) => entry.copyWith(status: AttendanceStatus.present))
            .toList(),
      ),
    );
  }

  /// Serverga faqat kelmaganlar yuboriladi (repository shuni ajratadi).
  Future<void> save() async {
    final session = _session;
    if (session == null) return;

    final saved = await ref.read(attendanceRepositoryProvider).save(
          arg.groupId,
          date: arg.date,
          entries: session.entries,
        );
    state = AsyncData(saved);
  }
}

final attendanceControllerProvider = AsyncNotifierProvider.autoDispose
    .family<AttendanceController, AttendanceSession, AttendanceKey>(
  AttendanceController.new,
);

final monthlyAttendanceProvider = FutureProvider.autoDispose
    .family<MonthlyAttendance, AttendanceKey>((ref, key) {
  return ref.watch(attendanceRepositoryProvider).monthly(
        key.groupId,
        year: key.date.year,
        month: key.date.month,
      );
});

final studentAttendanceProvider = FutureProvider.autoDispose
    .family<List<StudentAttendanceSummary>, int>((ref, studentId) {
  return ref.watch(attendanceRepositoryProvider).forStudent(studentId);
});
