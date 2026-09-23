import 'package:dio/dio.dart';

/// Backend'ning yagona xatolik shakli: `{code, detail, details}`.
///
/// UI hech qachon `DioException` ni ko'rmaydi — `ApiClient` hamma narsani
/// shu turga aylantiradi, shunda ekranlar bir xil tarzda xatolik ko'rsatadi.
class ApiException implements Exception {
  ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.fieldErrors = const {},
  });

  final String code;
  final String message;
  final int? statusCode;

  /// `validation_error` uchun: maydon nomi -> xabar.
  final Map<String, String> fieldErrors;

  bool get isUnauthorized => statusCode == 401;
  bool get isNotFound => statusCode == 404;
  bool get isConflict => statusCode == 409;
  bool get isRateLimited => statusCode == 429;
  bool get requiresPasswordChange => code == 'password_change_required';
  bool get isNetwork => code == 'network_error';

  factory ApiException.fromDio(DioException error) {
    final response = error.response;

    if (response == null) {
      final isTimeout = error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout;
      return ApiException(
        code: 'network_error',
        message: isTimeout
            ? 'Server javob bermadi. Aloqani tekshiring.'
            : 'Internet aloqasi yo‘q',
      );
    }

    final data = response.data;
    if (data is Map<String, dynamic>) {
      final fieldErrors = <String, String>{};
      final details = data['details'];
      if (details is List) {
        for (final item in details) {
          if (item is Map && item['field'] != null) {
            fieldErrors[item['field'].toString()] =
                (item['message'] ?? '').toString();
          }
        }
      }
      return ApiException(
        code: (data['code'] ?? 'error').toString(),
        message: (data['detail'] ?? 'Xatolik yuz berdi').toString(),
        statusCode: response.statusCode,
        fieldErrors: fieldErrors,
      );
    }

    return ApiException(
      code: 'error',
      message: 'Xatolik yuz berdi (${response.statusCode})',
      statusCode: response.statusCode,
    );
  }

  @override
  String toString() => message;
}
