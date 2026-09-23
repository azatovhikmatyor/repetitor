import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../domain/group.dart';
import '../domain/group_student.dart';

/// Guruhlar ro'yxati.
///
/// `autoDispose` emas — guruhlar ro'yxati asosiy ekranlardan biri va
/// tablar orasida qayta-qayta yuklanmasligi kerak. Yangilash uchun
/// `ref.invalidate(groupsProvider)`.
final groupsProvider = FutureProvider<List<Group>>((ref) async {
  final page = await ref.watch(groupsRepositoryProvider).list();
  return page.items;
});

/// Bitta guruh — detal ekrani uchun.
final groupProvider =
    FutureProvider.autoDispose.family<Group, int>((ref, groupId) {
  return ref.watch(groupsRepositoryProvider).byId(groupId);
});

/// Guruhdagi faol o'quvchilar.
final groupStudentsProvider =
    FutureProvider.autoDispose.family<List<GroupStudent>, int>((ref, groupId) {
  return ref.watch(groupsRepositoryProvider).students(groupId);
});

/// Guruhga tegishli hamma narsani birdaniga yangilaydi.
///
/// O'quvchi qo'shilsa guruhdagi soni, dashboard va oylik to'lov holati ham
/// o'zgaradi — shuning uchun ular birga invalidatsiya qilinadi.
void invalidateGroup(WidgetRef ref, int groupId) {
  ref.invalidate(groupProvider(groupId));
  ref.invalidate(groupStudentsProvider(groupId));
  ref.invalidate(groupsProvider);
}
