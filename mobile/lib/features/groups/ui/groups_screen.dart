import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/formatters.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_view.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../../router/app_router.dart';
import '../domain/group.dart';
import '../state/groups_providers.dart';
import 'group_form_sheet.dart';

class GroupsScreen extends ConsumerWidget {
  const GroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groups = ref.watch(groupsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(S.groups)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showGroupFormSheet(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text(S.newGroup),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(groupsProvider.future),
        child: AsyncView(
          value: groups,
          onRetry: () => ref.invalidate(groupsProvider),
          builder: (data) {
            if (data.isEmpty) {
              return EmptyView(
                title: S.noGroupsYet,
                message: S.createFirstGroup,
                icon: Icons.groups_outlined,
                action: FilledButton.icon(
                  onPressed: () => showGroupFormSheet(context),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text(S.newGroup),
                ),
              );
            }

            final active =
                data.where((group) => !group.isArchived).toList();
            final archived = data.where((group) => group.isArchived).toList();

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                for (final group in active) ...[
                  _GroupTile(group: group),
                  const SizedBox(height: 8),
                ],
                if (archived.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    S.archivedGroups,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: 8),
                  for (final group in archived) ...[
                    _GroupTile(group: group),
                    const SizedBox(height: 8),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _GroupTile extends StatelessWidget {
  const _GroupTile({required this.group});

  final Group group;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push(Routes.group(group.id)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            group.name,
                            style: theme.textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                        if (group.isArchived) ...[
                          const SizedBox(width: 8),
                          StatusChip(
                            label: S.archived,
                            color: theme.colorScheme.outline,
                            icon: Icons.inventory_2_outlined,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        '${group.studentCount} ta o‘quvchi',
                        Fmt.soum(group.monthlyFee),
                        if (group.schedule != null &&
                            group.schedule!.isNotEmpty)
                          group.schedule!,
                      ].join(' · '),
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              if (!group.isArchived)
                IconButton(
                  tooltip: S.attendance,
                  onPressed: () => context.push(Routes.attendance(group.id)),
                  icon: const Icon(Icons.checklist_rounded),
                  color: AppTheme.paid,
                ),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}
