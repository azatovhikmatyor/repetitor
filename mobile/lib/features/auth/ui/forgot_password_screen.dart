import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/ui_kit.dart';

/// Parolni tiklash — faqat o'qituvchilar uchun.
///
/// O'quvchi parolni o'zi tiklay olmaydi: u o'qituvchisiga murojaat qiladi
/// (talab 3). Shu sabab bu ekranda o'quvchilar haqida hech narsa yo'q.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .forgotPassword(_emailController.text);
      if (!mounted) return;
      setState(() => _codeSent = true);
      showMessage(context, S.resetCodeSent);
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (_busy) return;
    if (_passwordController.text.length < 8) {
      showMessage(context, 'Parol kamida 8 belgi bo‘lsin');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).resetPassword(
            token: _codeController.text,
            newPassword: _passwordController.text,
          );
      if (!mounted) return;
      showMessage(context, S.passwordChanged);
      context.pop();
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(S.forgotPassword)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _emailController,
                    enabled: !_codeSent,
                    decoration: const InputDecoration(labelText: S.email),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 16),
                  if (!_codeSent)
                    FilledButton(
                      onPressed: _busy ? null : _requestCode,
                      child: const Text('Kod yuborish'),
                    )
                  else ...[
                    TextField(
                      controller: _codeController,
                      decoration: const InputDecoration(labelText: S.resetCode),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: S.newPassword,
                        helperText: 'Kamida 8 belgi',
                      ),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _busy ? null : _reset,
                      child: const Text(S.save),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _codeSent = false),
                      child: const Text('Boshqa email kiritish'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
