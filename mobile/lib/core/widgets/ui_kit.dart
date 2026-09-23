import 'package:flutter/material.dart';

import '../format/formatters.dart';
import '../network/api_exception.dart';
import '../theme/app_theme.dart';

/// Kichik holat yorlig'i — to'lov holati, arxiv belgisi va h.k.
class StatusChip extends StatelessWidget {
  const StatusChip({
    required this.label,
    required this.color,
    this.icon,
    super.key,
  });

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Bosh ekrandagi katta raqamli katak.
class StatTile extends StatelessWidget {
  const StatTile({
    required this.label,
    required this.value,
    this.caption,
    this.color,
    super.key,
  });

  final String label;
  final String value;
  final String? caption;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: theme.textTheme.labelMedium
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        if (caption != null) ...[
          const SizedBox(height: 2),
          Text(
            caption!,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}

/// Sarlavhali karta — ekranlarni bo'limlarga ajratish uchun.
class SectionCard extends StatelessWidget {
  const SectionCard({
    required this.child,
    this.title,
    this.trailing,
    this.padding = const EdgeInsets.all(16),
    super.key,
  });

  final Widget child;
  final String? title;
  final Widget? trailing;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title != null) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title!,
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
              const SizedBox(height: 12),
            ],
            child,
          ],
        ),
      ),
    );
  }
}

/// Yig'ilish foizi ko'rsatkichi.
class ProgressBar extends StatelessWidget {
  const ProgressBar({required this.value, this.color, super.key});

  final double value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: value.clamp(0, 1),
        minHeight: 8,
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        valueColor: AlwaysStoppedAnimation(
          color ?? Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}

/// Oy tanlash paneli — to'lov va hisobot ekranlarida bir xil.
class MonthSelector extends StatelessWidget {
  const MonthSelector({
    required this.year,
    required this.month,
    required this.onChanged,
    this.canGoForward = true,
    super.key,
  });

  final int year;
  final int month;
  final void Function(int year, int month) onChanged;
  final bool canGoForward;

  void _shift(int delta) {
    final index = year * 12 + (month - 1) + delta;
    onChanged(index ~/ 12, index % 12 + 1);
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          onPressed: () => _shift(-1),
          icon: const Icon(Icons.chevron_left_rounded),
          tooltip: "O'tgan oy",
        ),
        Text(
          '${Fmt.monthLabel(month)} $year',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        IconButton(
          onPressed: canGoForward ? () => _shift(1) : null,
          icon: const Icon(Icons.chevron_right_rounded),
          tooltip: 'Kelasi oy',
        ),
      ],
    );
  }
}

/// Xatolikni pastdagi xabar sifatida ko'rsatadi.
void showError(BuildContext context, Object error) {
  final message =
      error is ApiException ? error.message : 'Xatolik yuz berdi';
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.unpaid,
      ),
    );
}

void showMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Xavfli amaldan oldin tasdiqlash (arxivlash, o'chirish, bekor qilish).
Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Ha',
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Yo‘q'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          style: destructive
              ? FilledButton.styleFrom(backgroundColor: AppTheme.unpaid)
              : null,
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}
