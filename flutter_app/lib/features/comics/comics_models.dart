import '../../core/network/image_proxy.dart';

class ComicCategory {
  const ComicCategory({
    required this.id,
    required this.name,
  });

  final String id;
  final String name;

  factory ComicCategory.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const ComicCategory(id: '', name: '');
    }
    return ComicCategory(
      id: (json['id'] as String?)?.trim() ?? '',
      name: (json['name'] as String?)?.trim() ?? '',
    );
  }
}

class ComicSummary {
  const ComicSummary({
    required this.id,
    required this.title,
    required this.cover,
    required this.source,
    required this.latestChapter,
    required this.categoryId,
    this.tags = const <String>[],
    this.description,
    this.author,
  });

  final String id;
  final String title;
  final String cover;
  final String source;
  final String latestChapter;
  final String categoryId;
  final List<String> tags;
  final String? description;
  final String? author;

  factory ComicSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const ComicSummary(
        id: '',
        title: '',
        cover: '',
        source: '',
        latestChapter: '',
        categoryId: '',
      );
    }
    final tags = (json['tags'] as List?)?.whereType<String>().toList() ?? <String>[];
    final rawCover = (json['cover'] as String?)?.trim() ?? '';
    return ComicSummary(
      id: (json['id'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      cover: proxyImageUrl(rawCover),
      source: (json['source'] as String?)?.trim() ?? '',
      latestChapter: (json['latestChapter'] as String?)?.trim() ?? (json['latest'] as String?)?.trim() ?? '',
      categoryId: (json['category'] as String?)?.trim() ?? (json['categoryId'] as String?)?.trim() ?? '',
      tags: tags,
      description: (json['description'] as String?)?.trim(),
      author: (json['author'] as String?)?.trim(),
    );
  }
}

class ComicDetail {
  const ComicDetail({
    required this.id,
    required this.title,
    required this.cover,
    required this.author,
    required this.description,
    required this.status,
    required this.source,
    this.tags = const <String>[],
  });

  final String id;
  final String title;
  final String cover;
  final String author;
  final String description;
  final String status;
  final String source;
  final List<String> tags;

  factory ComicDetail.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const ComicDetail(
        id: '',
        title: '',
        cover: '',
        author: '',
        description: '',
        status: '',
        source: '',
      );
    }
    final tags = (json['tags'] as List?)?.whereType<String>().toList() ?? <String>[];
    final rawCover = (json['cover'] as String?)?.trim() ?? '';
    return ComicDetail(
      id: (json['id'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      cover: proxyImageUrl(rawCover),
      author: (json['author'] as String?)?.trim() ?? '',
      description: (json['description'] as String?)?.trim() ?? '',
      status: (json['status'] as String?)?.trim() ?? '',
      source: (json['source'] as String?)?.trim() ?? '',
      tags: tags,
    );
  }
}

class ComicChapter {
  const ComicChapter({
    required this.id,
    required this.title,
    required this.index,
    this.updateTime,
  });

  final String id;
  final String title;
  final int index;
  final String? updateTime;

  factory ComicChapter.fromJson(Map<String, dynamic>? json, {int? index}) {
    if (json == null) {
      return const ComicChapter(id: '', title: '', index: 0);
    }
    final idx = index ?? (json['index'] as int?) ?? (json['order'] as int?) ?? 0;
    return ComicChapter(
      id: (json['id'] as String?)?.trim() ?? '',
      title: (json['title'] as String?)?.trim() ?? '',
      index: idx,
      updateTime: (json['updateTime'] as String?)?.trim(),
    );
  }
}

class ComicPageImage {
  const ComicPageImage({
    required this.page,
    required this.url,
    this.width,
    this.height,
  });

  final int page;
  final String url;
  final int? width;
  final int? height;

  factory ComicPageImage.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const ComicPageImage(page: 0, url: '');
    }
    return ComicPageImage(
      page: (json['page'] as num?)?.toInt() ?? 0,
      url: (json['url'] as String?)?.trim() ?? '',
      width: (json['width'] as num?)?.toInt(),
      height: (json['height'] as num?)?.toInt(),
    );
  }
}

class ComicChapterImages {
  const ComicChapterImages({
    required this.images,
    required this.total,
    this.expectedTotal,
  });

  final List<ComicPageImage> images;
  final int total;
  final int? expectedTotal;
}

class ComicDetailData {
  const ComicDetailData({
    required this.detail,
    required this.chapters,
  });

  final ComicDetail detail;
  final List<ComicChapter> chapters;
}

class ComicFeed {
  const ComicFeed({
    required this.items,
    required this.hasMore,
  });

  final List<ComicSummary> items;
  final bool hasMore;
}

class ComicSourceInfo {
  const ComicSourceInfo({
    required this.id,
    required this.name,
    this.type,
  });

  final String id;
  final String name;
  final String? type;

  factory ComicSourceInfo.fromJson(String id, Map<String, dynamic>? json) {
    if (json == null) {
      return ComicSourceInfo(id: id, name: id);
    }
    return ComicSourceInfo(
      id: id,
      name: (json['name'] as String?)?.trim().isNotEmpty == true ? (json['name'] as String).trim() : id,
      type: (json['type'] as String?)?.trim(),
    );
  }
}
