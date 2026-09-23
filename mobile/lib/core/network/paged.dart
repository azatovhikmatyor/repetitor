/// Backend'ning sahifalangan javobi: `{items, total, page, size, pages}`.
class Paged<T> {
  const Paged({
    required this.items,
    required this.total,
    required this.page,
    required this.size,
    required this.pages,
  });

  final List<T> items;
  final int total;
  final int page;
  final int size;
  final int pages;

  bool get hasMore => page < pages;

  factory Paged.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) itemFromJson,
  ) {
    return Paged(
      items: (json['items'] as List<dynamic>? ?? const [])
          .map((item) => itemFromJson(item as Map<String, dynamic>))
          .toList(),
      total: json['total'] as int? ?? 0,
      page: json['page'] as int? ?? 1,
      size: json['size'] as int? ?? 0,
      pages: json['pages'] as int? ?? 0,
    );
  }
}
