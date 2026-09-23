enum GroupStatus {
  active('active'),
  archived('archived');

  const GroupStatus(this.wire);

  final String wire;

  static GroupStatus fromWire(String? value) => GroupStatus.values.firstWhere(
        (status) => status.wire == value,
        orElse: () => GroupStatus.active,
      );
}

class Group {
  const Group({
    required this.id,
    required this.name,
    required this.monthlyFee,
    required this.status,
    required this.studentCount,
    this.description,
    this.schedule,
  });

  final int id;
  final String name;
  final String? description;
  final int monthlyFee;
  final String? schedule;
  final GroupStatus status;
  final int studentCount;

  bool get isArchived => status == GroupStatus.archived;

  factory Group.fromJson(Map<String, dynamic> json) => Group(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        monthlyFee: json['monthly_fee'] as int? ?? 0,
        schedule: json['schedule'] as String?,
        status: GroupStatus.fromWire(json['status'] as String?),
        studentCount: json['student_count'] as int? ?? 0,
      );
}
