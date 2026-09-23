class Student {
  const Student({
    required this.id,
    required this.fullName,
    required this.isActive,
    this.phone,
    this.username,
  });

  final int id;
  final String fullName;
  final String? phone;
  final String? username;
  final bool isActive;

  /// Ro'yxatda ism ostida ko'rsatiladigan qo'shimcha qator.
  String get contact => phone ?? username ?? '';

  factory Student.fromJson(Map<String, dynamic> json) => Student(
        id: json['id'] as int,
        fullName: json['full_name'] as String? ?? '',
        phone: json['phone'] as String?,
        username: json['username'] as String?,
        isActive: json['is_active'] as bool? ?? true,
      );
}

/// O'quvchining qaysi guruhlarda ekani.
class StudentGroupRef {
  const StudentGroupRef({
    required this.groupId,
    required this.groupName,
    required this.monthlyFee,
    required this.isActive,
  });

  final int groupId;
  final String groupName;
  final int monthlyFee;
  final bool isActive;

  factory StudentGroupRef.fromJson(Map<String, dynamic> json) =>
      StudentGroupRef(
        groupId: json['group_id'] as int,
        groupName: json['group_name'] as String? ?? '',
        monthlyFee: json['monthly_fee'] as int? ?? 0,
        isActive: (json['status'] as String?) == 'active',
      );
}

class StudentDetail {
  const StudentDetail({
    required this.student,
    required this.groups,
    required this.mustChangePassword,
  });

  final Student student;
  final List<StudentGroupRef> groups;
  final bool mustChangePassword;

  factory StudentDetail.fromJson(Map<String, dynamic> json) => StudentDetail(
        student: Student.fromJson(json),
        mustChangePassword: json['must_change_password'] as bool? ?? false,
        groups: (json['groups'] as List<dynamic>? ?? const [])
            .map((item) =>
                StudentGroupRef.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}
