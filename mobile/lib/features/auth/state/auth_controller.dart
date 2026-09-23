import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../domain/app_user.dart';

enum AuthStatus {
  /// Ilova endi ishga tushdi — saqlangan sessiya tekshirilyapti.
  unknown,
  signedOut,

  /// Kirgan, lekin parolni almashtirmaguncha boshqa ekranlar yopiq.
  mustChangePassword,
  signedIn,
}

@immutable
class AuthState {
  const AuthState({required this.status, this.user});

  const AuthState.unknown() : status = AuthStatus.unknown, user = null;
  const AuthState.signedOut() : status = AuthStatus.signedOut, user = null;

  final AuthStatus status;
  final AppUser? user;

  bool get isResolved => status != AuthStatus.unknown;
  bool get isAuthenticated =>
      status == AuthStatus.signedIn || status == AuthStatus.mustChangePassword;
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final api = ref.read(apiClientProvider);
    // Refresh ham ishlamay qolsa foydalanuvchi login ekraniga qaytariladi.
    api.onSessionExpired = () {
      if (state.isAuthenticated) {
        state = const AuthState.signedOut();
      }
    };
    return const AuthState.unknown();
  }

  /// Saqlangan sessiyani tekshiradi. `main()` dan keyin bir marta chaqiriladi.
  Future<void> restore() async {
    final tokens = ref.read(tokenStorageProvider);
    if (!tokens.hasSession) {
      state = const AuthState.signedOut();
      return;
    }
    try {
      final user = await ref.read(authRepositoryProvider).me();
      state = _fromUser(user);
    } on ApiException {
      // Token eskirgan yoki hisob bloklangan — qaytadan kirish kerak.
      await tokens.clear();
      state = const AuthState.signedOut();
    }
  }

  AuthState _fromUser(AppUser user) => AuthState(
        status: user.mustChangePassword
            ? AuthStatus.mustChangePassword
            : AuthStatus.signedIn,
        user: user,
      );

  Future<void> login({required String login, required String password}) async {
    final user = await ref
        .read(authRepositoryProvider)
        .login(login: login, password: password);
    state = _fromUser(user);
  }

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    String? phone,
  }) async {
    final user = await ref.read(authRepositoryProvider).register(
          fullName: fullName,
          email: email,
          password: password,
          phone: phone,
        );
    state = _fromUser(user);
  }

  /// Parol o'zgargach backend barcha sessiyalarni yopadi, shuning uchun
  /// bu yerda ham chiqib ketamiz — foydalanuvchi yangi parol bilan kiradi.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await ref.read(authRepositoryProvider).changePassword(
          currentPassword: currentPassword,
          newPassword: newPassword,
        );
    state = const AuthState.signedOut();
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState.signedOut();
  }

  void updateUser(AppUser user) => state = _fromUser(user);
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Ekranlar uchun qulaylik: joriy foydalanuvchi.
final currentUserProvider = Provider<AppUser?>(
  (ref) => ref.watch(authControllerProvider).user,
);
