import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../dashboard/state/dashboard_providers.dart';
import '../domain/group.dart';
import '../state/groups_providers.dart';

/// Guruh yaratish/tahrirlash oynasi.
///
/// `group` berilsa tahrirlash, aks holda yaratish. Pastdan chiquvchi oyna —
/// telefonda bir qo'l bilan to'ldirish qulay.
Future<void> showGroupFormSheet(
  BuildContext context, {
  Group? group,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) => _GroupFormSheet(group: group),
  );
}

class _GroupFormSheet extends ConsumerStatefulWidget {
  const _GroupFormSheet({this.group});

  final Group? group;

  @override
  ConsumerState<_GroupFormSheet> createState() => _GroupFormSheetState();
}

class _GroupFormSheetState extends ConsumerState<_GroupFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _feeController;
  late final TextEditingController _scheduleController;
  late final TextEditingController _descriptionController;
  bool _busy = false;

  bool get _isEdit => widget.group != null;

  @override
  void initState() {
    super.initState();
    final group = widget.group;
    _nameController = TextEditingController(text: group?.name ?? '');
    _feeController = TextEditingController(
      text: group == null ? '' : group.monthlyFee.toString(),
    );
    _scheduleController = TextEditingController(text: group?.schedule ?? '');
    _descriptionController =
        TextEditingController(text: group?.description ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _feeController.dispose();
    _scheduleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _busy) return;
    setState(() => _busy = true);

    final repository = ref.read(groupsRepositoryProvider);
    final fee = int.parse(_feeController.text.replaceAll(RegExp(r'\D'), ''));

    try {
      if (_isEdit) {
        await repository.update(
          widget.group!.id,
          name: _nameController.text,
          monthlyFee: fee,
          schedule: _scheduleController.text,
          description: _descriptionController.text,
        );
        invalidateGroup(ref, widget.group!.id);
      } else {
        await repository.create(
          name: _nameController.text,
          monthlyFee: fee,
          schedule: _scheduleController.text,
          description: _descriptionController.text,
        );
        ref.invalidate(groupsProvider);
      }
      ref.invalidate(dashboardProvider);
      if (mounted) Navigator.of(context).pop();
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
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                _isEdit ? S.edit : S.newGroup,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: S.groupName,
                  hintText: 'IELTS ertalabki',
                ),
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Nom kiriting'
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _feeController,
                decoration: const InputDecoration(
                  labelText: S.monthlyFee,
                  suffixText: "so‘m",
                  // Narx o'zgarsa o'tgan oylar o'zgarmasligini eslatib turamiz.
                  helperText: "O'zgartirilsa faqat kelasi oylarga ta'sir qiladi",
                ),
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                textInputAction: TextInputAction.next,
                validator: (value) {
                  final digits = value?.replaceAll(RegExp(r'\D'), '') ?? '';
                  if (digits.isEmpty) return "To'lov summasini kiriting";
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _scheduleController,
                decoration: const InputDecoration(
                  labelText: S.schedule,
                  hintText: S.scheduleHint,
                ),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: S.description),
                maxLines: 2,
                textCapitalization: TextCapitalization.sentences,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text(S.save),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
