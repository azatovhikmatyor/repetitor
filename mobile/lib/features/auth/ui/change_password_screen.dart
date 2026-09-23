import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/widgets/ui_kit.dart';
import '../state/auth_controller.dart';

/// Parolni o'zgartirish.
///
/// `forced: true` — o'quvchi vaqtinchalik parol bilan birinchi marta kirgan;
/// bu ekrandan chiqib ketib bo'lmaydi (talab 3). `forced: false` — profildan
/// ixtiyoriy o'zgartirish.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({required this.forced, super.key});

  final bool forced;

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _repeatController = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _repeatController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).changePassword(
            currentPassword: _currentController.text,
            newPassword: _newController.text,
          );
      if (mounted) showMessage(context, S.passwordChanged);
      // Backend barcha sessiyalarni yopdi — router login ekraniga qaytaradi.
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Majburiy rejimda orqaga qaytish yopiq.
      canPop: !widget.forced,
      child: Scaffold(
        appBar: AppBar(
          title: const Text(S.changePassword),
          automaticallyImplyLeading: !widget.forced,
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (widget.forced) ...[
                        Card(
                          color: Theme.of(context)
                              .colorScheme
                              .primaryContainer
                              .withValues(alpha: 0.5),
                          child: const Padding(
                            padding: EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Icon(Icons.info_outline_rounded),
                                SizedBox(width: 12),
                                Expanded(child: Text(S.mustChangePassword)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],
                      TextFormField(
                        controller: _currentController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: S.currentPassword,
                        ),
                        textInputAction: TextInputAction.next,
                        validator: (value) => (value == null || value.isEmpty)
                            ? 'Joriy parolni kiriting'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _newController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: S.newPassword,
                          helperText: 'Kamida 8 belgi',
                        ),
                        textInputAction: TextInputAction.next,
                        validator: (value) =>
                            (value == null || value.length < 8)
                                ? 'Kamida 8 belgi'
                                : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _repeatController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Yangi parolni takrorlang',
                        ),
                        onFieldSubmitted: (_) => _submit(),
                        validator: (value) => value != _newController.text
                            ? 'Parollar mos kelmadi'
                            : null,
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: _busy
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text(S.save),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
