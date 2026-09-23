import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../reports/domain/reports.dart';

final dashboardProvider = FutureProvider<Dashboard>((ref) {
  return ref.watch(reportsRepositoryProvider).dashboard();
});
