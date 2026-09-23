import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../dashboard/state/dashboard_providers.dart';
import '../../students/domain/student.dart';
import '../domain/group_student.dart';
import '../state/groups_providers.dart';

/// Guruhga o'quvchi qo'shish.
///
/// Ikki yo'l bitta oynada: yangi o'quvchi yaratish yoki mavjudini topib
/// qo'shish. "Enrollment" so'zi hech qayerda ko'rinmaydi — o'qituvchi
/// shunchaki o'quvchi qo'shadi (talab 6).
Future<void> showAddStudentSheet(BuildContext context, int groupId) async {
  final temporaryPassword = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _AddStudentSheet(groupId: groupId),
  );

  // Yangi account yaratilgan bo'lsa, vaqtinchalik parol faqat shu yerda
  // ko'rsatiladi — o'qituvchi uni o'quvchiga aytishi kerak.
  if (temporaryPassword != null && context.mounted) {
    await showTemporaryPassword(context, temporaryPassword);
  }
}

class _AddStudentSheet extends ConsumerStatefulWidget {
  const _AddStudentSheet({required this.groupId});

  final int groupId;

  @override
  ConsumerState<_AddStudentSheet> createState() => _AddStudentSheetState();
}

class _AddStudentSheetState extends ConsumerState<_AddStudentSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _searchController = TextEditingController();

  bool _existing = false;
  bool _busy = false;
  List<Student> _results = const [];

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    if (query.trim().length < 2) {
      setState(() => _results = const []);
      return;
    }
    try {
      final page =
          await ref.read(studentsRepositoryProvider).list(search: query);
      if (mounted) setState(() => _results = page.items);
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _addNew() async {
    if (!_formKey.currentState!.validate() || _busy) return;
    await _add(
      () => ref.read(groupsRepositoryProvider).addStudent(
            widget.groupId,
            fullName: _nameController.text,
            phone: _phoneController.text,
          ),
    );
  }

  Future<void> _addExisting(Student student) =>
      _add(() => ref.read(groupsRepositoryProvider).addStudent(
            widget.groupId,
            studentId: student.id,
          ));

  Future<void> _add(Future<AddStudentResult> Function() action) async {
    setState(() => _busy = true);
    try {
      final result = await action();
      invalidateGroup(ref, widget.groupId);
      ref.invalidate(dashboardProvider);

      if (!mounted) return;
      // Vaqtinchalik parolni chaqiruvchiga qaytaramiz: oyna yopilgandan
      // keyin dialogni uning konteksti ko'rsatadi.
      Navigator.of(context).pop(result.temporaryPassword);
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              S.addStudent,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text(S.newStudent)),
                ButtonSegment(value: true, label: Text(S.existingStudent)),
              ],
              selected: {_existing},
              onSelectionChanged: (selection) =>
                  setState(() => _existing = selection.first),
            ),
            const SizedBox(height: 20),
            if (_existing) ..._buildExisting() else ..._buildNew(),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildNew() => [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: S.fullName),
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                validator: (value) =>
                    (value == null || value.trim().length < 2)
                        ? 'Ism kiriting'
                        : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phoneController,
                decoration: const InputDecoration(
                  labelText: S.phone,
                  hintText: '+998 90 123 45 67',
                  helperText: "O'quvchi shu raqam bilan tizimga kiradi",
                ),
                keyboardType: TextInputType.phone,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')),
                ],
                validator: (value) => (value == null || value.trim().length < 7)
                    ? 'Telefon raqamini kiriting'
                    : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _busy ? null : _addNew,
          child: _busy
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text(S.add),
        ),
      ];

  List<Widget> _buildExisting() => [
        TextField(
          controller: _searchController,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: S.searchStudent,
            prefixIcon: Icon(Icons.search_rounded),
            helperText: 'Boshqa guruhingizdagi o‘quvchini toping',
          ),
          onChanged: _search,
        ),
        const SizedBox(height: 12),
        if (_results.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(
              _searchController.text.trim().length < 2
                  ? 'Ism yoki telefon kiriting'
                  : 'Topilmadi',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          )
        else
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 320),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: _results.length,
              itemBuilder: (context, index) {
                final student = _results[index];
                return ListTile(
                  leading: CircleAvatar(
                    child: Text(_initial(student.fullName)),
                  ),
                  title: Text(student.fullName),
                  subtitle:
                      student.contact.isEmpty ? null : Text(student.contact),
                  trailing: const Icon(Icons.add_rounded),
                  onTap: _busy ? null : () => _addExisting(student),
                );
              },
            ),
          ),
      ];

  static String _initial(String name) =>
      name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
}

/// Vaqtinchalik parolni ko'rsatuvchi oyna — nusxa olish tugmasi bilan.
/// Parol tiklanganda ham shu oyna ishlatiladi.
Future<void> showTemporaryPassword(
  BuildContext context,
  String password,
) {
  return showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      icon: const Icon(Icons.key_rounded),
      title: const Text(S.temporaryPassword),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SelectableText(
            password,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              letterSpacing: 4,
            ),
          ),
          const SizedBox(height: 12),
          const Text(S.temporaryPasswordHint, textAlign: TextAlign.center),
        ],
      ),
      actions: [
        TextButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: password));
            showMessage(dialogContext, 'Nusxa olindi');
          },
          icon: const Icon(Icons.copy_rounded),
          label: const Text('Nusxa olish'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: const Text(S.close),
        ),
      ],
    ),
  );
}
