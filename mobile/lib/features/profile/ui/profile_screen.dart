import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/env.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../auth/state/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _editProfile(
    BuildContext context,
    WidgetRef ref, {
    required String fullName,
    required String? phone,
  }) async {
    final nameController = TextEditingController(text: fullName);
    final phoneController = TextEditingController(text: phone ?? '');

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text(S.edit),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: S.fullName),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneController,
              decoration: const InputDecoration(labelText: S.phone),
              keyboardType: TextInputType.phone,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text(S.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text(S.save),
          ),
        ],
      ),
    );
    if (saved != true) return;

    try {
      final user = await ref.read(authRepositoryProvider).updateProfile(
            fullName: nameController.text,
            phone: phoneController.text,
          );
      ref.read(authControllerProvider.notifier).updateUser(user);
      if (context.mounted) showMessage(context, 'Saqlandi');
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final ok = await confirm(
      context,
      title: S.logout,
      message: 'Tizimdan chiqasizmi?',
      confirmLabel: S.logout,
    );
    if (!ok) return;
    await ref.read(authControllerProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return const SizedBox.shrink();

    return Scaffold(
      appBar: AppBar(title: const Text(S.profile)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          SectionCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  child: Text(
                    user.fullName.isEmpty
                        ? '?'
                        : user.fullName[0].toUpperCase(),
                    style: const TextStyle(fontSize: 24),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.fullName,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      if (user.email != null)
                        Text(
                          user.email!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      if (user.phone != null)
                        Text(
                          user.phone!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => _editProfile(
                    context,
                    ref,
                    fullName: user.fullName,
                    phone: user.phone,
                  ),
                  icon: const Icon(Icons.edit_outlined),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.lock_outline_rounded),
                  title: const Text(S.changePassword),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push('/profile/password'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.logout_rounded),
                  title: const Text(S.logout),
                  onTap: () => _logout(context, ref),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              '${S.appName} · ${Env.apiBaseUrl}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.outline,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
