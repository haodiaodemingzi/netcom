import '../../core/network/image_proxy.dart';
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

class VideoDetail {
  const VideoDetail({
    required this.id,
    required this.title,
    required this.cover,
    required this.source,
    this.description,
    this.actors = const <String>[],
    this.tags = const <String>[],
    this.rating,
    this.status,
    this.area,
    this.year,
  });

  final String id;
  final String title;
  final String cover;
  final String source;
  final String? description;
  final List<String> actors;
  final List<String> tags;
  final double? rating;
  final String? status;
  final String? area;
  final String? year;

  factory VideoDetail.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const VideoDetail(id: '', title: '', cover: '', source: '');
    }
    final id = (json['id'] as String?)?.trim() ?? '';
    final title = (json['title'] as String?)?.trim() ?? (json['name'] as String?)?.trim() ?? '';
    if (isBlank(id) || isBlank(title)) {
      return const VideoDetail(id: '', title: '', cover: '', source: '');
    }
    final actorsRaw = json['actors'];
    final actors = actorsRaw is List ? actorsRaw.whereType<String>().toList() : <String>[];
    final tagsRaw = json['tags'];
    final tags = tagsRaw is List ? tagsRaw.whereType<String>().toList() : <String>[];
    final scoreStr = (json['score'] as String?)?.trim();
    double? rating;
    if (scoreStr != null && scoreStr.isNotEmpty) {
      rating = double.tryParse(scoreStr);
    }
    return VideoDetail(
      id: id,
      title: title,
      cover: (json['cover'] as String?)?.trim() ?? '',
      source: (json['source'] as String?)?.trim() ?? '',
      description: (json['description'] as String?)?.trim(),
      actors: actors,
      tags: tags,
      rating: rating,
      status: (json['status'] as String?)?.trim(),
      area: (json['area'] as String?)?.trim(),
      year: (json['year'] as String?)?.trim(),
    );
  }
}

class VideoEpisode {
  const VideoEpisode({
    required this.id,
    required this.title,
    required this.index,
    this.playUrl,
  });

  final String id;
  final String title;
  final int index;
  final String? playUrl;

  factory VideoEpisode.fromJson(Map<String, dynamic>? json, {int? index}) {
    if (json == null) {
      return const VideoEpisode(id: '', title: '', index: 0);
    }
    final id = (json['id'] as String?)?.trim() ?? '';
    final title = (json['title'] as String?)?.trim() ?? (json['name'] as String?)?.trim() ?? '';
    final idx = index ?? (json['index'] as int?) ?? (json['episode'] as int?) ?? 0;
    return VideoEpisode(
      id: id,
      title: title,
      index: idx,
      playUrl: (json['playUrl'] as String?)?.trim(),
    );
  }
}

class VideoPlaySource {
  const VideoPlaySource({
    required this.url,
    required this.quality,
    this.headers = const <String, String>{},
  });

  final String url;
  final String quality;
  final Map<String, String> headers;

  factory VideoPlaySource.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const VideoPlaySource(url: '', quality: 'default');
    }
    final headersRaw = json['headers'];
    final headers = headersRaw is Map<String, dynamic>
        ? headersRaw.map((k, v) => MapEntry(k, v.toString()))
        : <String, String>{};
    return VideoPlaySource(
      url: (json['url'] as String?)?.trim() ?? (json['videoUrl'] as String?)?.trim() ?? '',
      quality: (json['quality'] as String?)?.trim() ?? 'default',
      headers: headers,
    );
  }
}

class VideoDetailData {
  const VideoDetailData({
    required this.detail,
    required this.episodes,
  });

  final VideoDetail detail;
  final List<VideoEpisode> episodes;
}

class VideoPlayConfig {
  const VideoPlayConfig({
    required this.headers,
    required this.cookieUrl,
  });

  final Map<String, String> headers;
  final String cookieUrl;
}
