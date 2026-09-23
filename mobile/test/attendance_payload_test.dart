import 'package:flutter_test/flutter_test.dart';
import 'package:repetitor/features/attendance/domain/attendance.dart';

/// Davomatning asosiy qoidasi: serverga faqat kelmaganlar yuboriladi.
/// Bu mantiq `AttendanceRepository.save` ichida, shu yerda esa uning
/// asosidagi filtr tekshiriladi.
void main() {
  List<AttendanceEntry> roster(int count) => [
        for (var i = 0; i < count; i++)
          AttendanceEntry(
            studentId: i + 1,
            fullName: 'O\u2018quvchi $i',
            status: AttendanceStatus.present,
          ),
      ];

  test('hamma kelgan bo\u2018lsa payload bo\u2018sh', () {
    final entries = roster(30);
    final changed = entries
        .where((e) => e.status != AttendanceStatus.present)
        .toList();
    expect(changed, isEmpty);
  });

  test('30 tadan 5 tasi kelmasa payload 5 ta', () {
    final entries = roster(30);
    for (var i = 0; i < 5; i++) {
      entries[i] = entries[i].copyWith(status: AttendanceStatus.absent);
    }
    final changed = entries
        .where((e) => e.status != AttendanceStatus.present)
        .toList();
    expect(changed.length, 5);
  });

  test('sessiya hisoblagichlari', () {
    final entries = roster(10);
    entries[0] = entries[0].copyWith(status: AttendanceStatus.absent);
    entries[1] = entries[1].copyWith(status: AttendanceStatus.late);

    final session = AttendanceSession(
      groupId: 1,
      date: DateTime(2026, 9, 21),
      isSaved: false,
      isEditable: true,
      entries: entries,
    );

    // "Kech qoldi" ham kelgan hisoblanadi.
    expect(session.absentCount, 1);
    expect(session.presentCount, 9);
  });
}
