import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/ui_kit.dart';
import '../domain/reports.dart';
import '../state/reports_providers.dart';

/// Hisobot: oylik moliyaviy holat, daromad tendentsiyasi va davomat.
class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  Period _period = Period.current();

  @override
  Widget build(BuildContext context) {
    final report = ref.watch(monthlyReportProvider(_period));
    final trend = ref.watch(revenueTrendProvider(6));
    final attendance = ref.watch(attendanceReportProvider(_period));
    final maxPeriod = Period.current();

    return Scaffold(
      appBar: AppBar(title: const Text(S.reports)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(monthlyReportProvider(_period));
          ref.invalidate(revenueTrendProvider(6));
          ref.invalidate(attendanceReportProvider(_period));
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            MonthSelector(
              year: _period.year,
              month: _period.month,
              canGoForward: !_period.shift(1).isAfter(maxPeriod),
              onChanged: (year, month) =>
                  setState(() => _period = Period(year, month)),
            ),
            const SizedBox(height: 8),
            AsyncView(
              value: report,
              onRetry: () => ref.invalidate(monthlyReportProvider(_period)),
              loading: const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              ),
              builder: (data) => _MonthlyReportCard(report: data),
            ),
            const SizedBox(height: 16),
            AsyncView(
              value: trend,
              onRetry: () => ref.invalidate(revenueTrendProvider(6)),
              loading: const SizedBox(height: 180),
              builder: (points) => _TrendCard(points: points),
            ),
            const SizedBox(height: 16),
            AsyncView(
              value: attendance,
              onRetry: () => ref.invalidate(attendanceReportProvider(_period)),
              loading: const SizedBox(height: 120),
              builder: (data) => _AttendanceReportCard(report: data),
            ),
          ],
        ),
      ),
    );
  }
}

class _MonthlyReportCard extends StatelessWidget {
  const _MonthlyReportCard({required this.report});

  final MonthlyReport report;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: S.monthlyReport,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: StatTile(
                  label: S.totalPaid,
                  value: Fmt.money(report.totalPaid),
                  color: AppTheme.paid,
                ),
              ),
              Expanded(
                child: StatTile(
                  label: S.totalDue,
                  value: Fmt.money(report.totalDue),
                ),
              ),
              Expanded(
                child: StatTile(
                  label: S.totalDebt,
                  value: Fmt.money(report.totalDebt),
                  color: report.totalDebt > 0 ? AppTheme.unpaid : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (report.groups.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text("Bu oyda ma'lumot yo'q"),
            )
          else
            for (final group in report.groups) ...[
              const Divider(),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            group.groupName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          '${Fmt.money(group.totalPaid)} / '
                          '${Fmt.money(group.totalDue)}',
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        StatusChip(
                          label: '${S.paid}: ${group.paidCount}',
                          color: AppTheme.paid,
                        ),
                        if (group.partialCount > 0)
                          StatusChip(
                            label: '${S.partial}: ${group.partialCount}',
                            color: AppTheme.partial,
                          ),
                        if (group.unpaidCount > 0)
                          StatusChip(
                            label: '${S.unpaid}: ${group.unpaidCount}',
                            color: AppTheme.unpaid,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
        ],
      ),
    );
  }
}

/// Oddiy ustunli diagramma.
///
/// Tashqi grafik kutubxonasi qo'shilmadi: 6-12 ta ustun uchun oddiy
/// `Container` yetarli va ilova hajmi oshmaydi.
class _TrendCard extends StatelessWidget {
  const _TrendCard({required this.points});

  final List<RevenuePoint> points;

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) return const SizedBox.shrink();

    final maxValue = points
        .map((point) => point.expected > point.collected
            ? point.expected
            : point.collected)
        .fold<int>(1, (a, b) => a > b ? a : b);

    return SectionCard(
      title: S.revenueTrend,
      child: SizedBox(
        height: 160,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final point in points)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        Fmt.compact(point.collected),
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const SizedBox(height: 4),
                      Expanded(
                        child: Stack(
                          alignment: Alignment.bottomCenter,
                          children: [
                            // Kutilgan summa — och fon.
                            FractionallySizedBox(
                              heightFactor: point.expected / maxValue,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                              ),
                            ),
                            // Yig'ilgan summa — to'q.
                            FractionallySizedBox(
                              heightFactor: point.collected / maxValue,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: AppTheme.paid,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        Fmt.monthLabel(point.month).substring(0, 3),
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AttendanceReportCard extends StatelessWidget {
  const _AttendanceReportCard({required this.report});

  final AttendanceReport report;

  @override
  Widget build(BuildContext context) {
    if (report.groups.isEmpty && report.absentees.isEmpty) {
      return const SizedBox.shrink();
    }

    return SectionCard(
      title: S.attendanceRate,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final group in report.groups)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(group.groupName)),
                      Text(
                        Fmt.percent(group.attendanceRate),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ProgressBar(
                    value: group.attendanceRate / 100,
                    color: group.attendanceRate >= 80
                        ? AppTheme.paid
                        : AppTheme.partial,
                  ),
                ],
              ),
            ),
          if (report.absentees.isNotEmpty) ...[
            const Divider(),
            const SizedBox(height: 8),
            Text(
              'Eng ko‘p qoldiradiganlar',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 8),
            for (final student in report.absentees.take(5))
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text(student.fullName),
                subtitle: Text(
                  '${student.totalSessions} darsdan '
                  '${student.absentCount} tasida yo‘q',
                ),
                trailing: Text(
                  Fmt.percent(student.attendanceRate),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppTheme.absent,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
