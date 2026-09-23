import '../../../core/l10n/strings.dart';

enum PaymentMethod {
  cash('cash'),
  card('card'),
  transfer('transfer'),
  other('other');

  const PaymentMethod(this.wire);

  final String wire;

  String get label => switch (this) {
        PaymentMethod.cash => S.cash,
        PaymentMethod.card => S.card,
        PaymentMethod.transfer => S.transfer,
        PaymentMethod.other => S.other,
      };

  static PaymentMethod fromWire(String? value) =>
      PaymentMethod.values.firstWhere(
        (method) => method.wire == value,
        orElse: () => PaymentMethod.other,
      );
}

enum ChargeStatus {
  unpaid('unpaid'),
  partial('partial'),
  paid('paid'),
  overpaid('overpaid');

  const ChargeStatus(this.wire);

  final String wire;

  String get label => switch (this) {
        ChargeStatus.unpaid => S.unpaid,
        ChargeStatus.partial => S.partial,
        ChargeStatus.paid => S.paid,
        ChargeStatus.overpaid => S.overpaid,
      };

  static ChargeStatus fromWire(String? value) => ChargeStatus.values.firstWhere(
        (status) => status.wire == value,
        orElse: () => ChargeStatus.unpaid,
      );
}

/// Bir o'quvchining bir oylik hisobi.
class Charge {
  const Charge({
    required this.chargeId,
    required this.studentId,
    required this.fullName,
    required this.amountDue,
    required this.amountPaid,
    required this.balance,
    required this.status,
    this.note,
  });

  final int chargeId;
  final int studentId;
  final String fullName;
  final int amountDue;
  final int amountPaid;
  final int balance;
  final ChargeStatus status;
  final String? note;

  factory Charge.fromJson(Map<String, dynamic> json) => Charge(
        chargeId: json['charge_id'] as int,
        studentId: json['student_id'] as int,
        fullName: json['full_name'] as String? ?? '',
        amountDue: json['amount_due'] as int? ?? 0,
        amountPaid: json['amount_paid'] as int? ?? 0,
        balance: json['balance'] as int? ?? 0,
        status: ChargeStatus.fromWire(json['status'] as String?),
        note: json['note'] as String?,
      );
}

/// Guruhning bir oylik to'lov holati.
class GroupMonth {
  const GroupMonth({
    required this.groupId,
    required this.groupName,
    required this.year,
    required this.month,
    required this.totalDue,
    required this.totalPaid,
    required this.totalDebt,
    required this.charges,
  });

  final int groupId;
  final String groupName;
  final int year;
  final int month;
  final int totalDue;
  final int totalPaid;
  final int totalDebt;
  final List<Charge> charges;

  factory GroupMonth.fromJson(Map<String, dynamic> json) => GroupMonth(
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
        year: json['year'] as int,
        month: json['month'] as int,
        totalDue: json['total_due'] as int? ?? 0,
        totalPaid: json['total_paid'] as int? ?? 0,
        totalDebt: json['total_debt'] as int? ?? 0,
        charges: (json['students'] as List<dynamic>? ?? const [])
            .map((item) => Charge.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

/// Pul harakati. Manfiy summa — bekor qilish yozuvi.
class Payment {
  const Payment({
    required this.id,
    required this.chargeId,
    required this.groupId,
    required this.groupName,
    required this.studentId,
    required this.fullName,
    required this.year,
    required this.month,
    required this.amount,
    required this.method,
    required this.paidAt,
    required this.isReversal,
    this.note,
    this.reversesId,
  });

  final int id;
  final int chargeId;
  final int groupId;
  final String groupName;
  final int studentId;
  final String fullName;
  final int year;
  final int month;
  final int amount;
  final PaymentMethod method;
  final DateTime paidAt;
  final String? note;
  final bool isReversal;
  final int? reversesId;

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'] as int,
        chargeId: json['charge_id'] as int,
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
        studentId: json['student_id'] as int,
        fullName: json['full_name'] as String? ?? '',
        year: json['year'] as int,
        month: json['month'] as int,
        amount: json['amount'] as int? ?? 0,
        method: PaymentMethod.fromWire(json['method'] as String?),
        paidAt: DateTime.parse(json['paid_at'] as String),
        note: json['note'] as String?,
        isReversal: json['is_reversal'] as bool? ?? false,
        reversesId: json['reverses_id'] as int?,
      );
}

/// O'quvchining bir oylik hisobi + shu hisobga tegishli to'lovlar.
class StudentCharge extends Charge {
  const StudentCharge({
    required super.chargeId,
    required super.studentId,
    required super.fullName,
    required super.amountDue,
    required super.amountPaid,
    required super.balance,
    required super.status,
    required this.groupId,
    required this.groupName,
    required this.year,
    required this.month,
    required this.payments,
    super.note,
  });

  final int groupId;
  final String groupName;
  final int year;
  final int month;
  final List<Payment> payments;

  factory StudentCharge.fromJson(Map<String, dynamic> json) => StudentCharge(
        chargeId: json['charge_id'] as int,
        studentId: json['student_id'] as int,
        fullName: json['full_name'] as String? ?? '',
        amountDue: json['amount_due'] as int? ?? 0,
        amountPaid: json['amount_paid'] as int? ?? 0,
        balance: json['balance'] as int? ?? 0,
        status: ChargeStatus.fromWire(json['status'] as String?),
        note: json['note'] as String?,
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
        year: json['year'] as int,
        month: json['month'] as int,
        payments: (json['payments'] as List<dynamic>? ?? const [])
            .map((item) => Payment.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}
