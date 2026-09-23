import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../../router/app_router.dart';
import '../../auth/state/auth_controller.dart';
import '../../reports/domain/reports.dart';
import '../state/dashboard_providers.dart';

/// Bosh ekran.
///
/// Talab 1 dagi muvaffaqiyat mezoni: o'qituvchi shu oyda qancha ishlaganini
/// bitta ekranda ko'radi, davomat qilinmagan guruhga bir tegishda o'tadi.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(user == null ? S.home : 'Salom, ${_firstName(user.fullName)}'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(dashboardProvider.future),
        child: AsyncView(
          value: dashboard,
          onRetry: () => ref.invalidate(dashboardProvider),
          builder: (data) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _MonthSummaryCard(data: data),
              if (data.groupsWithoutAttendanceToday.isNotEmpty) ...[
                const SizedBox(height: 12),
                _AttendanceReminder(groups: data.groupsWithoutAttendanceToday),
              ],
              const SizedBox(height: 12),
              if (data.groups.isEmpty)
                const _EmptyGroups()
              else ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    S.groups,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                for (final group in data.groups) ...[
                  _GroupCard(card: group),
                  const SizedBox(height: 8),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  static String _firstName(String fullName) =>
      fullName.trim().split(' ').first;
}

class _MonthSummaryCard extends StatelessWidget {
  const _MonthSummaryCard({required this.data});

  final Dashboard data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SectionCard(
      title: '${S.thisMonth} — ${Fmt.monthLabel(data.month)}',
      trailing: Text(
        Fmt.percent(data.collectionRate),
        style: theme.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
          color: data.collectionRate >= 80
              ? AppTheme.paid
              : data.collectionRate >= 50
                  ? AppTheme.partial
                  : AppTheme.unpaid,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: StatTile(
                  label: S.collected,
                  value: Fmt.money(data.collected),
                  caption: "so‘m",
                  color: AppTheme.paid,
                ),
              ),
              Expanded(
                child: StatTile(
                  label: S.expected,
                  value: Fmt.money(data.expected),
                  caption: "so‘m",
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ProgressBar(
            value: data.expected == 0 ? 0 : data.collected / data.expected,
            color: AppTheme.paid,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: StatTile(
                  label: S.debt,
                  value: Fmt.money(data.debt),
                  caption: '${data.debtorCount} ta qarzdor',
                  color: data.debt > 0 ? AppTheme.unpaid : null,
                ),
              ),
              Expanded(
                child: StatTile(
                  label: S.students,
                  value: '${data.activeStudentCount}',
                  caption: '${data.activeGroupCount} ta guruhda',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AttendanceReminder extends StatelessWidget {
  const _AttendanceReminder({required this.groups});

  final List<GroupRef> groups;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.tertiaryContainer.withValues(alpha: 0.4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.event_busy_rounded, color: scheme.tertiary),
                const SizedBox(width: 8),
                Text(
                  S.attendanceReminder,
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final group in groups)
                  ActionChip(
                    avatar: const Icon(Icons.checklist_rounded, size: 18),
                    label: Text(group.groupName),
                    onPressed: () =>
                        context.push(Routes.attendance(group.groupId)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.card});

  final DashboardGroupCard card;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push(Routes.group(card.groupId)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      card.groupName,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (card.attendanceTakenToday)
                    const StatusChip(
                      label: 'Davomat bor',
                      color: AppTheme.paid,
                      icon: Icons.check_rounded,
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${card.studentCount} ta o‘quvchi',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 12),
              ProgressBar(
                value: card.progress,
                color: card.totalDebt == 0 ? AppTheme.paid : AppTheme.partial,
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${Fmt.money(card.totalPaid)} / ${Fmt.money(card.totalDue)}',
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  if (card.totalDebt > 0)
                    Text(
                      '${S.debt}: ${Fmt.money(card.totalDebt)}',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: AppTheme.unpaid),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyGroups extends StatelessWidget {
  const _EmptyGroups();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: EmptyView(
        title: S.noGroupsYet,
        message: S.createFirstGroup,
        icon: Icons.groups_outlined,
        action: FilledButton.icon(
          onPressed: () => context.go(Routes.groups),
          icon: const Icon(Icons.add_rounded),
          label: const Text(S.newGroup),
        ),
      ),
    );
  }
}
