import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../dashboard/state/dashboard_providers.dart';
import '../../reports/state/reports_providers.dart';
import '../domain/payment.dart';
import '../state/payments_providers.dart';
import 'record_payment_sheet.dart';

/// Guruhning oylik to'lov holati.
///
/// Ikki ko'rinish: o'quvchilar bo'yicha holat va shu oyning to'lovlar tarixi.
class GroupPaymentsScreen extends ConsumerStatefulWidget {
  const GroupPaymentsScreen({required this.groupId, super.key});

  final int groupId;

  @override
  ConsumerState<GroupPaymentsScreen> createState() =>
      _GroupPaymentsScreenState();
}

class _GroupPaymentsScreenState extends ConsumerState<GroupPaymentsScreen> {
  Period _period = Period.current();
  bool _showHistory = false;

  GroupPeriod get _key => GroupPeriod(widget.groupId, _period);

  @override
  Widget build(BuildContext context) {
    final month = ref.watch(groupMonthProvider(_key));
    // To'lov o'tgan, joriy va kelasi oy uchun kiritiladi (talab 12).
    final maxPeriod = Period.current().shift(1);

    return Scaffold(
      appBar: AppBar(
        title: const Text(S.payments),
        actions: [
          IconButton(
            tooltip: S.paymentHistory,
            onPressed: () => setState(() => _showHistory = !_showHistory),
            icon: Icon(
              _showHistory ? Icons.people_alt_rounded : Icons.history_rounded,
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          MonthSelector(
            year: _period.year,
            month: _period.month,
            canGoForward: !_period.shift(1).isAfter(maxPeriod),
            onChanged: (year, month) =>
                setState(() => _period = Period(year, month)),
          ),
          const Divider(height: 1),
          Expanded(
            child: _showHistory
                ? _HistoryList(groupPeriod: _key)
                : AsyncView(
                    value: month,
                    onRetry: () => ref.invalidate(groupMonthProvider(_key)),
                    builder: (data) => _MonthView(
                      data: data,
                      groupId: widget.groupId,
                      period: _period,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _MonthView extends StatelessWidget {
  const _MonthView({
    required this.data,
    required this.groupId,
    required this.period,
  });

  final GroupMonth data;
  final int groupId;
  final Period period;

  @override
  Widget build(BuildContext context) {
    if (data.charges.isEmpty) {
      return const EmptyView(
        title: "Bu oyda hisob yo'q",
        message: "Guruhda faol o'quvchi bo'lmasa hisob ochilmaydi",
        icon: Icons.receipt_long_outlined,
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        SectionCard(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: StatTile(
                      label: S.totalPaid,
                      value: Fmt.money(data.totalPaid),
                      color: AppTheme.paid,
                    ),
                  ),
                  Expanded(
                    child: StatTile(
                      label: S.totalDue,
                      value: Fmt.money(data.totalDue),
                    ),
                  ),
                  Expanded(
                    child: StatTile(
                      label: S.totalDebt,
                      value: Fmt.money(data.totalDebt),
                      color: data.totalDebt > 0 ? AppTheme.unpaid : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ProgressBar(
                value: data.totalDue == 0 ? 0 : data.totalPaid / data.totalDue,
                color: AppTheme.paid,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        for (final charge in data.charges) ...[
          _ChargeTile(charge: charge, groupId: groupId, period: period),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _ChargeTile extends StatelessWidget {
  const _ChargeTile({
    required this.charge,
    required this.groupId,
    required this.period,
  });

  final Charge charge;
  final int groupId;
  final Period period;

  Color get _color => switch (charge.status) {
        ChargeStatus.paid => AppTheme.paid,
        ChargeStatus.overpaid => AppTheme.paid,
        ChargeStatus.partial => AppTheme.partial,
        ChargeStatus.unpaid => AppTheme.unpaid,
      };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isSettled = charge.balance <= 0;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => showRecordPaymentSheet(
          context,
          groupId: groupId,
          period: period,
          charge: charge,
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      charge.fullName,
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isSettled
                          ? Fmt.soum(charge.amountPaid)
                          : '${Fmt.money(charge.amountPaid)} / '
                              '${Fmt.money(charge.amountDue)}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusChip(label: charge.status.label, color: _color),
                  if (!isSettled) ...[
                    const SizedBox(height: 4),
                    Text(
                      Fmt.money(charge.balance),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.unpaid,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.add_circle_outline_rounded,
                color: theme.colorScheme.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HistoryList extends ConsumerWidget {
  const _HistoryList({required this.groupPeriod});

  final GroupPeriod groupPeriod;

  Future<void> _reverse(
    BuildContext context,
    WidgetRef ref,
    Payment payment,
  ) async {
    final ok = await confirm(
      context,
      title: S.reversePayment,
      message: S.reversePaymentConfirm,
      confirmLabel: S.reversePayment,
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(paymentsRepositoryProvider).reverse(payment.id);
      ref
        ..invalidate(paymentHistoryProvider(groupPeriod))
        ..invalidate(groupMonthProvider(groupPeriod))
        ..invalidate(dashboardProvider);
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(paymentHistoryProvider(groupPeriod));

    return AsyncView(
      value: history,
      onRetry: () => ref.invalidate(paymentHistoryProvider(groupPeriod)),
      builder: (payments) {
        if (payments.isEmpty) {
          return const EmptyView(
            title: "Bu oyda to'lov yo'q",
            icon: Icons.receipt_outlined,
          );
        }
        return ListView.separated(
          itemCount: payments.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, index) {
            final payment = payments[index];
            final theme = Theme.of(context);
            return ListTile(
              leading: Icon(
                payment.isReversal
                    ? Icons.undo_rounded
                    : Icons.arrow_downward_rounded,
                color: payment.isReversal ? AppTheme.unpaid : AppTheme.paid,
              ),
              title: Text(payment.fullName),
              subtitle: Text(
                '${payment.method.label} · ${Fmt.date(payment.paidAt)}'
                '${payment.note != null ? ' · ${payment.note}' : ''}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    Fmt.money(payment.amount),
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: payment.isReversal
                          ? AppTheme.unpaid
                          : AppTheme.paid,
                    ),
                  ),
                  // To'lov o'chirilmaydi — faqat bekor qilinadi.
                  if (!payment.isReversal)
                    IconButton(
                      tooltip: S.reversePayment,
                      onPressed: () => _reverse(context, ref, payment),
                      icon: const Icon(Icons.undo_rounded),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
