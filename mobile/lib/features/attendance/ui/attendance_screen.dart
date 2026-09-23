import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../../router/app_router.dart';
import '../../dashboard/state/dashboard_providers.dart';
import '../domain/attendance.dart';
import '../state/attendance_controller.dart';

/// Kunlik davomat.
///
/// Talab 7: hamma standart "bor" holatida keladi, o'qituvchi faqat
/// kelmaganlarni bosadi va bir marta saqlaydi. 30 kishilik guruhda 5 ta
/// kelmagan bo'lsa — 5 ta tegish va bitta "Saqlash".
class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({required this.groupId, super.key});

  final int groupId;

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  late DateTime _date = DateTime.now();
  bool _saving = false;

  AttendanceKey get _key => AttendanceKey(widget.groupId, _date);

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year - 2),
      // Kelajakdagi sanaga davomat qo'yib bo'lmaydi (talab 7).
      lastDate: now,
      helpText: S.attendance,
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(attendanceControllerProvider(_key).notifier).save();
      ref.invalidate(dashboardProvider);
      if (mounted) showMessage(context, S.attendanceSaved);
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(attendanceControllerProvider(_key));
    final controller =
        ref.read(attendanceControllerProvider(_key).notifier);
    final isToday = Fmt.isoDate(_date) == Fmt.isoDate(DateTime.now());

    return Scaffold(
      appBar: AppBar(
        title: const Text(S.attendance),
        actions: [
          IconButton(
            tooltip: S.attendanceMonthly,
            onPressed: () =>
                context.push(Routes.monthlyAttendance(widget.groupId)),
            icon: const Icon(Icons.calendar_month_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          _DateBar(
            date: _date,
            isToday: isToday,
            onPick: _pickDate,
            onShift: (days) => setState(() {
              final next = _date.add(Duration(days: days));
              if (!next.isAfter(DateTime.now())) _date = next;
            }),
          ),
          const Divider(height: 1),
          Expanded(
            child: AsyncView(
              value: session,
              onRetry: () =>
                  ref.invalidate(attendanceControllerProvider(_key)),
              builder: (data) {
                if (data.entries.isEmpty) {
                  return const EmptyView(
                    title: "Guruhda o'quvchi yo'q",
                    icon: Icons.person_outline_rounded,
                  );
                }
                return Column(
                  children: [
                    _SummaryBar(session: data),
                    Expanded(
                      child: ListView.separated(
                        padding: const EdgeInsets.only(bottom: 96),
                        itemCount: data.entries.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final entry = data.entries[index];
                          return _AttendanceRow(
                            entry: entry,
                            enabled: data.isEditable,
                            onToggle: () => controller.toggle(entry.studentId),
                            onStatus: (status) =>
                                controller.setStatus(entry.studentId, status),
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: session.valueOrNull?.isEditable == true
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_rounded),
                  label: const Text(S.save),
                ),
              ),
            )
          : null,
    );
  }
}

class _DateBar extends StatelessWidget {
  const _DateBar({
    required this.date,
    required this.isToday,
    required this.onPick,
    required this.onShift,
  });

  final DateTime date;
  final bool isToday;
  final VoidCallback onPick;
  final void Function(int days) onShift;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          IconButton(
            onPressed: () => onShift(-1),
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Expanded(
            child: TextButton.icon(
              onPressed: onPick,
              icon: const Icon(Icons.calendar_today_rounded, size: 18),
              label: Text(
                isToday ? 'Bugun · ${Fmt.dayMonth(date)}' : Fmt.dayMonth(date),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),
          IconButton(
            onPressed: isToday ? null : () => onShift(1),
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}

class _SummaryBar extends StatelessWidget {
  const _SummaryBar({required this.session});

  final AttendanceSession session;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              session.isEditable ? S.attendanceHint : S.archived,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ),
          StatusChip(
            label: '${S.present}: ${session.presentCount}',
            color: AppTheme.paid,
          ),
          const SizedBox(width: 8),
          StatusChip(
            label: '${S.absent}: ${session.absentCount}',
            color: session.absentCount > 0
                ? AppTheme.absent
                : theme.colorScheme.outline,
          ),
        ],
      ),
    );
  }
}

class _AttendanceRow extends StatelessWidget {
  const _AttendanceRow({
    required this.entry,
    required this.enabled,
    required this.onToggle,
    required this.onStatus,
  });

  final AttendanceEntry entry;
  final bool enabled;
  final VoidCallback onToggle;
  final void Function(AttendanceStatus status) onStatus;

  Color _color(BuildContext context) => switch (entry.status) {
        AttendanceStatus.present => AppTheme.paid,
        AttendanceStatus.absent => AppTheme.absent,
        AttendanceStatus.late => AppTheme.partial,
        AttendanceStatus.excused => Theme.of(context).colorScheme.outline,
      };

  IconData get _icon => switch (entry.status) {
        AttendanceStatus.present => Icons.check_circle_rounded,
        AttendanceStatus.absent => Icons.cancel_rounded,
        AttendanceStatus.late => Icons.schedule_rounded,
        AttendanceStatus.excused => Icons.info_rounded,
      };

  Future<void> _showStatusMenu(BuildContext context) async {
    final status = await showModalBottomSheet<AttendanceStatus>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                entry.fullName,
                style: Theme.of(sheetContext).textTheme.titleMedium,
              ),
            ),
            for (final status in AttendanceStatus.values)
              ListTile(
                leading: Icon(
                  status == entry.status
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_unchecked_rounded,
                ),
                title: Text(status.label),
                onTap: () => Navigator.of(sheetContext).pop(status),
              ),
          ],
        ),
      ),
    );
    if (status != null) onStatus(status);
  }

  @override
  Widget build(BuildContext context) {
    final color = _color(context);
    final isAbsent = entry.status == AttendanceStatus.absent;

    return ListTile(
      // Bir tegish — bor/yo'q. Uzoq bosish — "kech qoldi"/"sababli".
      onTap: enabled ? onToggle : null,
      onLongPress: enabled ? () => _showStatusMenu(context) : null,
      leading: Icon(_icon, color: color, size: 28),
      title: Text(
        entry.fullName,
        style: TextStyle(
          fontWeight: FontWeight.w500,
          decoration: isAbsent ? TextDecoration.lineThrough : null,
          color: isAbsent ? Theme.of(context).colorScheme.outline : null,
        ),
      ),
      trailing: StatusChip(label: entry.status.label, color: color),
    );
  }
}
