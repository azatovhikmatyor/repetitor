import '../../../core/l10n/strings.dart';

enum AttendanceStatus {
  present('present'),
  absent('absent'),
  late('late'),
  excused('excused');

  const AttendanceStatus(this.wire);

  final String wire;

  String get label => switch (this) {
        AttendanceStatus.present => S.present,
        AttendanceStatus.absent => S.absent,
        AttendanceStatus.late => S.late,
        AttendanceStatus.excused => S.excused,
      };

  static AttendanceStatus fromWire(String? value) =>
      AttendanceStatus.values.firstWhere(
        (status) => status.wire == value,
        orElse: () => AttendanceStatus.present,
      );
}

class AttendanceEntry {
  const AttendanceEntry({
    required this.studentId,
    required this.fullName,
    required this.status,
  });

  final int studentId;
  final String fullName;
  final AttendanceStatus status;

  AttendanceEntry copyWith({AttendanceStatus? status}) => AttendanceEntry(
        studentId: studentId,
        fullName: fullName,
        status: status ?? this.status,
      );

  factory AttendanceEntry.fromJson(Map<String, dynamic> json) =>
      AttendanceEntry(
        studentId: json['student_id'] as int,
        fullName: json['full_name'] as String? ?? '',
        status: AttendanceStatus.fromWire(json['status'] as String?),
      );
}

/// Bir kunlik davomat ekrani.
class AttendanceSession {
  const AttendanceSession({
    required this.groupId,
    required this.date,
    required this.isSaved,
    required this.isEditable,
    required this.entries,
    this.sessionId,
    this.note,
  });

  final int groupId;
  final DateTime date;
  final int? sessionId;
  final bool isSaved;
  final bool isEditable;
  final String? note;
  final List<AttendanceEntry> entries;

  int get presentCount =>
      entries.where((e) => e.status != AttendanceStatus.absent).length;
  int get absentCount =>
      entries.where((e) => e.status == AttendanceStatus.absent).length;

  AttendanceSession copyWith({List<AttendanceEntry>? entries}) =>
      AttendanceSession(
        groupId: groupId,
        date: date,
        sessionId: sessionId,
        isSaved: isSaved,
        isEditable: isEditable,
        note: note,
        entries: entries ?? this.entries,
      );

  factory AttendanceSession.fromJson(Map<String, dynamic> json) =>
      AttendanceSession(
        groupId: json['group_id'] as int,
        date: DateTime.parse(json['session_date'] as String),
        sessionId: json['session_id'] as int?,
        isSaved: json['is_saved'] as bool? ?? false,
        isEditable: json['is_editable'] as bool? ?? true,
        note: json['note'] as String?,
        entries: (json['students'] as List<dynamic>? ?? const [])
            .map((item) =>
                AttendanceEntry.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

/// O'quvchining bir guruhdagi davomat xulosasi.
class StudentAttendanceSummary {
  const StudentAttendanceSummary({
    required this.groupId,
    required this.groupName,
    required this.totalSessions,
    required this.presentCount,
    required this.absentCount,
    required this.attendanceRate,
  });

  final int groupId;
  final String groupName;
  final int totalSessions;
  final int presentCount;
  final int absentCount;
  final double attendanceRate;

  factory StudentAttendanceSummary.fromJson(Map<String, dynamic> json) =>
      StudentAttendanceSummary(
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
        totalSessions: json['total_sessions'] as int? ?? 0,
        presentCount: json['present_count'] as int? ?? 0,
        absentCount: json['absent_count'] as int? ?? 0,
        attendanceRate: (json['attendance_rate'] as num? ?? 0).toDouble(),
      );
}

/// Oylik jadval: o'quvchilar × sanalar.
class MonthlyAttendance {
  const MonthlyAttendance({
    required this.sessionDates,
    required this.rows,
  });

  final List<DateTime> sessionDates;
  final List<MonthlyAttendanceRow> rows;

  factory MonthlyAttendance.fromJson(Map<String, dynamic> json) =>
      MonthlyAttendance(
        sessionDates: (json['session_dates'] as List<dynamic>? ?? const [])
            .map((item) => DateTime.parse(item as String))
            .toList(),
        rows: (json['students'] as List<dynamic>? ?? const [])
            .map((item) =>
                MonthlyAttendanceRow.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

class MonthlyAttendanceRow {
  const MonthlyAttendanceRow({
    required this.studentId,
    required this.fullName,
    required this.marks,
    required this.presentCount,
    required this.absentCount,
    required this.attendanceRate,
  });

  final int studentId;
  final String fullName;

  /// Kalit — `YYYY-MM-DD`.
  final Map<String, AttendanceStatus> marks;
  final int presentCount;
  final int absentCount;
  final double attendanceRate;

  factory MonthlyAttendanceRow.fromJson(Map<String, dynamic> json) =>
      MonthlyAttendanceRow(
        studentId: json['student_id'] as int,
        fullName: json['full_name'] as String? ?? '',
        marks: (json['marks'] as Map<String, dynamic>? ?? const {}).map(
          (key, value) =>
              MapEntry(key, AttendanceStatus.fromWire(value as String?)),
        ),
        presentCount: json['present_count'] as int? ?? 0,
        absentCount: json['absent_count'] as int? ?? 0,
        attendanceRate: (json['attendance_rate'] as num? ?? 0).toDouble(),
      );
}
