enum UserRole {
  superAdmin('super_admin'),
  teacher('teacher'),
  student('student');

  const UserRole(this.wire);

  final String wire;

  static UserRole fromWire(String? value) => UserRole.values.firstWhere(
        (role) => role.wire == value,
        orElse: () => UserRole.student,
      );
}

class AppUser {
  const AppUser({
    required this.id,
    required this.role,
    required this.fullName,
    required this.isActive,
    required this.mustChangePassword,
    this.phone,
    this.username,
    this.email,
  });

  final int id;
  final UserRole role;
  final String fullName;
  final String? phone;
  final String? username;
  final String? email;
  final bool isActive;
  final bool mustChangePassword;

  bool get isTeacher => role == UserRole.teacher;
  bool get isAdmin => role == UserRole.superAdmin;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as int,
        role: UserRole.fromWire(json['role'] as String?),
        fullName: json['full_name'] as String? ?? '',
        phone: json['phone'] as String?,
        username: json['username'] as String?,
        email: json['email'] as String?,
        isActive: json['is_active'] as bool? ?? true,
        mustChangePassword: json['must_change_password'] as bool? ?? false,
      );

  AppUser copyWith({bool? mustChangePassword}) => AppUser(
        id: id,
        role: role,
        fullName: fullName,
        phone: phone,
        username: username,
        email: email,
        isActive: isActive,
        mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      );
}
