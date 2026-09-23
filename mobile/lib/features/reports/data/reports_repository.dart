import '../../../core/network/api_client.dart';
import '../domain/reports.dart';

class ReportsRepository {
  ReportsRepository(this._api);

  final ApiClient _api;

  Future<Dashboard> dashboard() async =>
      Dashboard.fromJson(await _api.getJson('/reports/dashboard'));

  Future<MonthlyReport> monthly({
    required int year,
    required int month,
  }) async {
    final json = await _api.getJson(
      '/reports/monthly',
      query: {'year': year, 'month': month},
    );
    return MonthlyReport.fromJson(json);
  }

  Future<List<RevenuePoint>> revenueTrend({int months = 6}) async {
    final json = await _api.getJson(
      '/reports/revenue-trend',
      query: {'months': months},
    );
    return (json['points'] as List<dynamic>? ?? const [])
        .map((item) => RevenuePoint.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<AttendanceReport> attendance({int? year, int? month}) async {
    final json = await _api.getJson('/reports/attendance', query: {
      if (year != null) 'year': year,
      if (month != null) 'month': month,
    });
    return AttendanceReport.fromJson(json);
  }
}
