import 'package:flutter_test/flutter_test.dart';
import 'package:repetitor/features/reports/state/reports_providers.dart';

void main() {
  group('Period', () {
    test('oldinga surilganda yil chegarasidan o\u2018tadi', () {
      expect(const Period(2026, 12).shift(1), const Period(2027, 1));
      expect(const Period(2026, 1).shift(-1), const Period(2025, 12));
      expect(const Period(2026, 9).shift(-12), const Period(2025, 9));
    });

    test('taqqoslash yil va oyni hisobga oladi', () {
      expect(const Period(2026, 10).isAfter(const Period(2026, 9)), isTrue);
      expect(const Period(2027, 1).isAfter(const Period(2026, 12)), isTrue);
      expect(const Period(2026, 9).isAfter(const Period(2026, 9)), isFalse);
    });

    test('bir xil davr \u2014 bir xil kalit (family uchun muhim)', () {
      expect(const Period(2026, 9), const Period(2026, 9));
      expect(
        const Period(2026, 9).hashCode,
        const Period(2026, 9).hashCode,
      );
    });
  });
}
