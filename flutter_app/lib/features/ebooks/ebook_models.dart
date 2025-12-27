class EbookCategory {
  const EbookCategory({
    required this.id,
    required this.name,
    required this.url,
    required this.group,
    required this.type,
  });

  final String id;
  final String name;
  final String url;
  final String group;
  final String type;

  factory EbookCategory.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookCategory(
        id: '',
        name: '',
        url: '',
        group: '',
        type: 'normal',
      );
    }
    return EbookCategory(
      id: (json['id'] as String?)?.trim() ?? '',
      name: (json['name'] as String?)?.trim() ?? '',
      url: (json['url'] as String?)?.trim() ?? '',
      group: (json['group'] as String?)?.trim() ?? '',
      type: (json['type'] as String?)?.trim() ?? 'normal',
    );
  }
}

class EbookSummary {
  const EbookSummary({
    required this.id,
    required this.title,
    required this.author,
    required this.url,
    required this.type,
    required this.categoryId,
    this.category,
    this.group,
  });

  final String id;
  final String title;
  final String author;
  final String url;
  final String type;
  final String categoryId;
  final String? category;
  final String? group;

  factory EbookSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookSummary(
        id: '',
        title: '',
        author: '',
        url: '',
        type: 'book',
        categoryId: '',
      );
    }
    return EbookSummary(
      id: (json['id'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      author: (json['author'] as String?)?.trim() ?? '',
      url: (json['url'] as String?)?.trim() ?? '',
      type: (json['type'] as String?)?.trim() ?? 'book',
      categoryId: (json['categoryId'] as String?)?.trim() ?? '',
      category: (json['category'] as String?)?.trim(),
      group: (json['group'] as String?)?.trim(),
    );
  }
}

class EbookDetail {
  const EbookDetail({
    required this.id,
    required this.title,
    required this.author,
    required this.description,
    required this.url,
    this.cover,
    this.source,
  });

  final String id;
  final String title;
  final String author;
  final String description;
  final String url;
  final String? cover;
  final String? source;

  EbookDetail copyWith({
    String? id,
    String? title,
    String? author,
    String? description,
    String? url,
    String? cover,
    String? source,
  }) {
    return EbookDetail(
      id: id ?? this.id,
      title: title ?? this.title,
      author: author ?? this.author,
      description: description ?? this.description,
      url: url ?? this.url,
      cover: cover ?? this.cover,
      source: source ?? this.source,
    );
  }

  factory EbookDetail.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookDetail(
        id: '',
        title: '',
        author: '',
        description: '',
        url: '',
      );
    }
    return EbookDetail(
      id: (json['id'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      author: (json['author'] as String?)?.trim() ?? '',
      description: (json['description'] as String?)?.trim() ?? '',
      url: (json['url'] as String?)?.trim() ?? '',
      cover: (json['cover'] as String?)?.trim(),
      source: (json['source'] as String?)?.trim(),
    );
  }
}

class EbookChapter {
  const EbookChapter({
    required this.id,
    required this.bookId,
    required this.title,
    required this.url,
    required this.order,
    this.index,
  });

  final String id;
  final String bookId;
  final String title;
  final String url;
  final int order;
  final int? index;

  factory EbookChapter.fromJson(Map<String, dynamic>? json, {int? order}) {
    if (json == null) {
      return const EbookChapter(
        id: '',
        bookId: '',
        title: '',
        url: '',
        order: 0,
      );
    }
    final idx = order ?? (json['order'] as int?) ?? 0;
    return EbookChapter(
      id: (json['id'] as String?)?.trim() ?? '',
      bookId: (json['bookId'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      url: (json['url'] as String?)?.trim() ?? '',
      order: idx,
      index: (json['index'] as int?) ?? idx,
    );
  }
}

class EbookChapterContent {
  const EbookChapterContent({
    required this.id,
    required this.title,
    required this.content,
    required this.url,
  });

  final String id;
  final String title;
  final String content;
  final String url;

  factory EbookChapterContent.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookChapterContent(
        id: '',
        title: '',
        content: '',
        url: '',
      );
    }
    return EbookChapterContent(
      id: (json['id'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      content: (json['content'] as String?)?.trim() ?? '',
      url: (json['url'] as String?)?.trim() ?? '',
    );
  }
}

class EbookFeed {
  const EbookFeed({
    required this.items,
    required this.hasMore,
    required this.total,
    required this.page,
    required this.totalPages,
  });

  final List<EbookSummary> items;
  final bool hasMore;
  final int total;
  final int page;
  final int totalPages;

  factory EbookFeed.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookFeed(
        items: [],
        hasMore: false,
        total: 0,
        page: 1,
        totalPages: 1,
      );
    }
    final booksList = (json['books'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    final items = booksList.map((e) => EbookSummary.fromJson(e)).toList();
    return EbookFeed(
      items: items,
      hasMore: (json['hasMore'] as bool?) ?? false,
      total: (json['total'] as int?) ?? 0,
      page: (json['page'] as int?) ?? 1,
      totalPages: (json['totalPages'] as int?) ?? 1,
    );
  }
}

class EbookDetailData {
  const EbookDetailData({
    required this.detail,
    required this.chapters,
    required this.totalChapters,
  });

  final EbookDetail detail;
  final List<EbookChapter> chapters;
  final int totalChapters;

  factory EbookDetailData.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookDetailData(
        detail: EbookDetail(id: '', title: '', author: '', description: '', url: ''),
        chapters: [],
        totalChapters: 0,
      );
    }
    final chaptersList = (json['chapters'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    final chapters = chaptersList.map((e) => EbookChapter.fromJson(e)).toList();
    return EbookDetailData(
      detail: EbookDetail.fromJson(json),
      chapters: chapters,
      totalChapters: (json['totalChapters'] as int?) ?? chapters.length,
    );
  }
}

class EbookChaptersData {
  const EbookChaptersData({
    required this.chapters,
    required this.total,
  });

  final List<EbookChapter> chapters;
  final int total;

  factory EbookChaptersData.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookChaptersData(
        chapters: [],
        total: 0,
      );
    }
    final chaptersList = (json['chapters'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    final chapters = chaptersList.map((e) => EbookChapter.fromJson(e)).toList();
    return EbookChaptersData(
      chapters: chapters,
      total: (json['total'] as int?) ?? chapters.length,
    );
  }
}

class EbookSourceInfo {
  const EbookSourceInfo({
    required this.id,
    required this.name,
  });

  final String id;
  final String name;

  factory EbookSourceInfo.fromJson(String id, Map<String, dynamic>? json) {
    if (json == null) {
      return EbookSourceInfo(id: id, name: id);
    }
    return EbookSourceInfo(
      id: id,
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? (json['name'] as String).trim()
          : id,
    );
  }
}

class EbookCategoriesResponse {
  const EbookCategoriesResponse({
    required this.categories,
  });

  final List<EbookCategory> categories;

  factory EbookCategoriesResponse.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookCategoriesResponse(categories: []);
    }
    final categoriesList = (json['categories'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    final categories = categoriesList.map((e) => EbookCategory.fromJson(e)).toList();
    return EbookCategoriesResponse(categories: categories);
  }
}

class EbookSourcesResponse {
  const EbookSourcesResponse({
    required this.sources,
  });

  final List<EbookSourceInfo> sources;

  factory EbookSourcesResponse.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookSourcesResponse(sources: []);
    }
    final sourcesList = (json['sources'] as List?)?.whereType<String>().toList() ?? [];
    final sources = sourcesList.map((id) => EbookSourceInfo.fromJson(id, null)).toList();
    return EbookSourcesResponse(sources: sources);
  }
}

class EbookMetadataResponse {
  const EbookMetadataResponse({
    required this.books,
    required this.total,
    required this.lastUpdated,
    required this.isLoading,
    required this.message,
  });

  final List<EbookSummary> books;
  final int total;
  final int? lastUpdated;
  final bool isLoading;
  final String message;

  factory EbookMetadataResponse.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EbookMetadataResponse(
        books: [],
        total: 0,
        lastUpdated: null,
        isLoading: false,
        message: '',
      );
    }
    final booksList = (json['books'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? [];
    final books = booksList.map((e) => EbookSummary.fromJson(e)).toList();
    return EbookMetadataResponse(
      books: books,
      total: (json['total'] as int?) ?? 0,
      lastUpdated: (json['last_updated'] as int?),
      isLoading: (json['is_loading'] as bool?) ?? false,
      message: (json['message'] as String?)?.trim() ?? '',
    );
  }
}
