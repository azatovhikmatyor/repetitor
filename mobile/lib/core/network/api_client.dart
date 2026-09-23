import 'dart:async';

import 'package:dio/dio.dart';

import '../config/env.dart';
import 'api_exception.dart';
import 'token_storage.dart';

/// Barcha HTTP so'rovlar shu klass orqali o'tadi.
///
/// Uch mas'uliyat bir joyda: access tokenni qo'shish, 401 da refresh qilib
/// so'rovni qayta yuborish va har qanday xatolikni `ApiException` ga
/// aylantirish. Repository'lar bularning hech birini bilmaydi.
class ApiClient {
  ApiClient({required TokenStorage tokens, Dio? dio})
      : _tokens = tokens,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: Env.apiUrl,
                connectTimeout: Env.connectTimeout,
                receiveTimeout: Env.receiveTimeout,
                contentType: Headers.jsonContentType,
                // Statusni o'zimiz tekshiramiz — 4xx ham DioException bo'lsin.
                validateStatus: (status) => status != null && status < 400,
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _tokens.accessToken;
          if (token != null && options.extra['skipAuth'] != true) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: _onError,
      ),
    );
  }

  final Dio _dio;
  final TokenStorage _tokens;

  /// Sessiya tugaganda (refresh ham ishlamadi) chaqiriladi — auth qatlami
  /// foydalanuvchini login ekraniga qaytaradi.
  void Function()? onSessionExpired;

  /// Bir vaqtda bir nechta so'rov 401 olsa, refresh faqat bir marta ketadi.
  Future<bool>? _refreshInFlight;

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final response = error.response;
    final isAuthEndpoint =
        error.requestOptions.path.startsWith('/auth/') &&
            !error.requestOptions.path.startsWith('/auth/me');

    final canRetry = response?.statusCode == 401 &&
        !isAuthEndpoint &&
        error.requestOptions.extra['retried'] != true &&
        _tokens.refreshToken != null;

    if (!canRetry) {
      handler.next(error);
      return;
    }

    final refreshed = await _refreshTokens();
    if (!refreshed) {
      await _tokens.clear();
      onSessionExpired?.call();
      handler.next(error);
      return;
    }

    try {
      final options = error.requestOptions;
      options.extra = {...options.extra, 'retried': true};
      options.headers['Authorization'] = 'Bearer ${_tokens.accessToken}';
      final retried = await _dio.fetch<dynamic>(options);
      handler.resolve(retried);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<bool> _refreshTokens() {
    return _refreshInFlight ??= _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _performRefresh() async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refresh_token': _tokens.refreshToken},
        options: Options(extra: {'skipAuth': true}),
      );
      final data = response.data!;
      await _tokens.save(
        accessToken: data['access_token'] as String,
        refreshToken: data['refresh_token'] as String,
      );
      return true;
    } on DioException {
      return false;
    }
  }

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await _send<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(path, queryParameters: query),
    );
    return response ?? <String, dynamic>{};
  }

  Future<List<dynamic>> getList(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await _send<List<dynamic>>(
      () => _dio.get<List<dynamic>>(path, queryParameters: query),
    );
    return response ?? const [];
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool skipAuth = false,
  }) async {
    final response = await _send<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        path,
        data: body,
        queryParameters: query,
        options: Options(extra: {'skipAuth': skipAuth}),
      ),
    );
    return response ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> patch(String path, {Object? body}) async {
    final response = await _send<Map<String, dynamic>>(
      () => _dio.patch<Map<String, dynamic>>(path, data: body),
    );
    return response ?? <String, dynamic>{};
  }

  Future<List<dynamic>> postList(String path, {Object? body}) async {
    final response = await _send<List<dynamic>>(
      () => _dio.post<List<dynamic>>(path, data: body),
    );
    return response ?? const [];
  }

  Future<Map<String, dynamic>> put(String path, {Object? body}) async {
    final response = await _send<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(path, data: body),
    );
    return response ?? <String, dynamic>{};
  }

  Future<void> delete(String path) async {
    await _send<dynamic>(() => _dio.delete<dynamic>(path));
  }

  Future<T?> _send<T>(Future<Response<T>> Function() request) async {
    try {
      final response = await request();
      return response.data;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
