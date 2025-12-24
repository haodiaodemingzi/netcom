/// 电子书功能相关数据模型
/// 包括分类、书籍、章节等核心数据模型

/// 电子书分类模型
class EbookCategory {
  final String id;
  final String name;
  final String type; // category, writer, group
  final String? group;

  const EbookCategory({
    required this.id,
    required this.name,
    required this.type,
    this.group,
  });

  /// 从JSON创建对象
  factory EbookCategory.fromJson(Map<String, dynamic> json) {
    return EbookCategory(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      type: json['type'] ?? 'category',
      group: json['group'] as String?,
    );
  }

  /// 转换为JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'group': group,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is EbookCategory && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

/// 电子书数据源信息
class EbookSourceInfo {
  final String id;
  final String name;
  final String description;
  final bool supportsSearch;

  const EbookSourceInfo({
    required this.id,
    required this.name,
    required this.description,
    required this.supportsSearch,
  });

  /// 从JSON创建对象
  factory EbookSourceInfo.fromJson(Map<String, dynamic> json) {
    return EbookSourceInfo(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      supportsSearch: json['supportsSearch'] ?? false,
    );
  }

  /// 转换为JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'supportsSearch': supportsSearch,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is EbookSourceInfo && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

/// 电子书摘要（列表展示用）
class EbookSummary {
  final String id;
  final String title;
  final String author;
  final String cover;
  final String category;
  final String categoryId;
  final String group;
  final String source;

  const EbookSummary({
    required this.id,
    required this.title,
    required this.author,
    required this.cover,
    required this.category,
    required this.categoryId,
    required this.group,
    required this.source,
  });

  /// 从JSON创建对象
  factory EbookSummary.fromJson(Map<String, dynamic> json) {
    return EbookSummary(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      author: json['author'] ?? '',
      cover: json['cover'] ?? '',
      category: json['category'] ?? '',
      categoryId: json['categoryId'] ?? '',
      group: json['group'] ?? '',
      source: json['source'] ?? '',
    );
  }

  /// 转换为JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'author': author,
      'cover': cover,
      'category': category,
      'categoryId': categoryId,
      'group': group,
      'source': source,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is EbookSummary && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

/// 电子书详情
class EbookDetail {
  final String id;
  final String title;
  final String author;
  final String cover;
  final String description;
  final String status;
  final String source;
  final List<EbookChapter> chapters;
  final int totalChapters;

  const EbookDetail({
    required this.id,
    required this.title,
    required this.author,
    required this.cover,
    required this.description,
    required this.status,
    required this.source,
    required this.chapters,
    required this.totalChapters,
  });

  /// 从JSON创建对象
  factory EbookDetail.fromJson(Map<String, dynamic> json) {
    final chaptersJson = json['chapters'] as List<dynamic>? ?? [];
    final chapters = chaptersJson
        .map((chapterJson) => EbookChapter.fromJson(chapterJson as Map<String, dynamic>))
        .toList();

    return EbookDetail(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      author: json['author'] ?? '',
      cover: json['cover'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? '',
      source: json['source'] ?? '',
      chapters: chapters,
      totalChapters: json['totalChapters'] ?? chapters.length,
    );
  }

  /// 转换为JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'author': author,
      'cover': cover,
      'description': description,
      'status': status,
      'source': source,
      'chapters': chapters.map((chapter) => chapter.toJson()).toList(),
      'totalChapters': totalChapters,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is EbookDetail && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

/// 章节信息
class EbookChapter {
  final String id;
  final String title;
  final int index;
  final String content;

  const EbookChapter({
    required this.id,
    required this.title,
    required this.index,
    this.content = '',
  });

  /// 从JSON创建对象
  factory EbookChapter.fromJson(Map<String, dynamic> json) {
    return EbookChapter(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      index: json['index'] ?? 0,
      content: json['content'] ?? '',
    );
  }

  /// 转换为JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'index': index,
      'content': content,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is EbookChapter && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

/// 章节内容（阅读器用）
class ChapterContent {
  final String id;
  final String title;
  final String content;
  final String bookTitle;
  final String author;

  const ChapterContent({
    required this.id,
    required this.title,
    required this.content,
    required this.bookTitle,
    required this.author,
  });

  /// 从JSON创建对象
  factory ChapterContent.fromJson(Map<String, dynamic> json) {
    return ChapterContent(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      bookTitle: json['bookTitle'] ?? '',
      author: json['author'] ?? '',
    );
  }

  /// 转换为JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'content': content,
      'bookTitle': bookTitle,
      'author': author,
    };
  }
}

/// 搜索结果
class EbookSearchResult {
  final List<EbookSummary> books;
  final bool hasMore;
  final int currentPage;
  final int totalPages;

  const EbookSearchResult({
    required this.books,
    required this.hasMore,
    required this.currentPage,
    required this.totalPages,
  });

  /// 从JSON创建对象
  factory EbookSearchResult.fromJson(Map<String, dynamic> json) {
    final booksJson = json['books'] as List<dynamic>? ?? [];
    final books = booksJson
        .map((bookJson) => EbookSummary.fromJson(bookJson as Map<String, dynamic>))
        .toList();

    return EbookSearchResult(
      books: books,
      hasMore: json['hasMore'] ?? false,
      currentPage: json['currentPage'] ?? 1,
      totalPages: json['totalPages'] ?? 1,
    );
  }
}

/// 分类书籍列表
class EbookCategoryResult {
  final List<EbookSummary> books;
  final bool hasMore;
  final int currentPage;
  final int totalPages;

  const EbookCategoryResult({
    required this.books,
    required this.hasMore,
    required this.currentPage,
    required this.totalPages,
  });

  /// 从JSON创建对象
  factory EbookCategoryResult.fromJson(Map<String, dynamic> json) {
    final booksJson = json['books'] as List<dynamic>? ?? [];
    final books = booksJson
        .map((bookJson) => EbookSummary.fromJson(bookJson as Map<String, dynamic>))
        .toList();

    return EbookCategoryResult(
      books: books,
      hasMore: json['hasMore'] ?? false,
      currentPage: json['currentPage'] ?? 1,
      totalPages: json['totalPages'] ?? 1,
    );
  }
}

/// API响应包装
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? error;
  final String? message;

  const ApiResponse({
    required this.success,
    this.data,
    this.error,
    this.message,
  });

  factory ApiResponse.success(T data, {String? message}) {
    return ApiResponse(
      success: true,
      data: data,
      message: message,
    );
  }

  factory ApiResponse.error(String error, {String? message}) {
    return ApiResponse(
      success: false,
      error: error,
      message: message,
    );
  }

  /// 从JSON创建对象
  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    if (json['code'] == 200) {
      final dataMap = (json['data'] as Map<String, dynamic>?) ?? <String, dynamic>{};
      return ApiResponse.success(
        fromJsonT(dataMap),
        message: json['message'] as String?,
      );
    }
    final errorMsg = json['error'] as String? ?? json['message'] as String? ?? '请求失败';
    return ApiResponse.error(
      errorMsg,
      message: json['message'] as String?,
    );
  }
}
