import '../../../core/network/api_client.dart';
import '../../../core/network/token_storage.dart';
import '../domain/app_user.dart';

class AuthRepository {
  AuthRepository({required ApiClient api, required TokenStorage tokens})
      : _api = api,
        _tokens = tokens;

  final ApiClient _api;
  final TokenStorage _tokens;

  /// Login yoki ro'yxatdan o'tish javobidan tokenlarni saqlab, userni qaytaradi.
  Future<AppUser> _consumeSession(Map<String, dynamic> body) async {
    await _tokens.save(
      accessToken: body['access_token'] as String,
      refreshToken: body['refresh_token'] as String,
    );
    return AppUser.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<AppUser> login({
    required String login,
    required String password,
  }) async {
    final body = await _api.post(
      '/auth/login',
      body: {'login': login.trim(), 'password': password},
      skipAuth: true,
    );
    return _consumeSession(body);
  }

  Future<AppUser> register({
    required String fullName,
    required String email,
    required String password,
    String? phone,
  }) async {
    final body = await _api.post(
      '/auth/register',
      body: {
        'full_name': fullName.trim(),
        'email': email.trim(),
        'password': password,
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      },
      skipAuth: true,
    );
    return _consumeSession(body);
  }

  Future<AppUser> me() async {
    final body = await _api.getJson('/auth/me');
    return AppUser.fromJson(body);
  }

  Future<AppUser> updateProfile({
    String? fullName,
    String? phone,
    String? email,
  }) async {
    final body = await _api.patch(
      '/auth/me',
      body: {
        if (fullName != null) 'full_name': fullName.trim(),
        if (phone != null) 'phone': phone.trim(),
        if (email != null) 'email': email.trim(),
      },
    );
    return AppUser.fromJson(body);
  }

  Future<void> logout() async {
    final refreshToken = _tokens.refreshToken;
    try {
      if (refreshToken != null) {
        await _api.post('/auth/logout', body: {'refresh_token': refreshToken});
      }
    } finally {
      // Server javob bermasa ham lokal sessiya tozalanadi.
      await _tokens.clear();
    }
  }

  /// Parol o'zgargach backend barcha tokenlarni bekor qiladi — shuning uchun
  /// bu yerdan keyin foydalanuvchi qaytadan kirishi kerak.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _api.post(
      '/auth/password/change',
      body: {
        'current_password': currentPassword,
        'new_password': newPassword,
      },
    );
    await _tokens.clear();
  }

  Future<void> forgotPassword(String email) => _api.post(
        '/auth/password/forgot',
        body: {'email': email.trim()},
        skipAuth: true,
      );

  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) =>
      _api.post(
        '/auth/password/reset',
        body: {'token': token.trim(), 'new_password': newPassword},
        skipAuth: true,
      );
}
