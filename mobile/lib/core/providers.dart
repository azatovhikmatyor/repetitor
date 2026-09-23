import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/attendance/data/attendance_repository.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/groups/data/groups_repository.dart';
import '../features/payments/data/payments_repository.dart';
import '../features/reports/data/reports_repository.dart';
import '../features/students/data/students_repository.dart';
import 'network/api_client.dart';
import 'network/token_storage.dart';

/// Ilova ishga tushganda `main()` da haqiqiy nusxa bilan almashtiriladi
/// (tokenlar diskdan o'qib bo'lingandan keyin).
final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => throw UnimplementedError('main() da override qilinadi'),
);

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(tokens: ref.watch(tokenStorageProvider)),
);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    api: ref.watch(apiClientProvider),
    tokens: ref.watch(tokenStorageProvider),
  ),
);

final groupsRepositoryProvider = Provider<GroupsRepository>(
  (ref) => GroupsRepository(ref.watch(apiClientProvider)),
);

final studentsRepositoryProvider = Provider<StudentsRepository>(
  (ref) => StudentsRepository(ref.watch(apiClientProvider)),
);

final attendanceRepositoryProvider = Provider<AttendanceRepository>(
  (ref) => AttendanceRepository(ref.watch(apiClientProvider)),
);

final paymentsRepositoryProvider = Provider<PaymentsRepository>(
  (ref) => PaymentsRepository(ref.watch(apiClientProvider)),
);

final reportsRepositoryProvider = Provider<ReportsRepository>(
  (ref) => ReportsRepository(ref.watch(apiClientProvider)),
);
