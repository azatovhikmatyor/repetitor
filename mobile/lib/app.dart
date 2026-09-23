import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/l10n/strings.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/state/auth_controller.dart';
import 'router/app_router.dart';

class RepetitorApp extends ConsumerWidget {
  const RepetitorApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    // Saqlangan sessiya tekshirilmaguncha router ishga tushmaydi.
    if (!auth.isResolved) {
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: _SplashScreen(),
      );
    }

    return MaterialApp.router(
      title: S.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: ref.watch(appRouterProvider),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
