import '../../students/domain/student.dart';

/// Guruhdagi o'quvchi.
///
/// Backend'da bu "enrollment", lekin bu so'z o'qituvchiga hech qayerda
/// ko'rsatilmaydi (talab 13) — shuning uchun model ham shunday nomlangan.
class GroupStudent {
  const GroupStudent({
    required this.enrollmentId,
    required this.student,
    required this.monthlyFee,
    required this.isActive,
    required this.joinedOn,
    this.customFee,
    this.leftOn,
  });

  final int enrollmentId;
  final Student student;

  /// Amaldagi narx: `customFee` bo'lsa o'sha, aks holda guruh narxi.
  final int monthlyFee;
  final int? customFee;
  final bool isActive;
  final DateTime joinedOn;
  final DateTime? leftOn;

  bool get hasCustomFee => customFee != null;

  factory GroupStudent.fromJson(Map<String, dynamic> json) => GroupStudent(
        enrollmentId: json['enrollment_id'] as int,
        student: Student.fromJson(json['student'] as Map<String, dynamic>),
        monthlyFee: json['monthly_fee'] as int? ?? 0,
        customFee: json['custom_fee'] as int?,
        isActive: (json['status'] as String?) == 'active',
        joinedOn: DateTime.parse(json['joined_on'] as String),
        leftOn: json['left_on'] == null
            ? null
            : DateTime.parse(json['left_on'] as String),
      );
}

/// Guruhga o'quvchi qo'shish natijasi.
class AddStudentResult {
  const AddStudentResult({required this.student, this.temporaryPassword});

  final GroupStudent student;

  /// Faqat yangi account yaratilganda to'ladi — o'qituvchi buni o'quvchiga
  /// aytishi kerak va u boshqa hech qachon ko'rsatilmaydi.
  final String? temporaryPassword;

  factory AddStudentResult.fromJson(Map<String, dynamic> json) =>
      AddStudentResult(
        student: GroupStudent.fromJson(json['student'] as Map<String, dynamic>),
        temporaryPassword: json['temporary_password'] as String?,
      );
}
