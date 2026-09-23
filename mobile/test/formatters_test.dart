import 'package:flutter_test/flutter_test.dart';
import 'package:repetitor/core/format/formatters.dart';

void main() {
  group('Fmt.money', () {
    test('uch xonadan ajratadi', () {
      expect(Fmt.money(500000), '500\u00a0000');
      expect(Fmt.money(1250000), '1\u00a0250\u00a0000');
      expect(Fmt.money(999), '999');
      expect(Fmt.money(0), '0');
    });

    test('manfiy summa — bekor qilingan to\u2018lov', () {
      expect(Fmt.money(-500000), '-500\u00a0000');
    });
  });

  group('Fmt.compact', () {
    test('millionlarni qisqartiradi', () {
      expect(Fmt.compact(2725000), '2,7 mln');
      expect(Fmt.compact(12000000), '12 mln');
      expect(Fmt.compact(350000), '350 ming');
      expect(Fmt.compact(800), '800');
    });
  });

  test('Fmt.isoDate API kutgan formatda', () {
    expect(Fmt.isoDate(DateTime(2026, 9, 5)), '2026-09-05');
    expect(Fmt.isoDate(DateTime(2026, 12, 31)), '2026-12-31');
  });

  test('Fmt.percent butun sonda kasr qoldirmaydi', () {
    expect(Fmt.percent(85), '85%');
    expect(Fmt.percent(33.3), '33.3%');
  });
}
