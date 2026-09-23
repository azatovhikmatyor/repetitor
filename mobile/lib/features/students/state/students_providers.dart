import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/paged.dart';
import '../../../core/providers.dart';
import '../domain/student.dart';

/// Qidiruv matni — `students` ekranida sarlavha maydoniga bog'langan.
final studentSearchProvider = StateProvider.autoDispose<String>((ref) => '');

final studentsProvider =
    FutureProvider.autoDispose<Paged<Student>>((ref) async {
  final search = ref.watch(studentSearchProvider);
  return ref.watch(studentsRepositoryProvider).list(search: search);
});

final studentDetailProvider =
    FutureProvider.autoDispose.family<StudentDetail, int>((ref, id) {
  return ref.watch(studentsRepositoryProvider).byId(id);
});
