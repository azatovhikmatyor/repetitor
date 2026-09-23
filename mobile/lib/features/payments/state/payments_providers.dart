import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../reports/state/reports_providers.dart';
import '../domain/payment.dart';

/// Guruh + oy juftligi bo'yicha to'lov holati.
class GroupPeriod {
  const GroupPeriod(this.groupId, this.period);

  final int groupId;
  final Period period;

  @override
  bool operator ==(Object other) =>
      other is GroupPeriod &&
      other.groupId == groupId &&
      other.period == period;

  @override
  int get hashCode => Object.hash(groupId, period);
}

final groupMonthProvider =
    FutureProvider.autoDispose.family<GroupMonth, GroupPeriod>((ref, key) {
  return ref.watch(paymentsRepositoryProvider).groupMonth(
        key.groupId,
        year: key.period.year,
        month: key.period.month,
      );
});

final paymentHistoryProvider =
    FutureProvider.autoDispose.family<List<Payment>, GroupPeriod>((ref, key) {
  return ref.watch(paymentsRepositoryProvider).history(
        key.groupId,
        year: key.period.year,
        month: key.period.month,
      );
});

final studentPaymentsProvider =
    FutureProvider.autoDispose.family<List<StudentCharge>, int>((ref, id) {
  return ref.watch(paymentsRepositoryProvider).forStudent(id);
});
