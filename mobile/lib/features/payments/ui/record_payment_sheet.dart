import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../dashboard/state/dashboard_providers.dart';
import '../../reports/state/reports_providers.dart';
import '../domain/payment.dart';
import '../state/payments_providers.dart';

/// To'lovni qayd etish.
///
/// Summa maydoni qarz bilan oldindan to'ldiriladi — odatiy holatda
/// o'qituvchi faqat "Saqlash" ni bosadi (talab 1: 3 qadamdan oshmasin).
Future<void> showRecordPaymentSheet(
  BuildContext context, {
  required int groupId,
  required Period period,
  required Charge charge,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _RecordPaymentSheet(
      groupId: groupId,
      period: period,
      charge: charge,
    ),
  );
}

class _RecordPaymentSheet extends ConsumerStatefulWidget {
  const _RecordPaymentSheet({
    required this.groupId,
    required this.period,
    required this.charge,
  });

  final int groupId;
  final Period period;
  final Charge charge;

  @override
  ConsumerState<_RecordPaymentSheet> createState() =>
      _RecordPaymentSheetState();
}

class _RecordPaymentSheetState extends ConsumerState<_RecordPaymentSheet> {
  late final TextEditingController _amountController;
  final _noteController = TextEditingController();
  PaymentMethod _method = PaymentMethod.cash;
  bool _busy = false;

  int get _remaining =>
      widget.charge.balance > 0 ? widget.charge.balance : widget.charge.amountDue;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController(text: _remaining.toString());
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final digits = _amountController.text.replaceAll(RegExp(r'\D'), '');
    final amount = int.tryParse(digits) ?? 0;
    if (amount <= 0) {
      showMessage(context, 'Summani kiriting');
      return;
    }
    if (_busy) return;
    setState(() => _busy = true);

    try {
      await ref.read(paymentsRepositoryProvider).record(
            widget.groupId,
            studentId: widget.charge.studentId,
            year: widget.period.year,
            month: widget.period.month,
            amount: amount,
            method: _method,
            note: _noteController.text,
          );
      final key = GroupPeriod(widget.groupId, widget.period);
      ref
        ..invalidate(groupMonthProvider(key))
        ..invalidate(paymentHistoryProvider(key))
        ..invalidate(dashboardProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.charge.fullName,
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              '${Fmt.monthLabel(widget.period.month)} ${widget.period.year} '
              '· ${S.totalDue}: ${Fmt.soum(widget.charge.amountDue)}',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _amountController,
              autofocus: true,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
              decoration: InputDecoration(
                labelText: S.amount,
                suffixText: "so‘m",
                helperText: widget.charge.amountPaid > 0
                    ? '${S.paid}: ${Fmt.money(widget.charge.amountPaid)} · '
                        '${S.debt}: ${Fmt.money(widget.charge.balance)}'
                    : null,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                ActionChip(
                  label: const Text(S.payFull),
                  onPressed: () =>
                      _amountController.text = _remaining.toString(),
                ),
                ActionChip(
                  label: Text(Fmt.compact(_remaining ~/ 2)),
                  onPressed: () =>
                      _amountController.text = (_remaining ~/ 2).toString(),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(S.method, style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            SegmentedButton<PaymentMethod>(
              segments: [
                for (final method in PaymentMethod.values)
                  ButtonSegment(value: method, label: Text(method.label)),
              ],
              selected: {_method},
              showSelectedIcon: false,
              onSelectionChanged: (selection) =>
                  setState(() => _method = selection.first),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _noteController,
              decoration: const InputDecoration(labelText: S.note),
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text(S.save),
            ),
          ],
        ),
      ),
    );
  }
}
