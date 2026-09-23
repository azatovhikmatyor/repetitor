import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/widgets/async_view.dart';
import '../../../router/app_router.dart';
import '../state/students_providers.dart';

/// O'qituvchining barcha o'quvchilari — qidiruv bilan.
///
/// 200 ta o'quvchi ichidan birini topish uchun aylantirish shart emas.
class StudentsScreen extends ConsumerStatefulWidget {
  const StudentsScreen({super.key});

  @override
  ConsumerState<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends ConsumerState<StudentsScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final students = ref.watch(studentsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(S.students)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: '${S.search}: ism yoki telefon',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _controller.text.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _controller.clear();
                          ref.read(studentSearchProvider.notifier).state = '';
                        },
                        icon: const Icon(Icons.close_rounded),
                      ),
              ),
              onChanged: (value) =>
                  ref.read(studentSearchProvider.notifier).state = value,
            ),
          ),
          Expanded(
            child: AsyncView(
              value: students,
              onRetry: () => ref.invalidate(studentsProvider),
              builder: (page) {
                if (page.items.isEmpty) {
                  return EmptyView(
                    title: _controller.text.isEmpty
                        ? "Hali o'quvchi yo'q"
                        : 'Topilmadi',
                    message: _controller.text.isEmpty
                        ? "O'quvchilar guruh ichidan qo'shiladi"
                        : null,
                    icon: Icons.person_search_outlined,
                  );
                }
                return ListView.separated(
                  itemCount: page.items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final student = page.items[index];
                    return ListTile(
                      leading: CircleAvatar(
                        child: Text(
                          student.fullName.isEmpty
                              ? '?'
                              : student.fullName[0].toUpperCase(),
                        ),
                      ),
                      title: Text(student.fullName),
                      subtitle: student.contact.isEmpty
                          ? null
                          : Text(student.contact),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => context.push(Routes.student(student.id)),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
