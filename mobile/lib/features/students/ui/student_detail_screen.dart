import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../attendance/domain/attendance.dart';
import '../../attendance/state/attendance_controller.dart';
import '../../groups/ui/add_student_sheet.dart';
import '../../payments/domain/payment.dart';
import '../../payments/state/payments_providers.dart';
import '../state/students_providers.dart';

/// O'quvchi kartasi: qaysi guruhlarda, davomati va to'lov tarixi.
class StudentDetailScreen extends ConsumerWidget {
  const StudentDetailScreen({required this.studentId, super.key});

  final int studentId;

  Future<void> _resetPassword(BuildContext context, WidgetRef ref) async {
    final ok = await confirm(
      context,
      title: S.resetStudentPassword,
      message: "O'quvchiga yangi vaqtinchalik parol beriladi va u tizimdan "
          "chiqariladi. Davom etamizmi?",
      confirmLabel: S.resetStudentPassword,
    );
    if (!ok) return;

    try {
      final password =
          await ref.read(studentsRepositoryProvider).resetPassword(studentId);
      ref.invalidate(studentDetailProvider(studentId));
      if (context.mounted) await showTemporaryPassword(context, password);
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(studentDetailProvider(studentId));
    final attendance = ref.watch(studentAttendanceProvider(studentId));
    final payments = ref.watch(studentPaymentsProvider(studentId));

    return Scaffold(
      appBar: AppBar(
        title: Text(detail.valueOrNull?.student.fullName ?? S.students),
        actions: [
          IconButton(
            tooltip: S.resetStudentPassword,
            onPressed: () => _resetPassword(context, ref),
            icon: const Icon(Icons.key_outlined),
          ),
        ],
      ),
      body: AsyncView(
        value: detail,
        onRetry: () => ref.invalidate(studentDetailProvider(studentId)),
        builder: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (data.student.contact.isNotEmpty)
                    Row(
                      children: [
                        const Icon(Icons.phone_outlined, size: 18),
                        const SizedBox(width: 8),
                        Text(data.student.contact),
                      ],
                    ),
                  if (data.mustChangePassword) ...[
                    const SizedBox(height: 12),
                    const StatusChip(
                      label: 'Parol hali almashtirilmagan',
                      color: AppTheme.partial,
                      icon: Icons.key_outlined,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            SectionCard(
              title: S.groups,
              child: Column(
                children: [
                  for (final group in data.groups)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(group.groupName),
                      subtitle: Text(Fmt.soum(group.monthlyFee)),
                      trailing: group.isActive
                          ? null
                          : StatusChip(
                              label: 'Chiqarilgan',
                              color: Theme.of(context).colorScheme.outline,
                            ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _AttendanceCard(value: attendance),
            const SizedBox(height: 16),
            _PaymentsCard(value: payments),
          ],
        ),
      ),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.value});

  final AsyncValue<List<StudentAttendanceSummary>> value;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: S.attendance,
      child: value.when(
        loading: () => const Center(
          child: Padding(
            padding: EdgeInsets.all(8),
            child: CircularProgressIndicator(),
          ),
        ),
        error: (_, __) => const Text(S.somethingWentWrong),
        data: (groups) {
          if (groups.isEmpty) {
            return const Text('Hali davomat yozilmagan');
          }
          return Column(
            children: [
              for (final summary in groups)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(summary.groupName)),
                          Text(
                            Fmt.percent(summary.attendanceRate),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ProgressBar(
                        value: summary.attendanceRate / 100,
                        color: summary.attendanceRate >= 80
                            ? AppTheme.paid
                            : AppTheme.partial,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${summary.totalSessions} darsdan '
                        '${summary.absentCount} tasida yo‘q',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _PaymentsCard extends StatelessWidget {
  const _PaymentsCard({required this.value});

  final AsyncValue<List<StudentCharge>> value;

  Color _statusColor(ChargeStatus status) => switch (status) {
        ChargeStatus.paid || ChargeStatus.overpaid => AppTheme.paid,
        ChargeStatus.partial => AppTheme.partial,
        ChargeStatus.unpaid => AppTheme.unpaid,
      };

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: S.paymentHistory,
      child: value.when(
        loading: () => const Center(
          child: Padding(
            padding: EdgeInsets.all(8),
            child: CircularProgressIndicator(),
          ),
        ),
        error: (_, __) => const Text(S.somethingWentWrong),
        data: (charges) {
          if (charges.isEmpty) return const Text("Hali to'lov yo'q");
          return Column(
            children: [
              for (final charge in charges.take(12))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(
                    '${Fmt.monthLabel(charge.month)} ${charge.year}',
                  ),
                  subtitle: Text(
                    '${charge.groupName} · '
                    '${Fmt.money(charge.amountPaid)} / '
                    '${Fmt.money(charge.amountDue)}',
                  ),
                  trailing: StatusChip(
                    label: charge.status.label,
                    color: _statusColor(charge.status),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
