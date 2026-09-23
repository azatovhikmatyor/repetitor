class GroupRef {
  const GroupRef({required this.groupId, required this.groupName});

  final int groupId;
  final String groupName;

  factory GroupRef.fromJson(Map<String, dynamic> json) => GroupRef(
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
      );
}

class DashboardGroupCard extends GroupRef {
  const DashboardGroupCard({
    required super.groupId,
    required super.groupName,
    required this.studentCount,
    required this.totalDue,
    required this.totalPaid,
    required this.totalDebt,
    required this.attendanceTakenToday,
  });

  final int studentCount;
  final int totalDue;
  final int totalPaid;
  final int totalDebt;
  final bool attendanceTakenToday;

  double get progress => totalDue == 0 ? 0 : (totalPaid / totalDue).clamp(0, 1);

  factory DashboardGroupCard.fromJson(Map<String, dynamic> json) =>
      DashboardGroupCard(
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
        studentCount: json['student_count'] as int? ?? 0,
        totalDue: json['total_due'] as int? ?? 0,
        totalPaid: json['total_paid'] as int? ?? 0,
        totalDebt: json['total_debt'] as int? ?? 0,
        attendanceTakenToday: json['attendance_taken_today'] as bool? ?? false,
      );
}

class Dashboard {
  const Dashboard({
    required this.year,
    required this.month,
    required this.collected,
    required this.expected,
    required this.debt,
    required this.collectionRate,
    required this.debtorCount,
    required this.activeGroupCount,
    required this.activeStudentCount,
    required this.groups,
    required this.groupsWithoutAttendanceToday,
  });

  final int year;
  final int month;
  final int collected;
  final int expected;
  final int debt;
  final double collectionRate;
  final int debtorCount;
  final int activeGroupCount;
  final int activeStudentCount;
  final List<DashboardGroupCard> groups;
  final List<GroupRef> groupsWithoutAttendanceToday;

  factory Dashboard.fromJson(Map<String, dynamic> json) => Dashboard(
        year: json['year'] as int,
        month: json['month'] as int,
        collected: json['collected'] as int? ?? 0,
        expected: json['expected'] as int? ?? 0,
        debt: json['debt'] as int? ?? 0,
        collectionRate: (json['collection_rate'] as num? ?? 0).toDouble(),
        debtorCount: json['debtor_count'] as int? ?? 0,
        activeGroupCount: json['active_group_count'] as int? ?? 0,
        activeStudentCount: json['active_student_count'] as int? ?? 0,
        groups: (json['groups'] as List<dynamic>? ?? const [])
            .map((item) =>
                DashboardGroupCard.fromJson(item as Map<String, dynamic>))
            .toList(),
        groupsWithoutAttendanceToday:
            (json['groups_without_attendance_today'] as List<dynamic>? ??
                    const [])
                .map((item) => GroupRef.fromJson(item as Map<String, dynamic>))
                .toList(),
      );
}

class MonthlyGroupSummary extends GroupRef {
  const MonthlyGroupSummary({
    required super.groupId,
    required super.groupName,
    required this.studentCount,
    required this.totalDue,
    required this.totalPaid,
    required this.totalDebt,
    required this.paidCount,
    required this.partialCount,
    required this.unpaidCount,
  });

  final int studentCount;
  final int totalDue;
  final int totalPaid;
  final int totalDebt;
  final int paidCount;
  final int partialCount;
  final int unpaidCount;

  factory MonthlyGroupSummary.fromJson(Map<String, dynamic> json) =>
      MonthlyGroupSummary(
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
        studentCount: json['student_count'] as int? ?? 0,
        totalDue: json['total_due'] as int? ?? 0,
        totalPaid: json['total_paid'] as int? ?? 0,
        totalDebt: json['total_debt'] as int? ?? 0,
        paidCount: json['paid_count'] as int? ?? 0,
        partialCount: json['partial_count'] as int? ?? 0,
        unpaidCount: json['unpaid_count'] as int? ?? 0,
      );
}

class MonthlyReport {
  const MonthlyReport({
    required this.year,
    required this.month,
    required this.totalDue,
    required this.totalPaid,
    required this.totalDebt,
    required this.groups,
  });

  final int year;
  final int month;
  final int totalDue;
  final int totalPaid;
  final int totalDebt;
  final List<MonthlyGroupSummary> groups;

  factory MonthlyReport.fromJson(Map<String, dynamic> json) => MonthlyReport(
        year: json['year'] as int,
        month: json['month'] as int,
        totalDue: json['total_due'] as int? ?? 0,
        totalPaid: json['total_paid'] as int? ?? 0,
        totalDebt: json['total_debt'] as int? ?? 0,
        groups: (json['groups'] as List<dynamic>? ?? const [])
            .map((item) =>
                MonthlyGroupSummary.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

class RevenuePoint {
  const RevenuePoint({
    required this.year,
    required this.month,
    required this.collected,
    required this.expected,
  });

  final int year;
  final int month;
  final int collected;
  final int expected;

  factory RevenuePoint.fromJson(Map<String, dynamic> json) => RevenuePoint(
        year: json['year'] as int,
        month: json['month'] as int,
        collected: json['collected'] as int? ?? 0,
        expected: json['expected'] as int? ?? 0,
      );
}

class GroupAttendanceRate extends GroupRef {
  const GroupAttendanceRate({
    required super.groupId,
    required super.groupName,
    required this.sessionCount,
    required this.attendanceRate,
  });

  final int sessionCount;
  final double attendanceRate;

  factory GroupAttendanceRate.fromJson(Map<String, dynamic> json) =>
      GroupAttendanceRate(
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
        sessionCount: json['session_count'] as int? ?? 0,
        attendanceRate: (json['attendance_rate'] as num? ?? 0).toDouble(),
      );
}

class FrequentAbsentee {
  const FrequentAbsentee({
    required this.studentId,
    required this.fullName,
    required this.absentCount,
    required this.totalSessions,
    required this.attendanceRate,
  });

  final int studentId;
  final String fullName;
  final int absentCount;
  final int totalSessions;
  final double attendanceRate;

  factory FrequentAbsentee.fromJson(Map<String, dynamic> json) =>
      FrequentAbsentee(
        studentId: json['student_id'] as int,
        fullName: json['full_name'] as String? ?? '',
        absentCount: json['absent_count'] as int? ?? 0,
        totalSessions: json['total_sessions'] as int? ?? 0,
        attendanceRate: (json['attendance_rate'] as num? ?? 0).toDouble(),
      );
}

class AttendanceReport {
  const AttendanceReport({required this.groups, required this.absentees});

  final List<GroupAttendanceRate> groups;
  final List<FrequentAbsentee> absentees;

  factory AttendanceReport.fromJson(Map<String, dynamic> json) =>
      AttendanceReport(
        groups: (json['groups'] as List<dynamic>? ?? const [])
            .map((item) =>
                GroupAttendanceRate.fromJson(item as Map<String, dynamic>))
            .toList(),
        absentees: (json['frequent_absentees'] as List<dynamic>? ?? const [])
            .map((item) =>
                FrequentAbsentee.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}
