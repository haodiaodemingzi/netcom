import '../../core/utils/string_utils.dart';

class VideoCategory {
  const VideoCategory({
    required this.id,
    required this.name,
  });

  final String id;
  final String name;

  factory VideoCategory.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const VideoCategory(id: '', name: '');
    }
    final id = (json['id'] as String?)?.trim() ?? '';
    final name = (json['name'] as String?)?.trim() ?? '';
    if (isBlank(id) || isBlank(name)) {
      return const VideoCategory(id: '', name: '');
    }
    return VideoCategory(id: id, name: name);
  }
}

class VideoSourceInfo {
  const VideoSourceInfo({
    required this.id,
    required this.name,
    this.description,
  });

  final String id;
  final String name;
  final String? description;

  factory VideoSourceInfo.fromJson(String id, Map<String, dynamic>? json) {
    if (json == null) {
      return VideoSourceInfo(id: id, name: id);
    }
    final name = (json['name'] as String?)?.trim();
    return VideoSourceInfo(
      id: id,
      name: isNotBlank(name) ? name!.trim() : id,
      description: (json['description'] as String?)?.trim(),
    );
  }
}

class VideoSummary {
  const VideoSummary({
    required this.id,
    required this.title,
    required this.cover,
    required this.source,
    this.episodes,
    this.rating,
    this.status,
  });

  final String id;
  final String title;
  final String cover;
  final String source;
  final int? episodes;
  final double? rating;
  final String? status;

  factory VideoSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const VideoSummary(id: '', title: '', cover: '', source: '');
    }
    final id = (json['id'] as String?)?.trim() ?? '';
    final title = (json['title'] as String?)?.trim() ?? '';
    if (isBlank(id) || isBlank(title)) {
      return const VideoSummary(id: '', title: '', cover: '', source: '');
    }
    final cover = (json['cover'] as String?)?.trim() ?? '';
    final source = (json['source'] as String?)?.trim() ?? '';
    final episodes = (json['episodes'] as num?)?.toInt();
    final rating = (json['rating'] as num?)?.toDouble();
    final status = (json['status'] as String?)?.trim();
    return VideoSummary(
      id: id,
      title: title,
      cover: cover,
      source: source,
      episodes: episodes,
      rating: rating,
      status: status,
    );
  }
}

class VideoFeed {
  const VideoFeed({
    required this.items,
    required this.hasMore,
  });

  final List<VideoSummary> items;
  final bool hasMore;
}
