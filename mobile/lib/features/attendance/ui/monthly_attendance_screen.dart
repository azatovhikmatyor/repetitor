import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/ui_kit.dart';
import '../domain/attendance.dart';
import '../state/attendance_controller.dart';

/// Oylik davomat jadvali: o'quvchilar × sanalar.
///
/// Telefonda kenglik yetmaydi, shuning uchun jadval gorizontal siljiydi,
/// ism ustuni esa joyida qoladi.
class MonthlyAttendanceScreen extends ConsumerStatefulWidget {
  const MonthlyAttendanceScreen({required this.groupId, super.key});

  final int groupId;

  @override
  ConsumerState<MonthlyAttendanceScreen> createState() =>
      _MonthlyAttendanceScreenState();
}

class _MonthlyAttendanceScreenState
    extends ConsumerState<MonthlyAttendanceScreen> {
  late DateTime _month = DateTime.now();

  static const _nameWidth = 140.0;
  static const _cellWidth = 40.0;

  @override
  Widget build(BuildContext context) {
    final key = AttendanceKey(widget.groupId, _month);
    final report = ref.watch(monthlyAttendanceProvider(key));
    final now = DateTime.now();
    final isCurrentMonth =
        _month.year == now.year && _month.month == now.month;

    return Scaffold(
      appBar: AppBar(title: const Text(S.attendanceMonthly)),
      body: Column(
        children: [
          MonthSelector(
            year: _month.year,
            month: _month.month,
            canGoForward: !isCurrentMonth,
            onChanged: (year, month) =>
                setState(() => _month = DateTime(year, month, 1)),
          ),
          const Divider(height: 1),
          Expanded(
            child: AsyncView(
              value: report,
              onRetry: () => ref.invalidate(monthlyAttendanceProvider(key)),
              builder: (data) {
                if (data.rows.isEmpty) {
                  return const EmptyView(
                    title: 'Bu oyda davomat yo‘q',
                    icon: Icons.event_busy_outlined,
                  );
                }
                return _Matrix(
                  data: data,
                  nameWidth: _nameWidth,
                  cellWidth: _cellWidth,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Matrix extends StatelessWidget {
  const _Matrix({
    required this.data,
    required this.nameWidth,
    required this.cellWidth,
  });

  final MonthlyAttendance data;
  final double nameWidth;
  final double cellWidth;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Ism ustuni — siljimaydi.
          Column(
            children: [
              _headerCell(context, width: nameWidth, child: const Text('')),
              for (final row in data.rows)
                _bodyCell(
                  context,
                  width: nameWidth,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        row.fullName,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Column(
                children: [
                  Row(
                    children: [
                      for (final date in data.sessionDates)
                        _headerCell(
                          context,
                          width: cellWidth,
                          child: Text(
                            '${date.day}',
                            style: theme.textTheme.labelMedium,
                          ),
                        ),
                      _headerCell(
                        context,
                        width: 56,
                        child: Text('%', style: theme.textTheme.labelMedium),
                      ),
                    ],
                  ),
                  for (final row in data.rows)
                    Row(
                      children: [
                        for (final date in data.sessionDates)
                          _bodyCell(
                            context,
                            width: cellWidth,
                            child: _mark(row.marks[Fmt.isoDate(date)]),
                          ),
                        _bodyCell(
                          context,
                          width: 56,
                          child: Text(
                            Fmt.percent(row.attendanceRate),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: row.attendanceRate >= 80
                                  ? AppTheme.paid
                                  : row.attendanceRate >= 60
                                      ? AppTheme.partial
                                      : AppTheme.absent,
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _mark(AttendanceStatus? status) {
    if (status == null) {
      return const Text('–', style: TextStyle(color: Colors.grey));
    }
    return switch (status) {
      AttendanceStatus.present =>
        const Icon(Icons.check_rounded, size: 18, color: AppTheme.paid),
      AttendanceStatus.absent =>
        const Icon(Icons.close_rounded, size: 18, color: AppTheme.absent),
      AttendanceStatus.late =>
        const Icon(Icons.schedule_rounded, size: 16, color: AppTheme.partial),
      AttendanceStatus.excused =>
        const Icon(Icons.info_outline_rounded, size: 16, color: Colors.grey),
    };
  }

  Widget _headerCell(
    BuildContext context, {
    required double width,
    required Widget child,
  }) {
    return Container(
      width: width,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.4),
        border: Border(
          bottom: BorderSide(color: Theme.of(context).dividerColor),
        ),
      ),
      child: child,
    );
  }

  Widget _bodyCell(
    BuildContext context, {
    required double width,
    required Widget child,
  }) {
    return Container(
      width: width,
      height: 48,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Theme.of(context).dividerColor),
        ),
      ),
      child: child,
    );
  }
}
