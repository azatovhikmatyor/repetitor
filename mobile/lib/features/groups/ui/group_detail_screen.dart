import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../../router/app_router.dart';
import '../../dashboard/state/dashboard_providers.dart';
import '../domain/group.dart';
import '../domain/group_student.dart';
import '../state/groups_providers.dart';
import 'add_student_sheet.dart';
import 'group_form_sheet.dart';

class GroupDetailScreen extends ConsumerWidget {
  const GroupDetailScreen({required this.groupId, super.key});

  final int groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final group = ref.watch(groupProvider(groupId));
    final students = ref.watch(groupStudentsProvider(groupId));

    return Scaffold(
      appBar: AppBar(
        title: Text(group.valueOrNull?.name ?? S.groups),
        actions: [
          if (group.hasValue)
            _GroupMenu(group: group.requireValue),
        ],
      ),
      floatingActionButton: group.valueOrNull?.isArchived == false
          ? FloatingActionButton.extended(
              onPressed: () => showAddStudentSheet(context, groupId),
              icon: const Icon(Icons.person_add_alt_rounded),
              label: const Text(S.addStudent),
            )
          : null,
      body: AsyncView(
        value: group,
        onRetry: () => ref.invalidate(groupProvider(groupId)),
        builder: (groupData) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(groupProvider(groupId));
            ref.invalidate(groupStudentsProvider(groupId));
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
            children: [
              _GroupHeader(group: groupData),
              const SizedBox(height: 12),
              _ActionRow(group: groupData),
              const SizedBox(height: 20),
              Row(
                children: [
                  Text(
                    S.students,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const Spacer(),
                  Text(
                    '${groupData.studentCount}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              AsyncView(
                value: students,
                onRetry: () => ref.invalidate(groupStudentsProvider(groupId)),
                loading: const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                ),
                builder: (list) {
                  if (list.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: EmptyView(
                        title: "Guruhda o'quvchi yo'q",
                        message: "Pastdagi tugma orqali qo'shing",
                        icon: Icons.person_outline_rounded,
                      ),
                    );
                  }
                  return Column(
                    children: [
                      for (final student in list) ...[
                        _StudentTile(
                          groupId: groupId,
                          groupFee: groupData.monthlyFee,
                          entry: student,
                          readOnly: groupData.isArchived,
                        ),
                        const SizedBox(height: 8),
                      ],
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.group});

  final Group group;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (group.isArchived) ...[
            StatusChip(
              label: S.archived,
              color: theme.colorScheme.outline,
              icon: Icons.inventory_2_outlined,
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              Expanded(
                child: StatTile(
                  label: S.monthlyFee,
                  value: Fmt.money(group.monthlyFee),
                  caption: "so‘m",
                ),
              ),
              Expanded(
                child: StatTile(
                  label: S.students,
                  value: '${group.studentCount}',
                ),
              ),
            ],
          ),
          if (group.schedule != null && group.schedule!.isNotEmpty) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(
                  Icons.schedule_rounded,
                  size: 18,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 8),
                Text(group.schedule!, style: theme.textTheme.bodyMedium),
              ],
            ),
          ],
          if (group.description != null && group.description!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              group.description!,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

/// Ikki asosiy amal — davomat va to'lov — bir tegishda.
class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.group});

  final Group group;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: () => context.push(Routes.attendance(group.id)),
            icon: const Icon(Icons.checklist_rounded),
            label: const Text(S.attendance),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton.tonalIcon(
            onPressed: () => context.push(Routes.payments(group.id)),
            icon: const Icon(Icons.payments_outlined),
            label: const Text(S.payments),
          ),
        ),
      ],
    );
  }
}

class _GroupMenu extends ConsumerWidget {
  const _GroupMenu({required this.group});

  final Group group;

  Future<void> _archive(BuildContext context, WidgetRef ref) async {
    final archived = group.isArchived;
    if (!archived) {
      final ok = await confirm(
        context,
        title: S.archive,
        message: S.archiveGroupHint,
        confirmLabel: S.archive,
      );
      if (!ok) return;
    }
    try {
      await ref
          .read(groupsRepositoryProvider)
          .setArchived(group.id, archived: !archived);
      invalidateGroup(ref, group.id);
      ref.invalidate(dashboardProvider);
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final ok = await confirm(
      context,
      title: S.delete,
      message: S.deleteGroupConfirm,
      confirmLabel: S.delete,
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(groupsRepositoryProvider).delete(group.id);
      ref.invalidate(groupsProvider);
      ref.invalidate(dashboardProvider);
      if (context.mounted) context.pop();
    } catch (error) {
      // Ma'lumoti bor guruh o'chirilmaydi — server 409 qaytaradi va
      // xabar "arxivlang" deb tushuntiradi.
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      onSelected: (value) => switch (value) {
        'edit' => showGroupFormSheet(context, group: group),
        'archive' => _archive(context, ref),
        'delete' => _delete(context, ref),
        _ => null,
      },
      itemBuilder: (context) => [
        const PopupMenuItem(
          value: 'edit',
          child: ListTile(
            leading: Icon(Icons.edit_outlined),
            title: Text(S.edit),
          ),
        ),
        PopupMenuItem(
          value: 'archive',
          child: ListTile(
            leading: Icon(
              group.isArchived
                  ? Icons.unarchive_outlined
                  : Icons.inventory_2_outlined,
            ),
            title: Text(group.isArchived ? S.unarchive : S.archive),
          ),
        ),
        const PopupMenuItem(
          value: 'delete',
          child: ListTile(
            leading: Icon(Icons.delete_outline_rounded),
            title: Text(S.delete),
          ),
        ),
      ],
    );
  }
}

class _StudentTile extends ConsumerWidget {
  const _StudentTile({
    required this.groupId,
    required this.groupFee,
    required this.entry,
    required this.readOnly,
  });

  final int groupId;
  final int groupFee;
  final GroupStudent entry;
  final bool readOnly;

  Future<void> _editFee(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController(
      text: entry.customFee?.toString() ?? '',
    );
    final result = await showDialog<String?>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text(S.customFee),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          autofocus: true,
          decoration: InputDecoration(
            suffixText: "so‘m",
            helperText: '${S.customFeeHint} (${Fmt.money(groupFee)})',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(''),
            child: const Text('Guruh narxi'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text),
            child: const Text(S.save),
          ),
        ],
      ),
    );
    if (result == null) return;

    try {
      await ref.read(groupsRepositoryProvider).setCustomFee(
            groupId,
            entry.student.id,
            customFee: result.trim().isEmpty ? null : int.parse(result.trim()),
          );
      ref.invalidate(groupStudentsProvider(groupId));
      ref.invalidate(dashboardProvider);
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  Future<void> _remove(BuildContext context, WidgetRef ref) async {
    final ok = await confirm(
      context,
      title: S.removeFromGroup,
      message: S.removeFromGroupConfirm,
      confirmLabel: S.removeFromGroup,
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref
          .read(groupsRepositoryProvider)
          .removeStudent(groupId, entry.student.id);
      invalidateGroup(ref, groupId);
      ref.invalidate(dashboardProvider);
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Card(
      child: ListTile(
        onTap: () => context.push(Routes.student(entry.student.id)),
        leading: CircleAvatar(
          child: Text(
            entry.student.fullName.isEmpty
                ? '?'
                : entry.student.fullName[0].toUpperCase(),
          ),
        ),
        title: Text(entry.student.fullName),
        subtitle: Row(
          children: [
            if (entry.student.contact.isNotEmpty)
              Flexible(
                child: Text(
                  entry.student.contact,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            if (entry.hasCustomFee) ...[
              const SizedBox(width: 8),
              StatusChip(
                label: Fmt.money(entry.monthlyFee),
                color: theme.colorScheme.primary,
                icon: Icons.local_offer_outlined,
              ),
            ],
          ],
        ),
        trailing: readOnly
            ? null
            : PopupMenuButton<String>(
                onSelected: (value) => switch (value) {
                  'fee' => _editFee(context, ref),
                  'remove' => _remove(context, ref),
                  _ => null,
                },
                itemBuilder: (context) => const [
                  PopupMenuItem(
                    value: 'fee',
                    child: ListTile(
                      leading: Icon(Icons.local_offer_outlined),
                      title: Text(S.customFee),
                    ),
                  ),
                  PopupMenuItem(
                    value: 'remove',
                    child: ListTile(
                      leading: Icon(Icons.person_remove_outlined),
                      title: Text(S.removeFromGroup),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
