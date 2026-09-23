import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../domain/reports.dart';

/// (yil, oy) juftligi — `family` uchun kalit.
class Period {
  const Period(this.year, this.month);

  factory Period.current() {
    final now = DateTime.now();
    return Period(now.year, now.month);
  }

  final int year;
  final int month;

  Period shift(int delta) {
    final index = year * 12 + (month - 1) + delta;
    return Period(index ~/ 12, index % 12 + 1);
  }

  bool isAfter(Period other) =>
      year > other.year || (year == other.year && month > other.month);

  @override
  bool operator ==(Object other) =>
      other is Period && other.year == year && other.month == month;

  @override
  int get hashCode => Object.hash(year, month);
}

final monthlyReportProvider =
    FutureProvider.autoDispose.family<MonthlyReport, Period>((ref, period) {
  return ref
      .watch(reportsRepositoryProvider)
      .monthly(year: period.year, month: period.month);
});

final revenueTrendProvider =
    FutureProvider.autoDispose.family<List<RevenuePoint>, int>((ref, months) {
  return ref.watch(reportsRepositoryProvider).revenueTrend(months: months);
});

final attendanceReportProvider =
    FutureProvider.autoDispose.family<AttendanceReport, Period?>((ref, period) {
  return ref
      .watch(reportsRepositoryProvider)
      .attendance(year: period?.year, month: period?.month);
});
