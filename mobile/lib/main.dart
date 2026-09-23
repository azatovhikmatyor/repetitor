import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/network/token_storage.dart';
import 'core/providers.dart';
import 'features/auth/state/auth_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Tokenlar runApp'dan oldin o'qiladi — shunda birinchi kadr to'g'ri
  // ekrandan boshlanadi va login ekrani "chaqnab" o'tmaydi.
  final tokens = TokenStorage();
  await tokens.load();

  final container = ProviderContainer(
    overrides: [tokenStorageProvider.overrideWithValue(tokens)],
  );
  // Sessiyani fon rejimida tekshiramiz; shu vaqt ichida splash ko'rinadi.
  unawaited(container.read(authControllerProvider.notifier).restore());

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const RepetitorApp(),
    ),
  );
}
