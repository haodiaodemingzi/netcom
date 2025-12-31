/// 播客分类
class PodcastCategory {
  final String id;
  final String name;

  PodcastCategory({
    required this.id,
    required this.name,
  });

  factory PodcastCategory.fromJson(Map<String, dynamic> json) {
    return PodcastCategory(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
    };
  }
}

/// 播客数据源信息
class PodcastSourceInfo {
  final String id;
  final String name;
  final bool enabled;

  PodcastSourceInfo({
    required this.id,
    required this.name,
    this.enabled = true,
  });

  factory PodcastSourceInfo.fromJson(Map<String, dynamic> json) {
    return PodcastSourceInfo(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      enabled: json['enabled'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'enabled': enabled,
    };
  }
}

/// 播客摘要（列表项）
class PodcastSummary {
  final String id;
  final String title;
  final String cover;
  final String source;
  final String? author;
  final int episodes;
  final String? description;
  final String? updateTime;

  PodcastSummary({
    required this.id,
    required this.title,
    required this.cover,
    required this.source,
    this.author,
    this.episodes = 0,
    this.description,
    this.updateTime,
  });

  factory PodcastSummary.fromJson(Map<String, dynamic> json) {
    return PodcastSummary(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      cover: json['cover'] ?? '',
      source: json['source'] ?? '',
      author: json['author'],
      episodes: json['episodes'] ?? 0,
      description: json['description'],
      updateTime: json['updateTime'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'cover': cover,
      'source': source,
      'author': author,
      'episodes': episodes,
      'description': description,
      'updateTime': updateTime,
    };
  }
}

/// 播客详情
class PodcastDetail {
  final String id;
  final String title;
  final String cover;
  final String source;
  final String? author;
  final int episodes;
  final String? description;
  final String? playCount;
  final String? updateTime;

  PodcastDetail({
    required this.id,
    required this.title,
    required this.cover,
    required this.source,
    this.author,
    this.episodes = 0,
    this.description,
    this.playCount,
    this.updateTime,
  });

  factory PodcastDetail.fromJson(Map<String, dynamic> json) {
    return PodcastDetail(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      cover: json['cover'] ?? '',
      source: json['source'] ?? '',
      author: json['author'],
      episodes: json['episodes'] ?? 0,
      description: json['description'],
      playCount: json['playCount'],
      updateTime: json['updateTime'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'cover': cover,
      'source': source,
      'author': author,
      'episodes': episodes,
      'description': description,
      'playCount': playCount,
      'updateTime': updateTime,
    };
  }
}

/// 播客单集
class PodcastEpisode {
  final String id;
  final String title;
  final int duration;
  final String? publishTime;
  final int order;
  final bool isPlayed;
  final int progress;
  final String? audioUrl;
  final String? audioUrlBackup;

  PodcastEpisode({
    required this.id,
    required this.title,
    required this.duration,
    this.publishTime,
    this.order = 0,
    this.isPlayed = false,
    this.progress = 0,
    this.audioUrl,
    this.audioUrlBackup,
  });

  /// 格式化时长，如 "30:15"
  String get formattedDuration {
    final minutes = duration ~/ 60;
    final seconds = duration % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  factory PodcastEpisode.fromJson(Map<String, dynamic> json) {
    return PodcastEpisode(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      duration: json['duration'] ?? 0,
      publishTime: json['publishTime'],
      order: json['order'] ?? 0,
      isPlayed: json['isPlayed'] ?? false,
      progress: json['progress'] ?? 0,
      audioUrl: json['audioUrl'],
      audioUrlBackup: json['audioUrlBackup'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'duration': duration,
      'publishTime': publishTime,
      'order': order,
      'isPlayed': isPlayed,
      'progress': progress,
      'audioUrl': audioUrl,
      'audioUrlBackup': audioUrlBackup,
    };
  }
}

/// 播客列表响应
class PodcastFeed {
  final List<PodcastSummary> programs;
  final bool hasMore;
  final int total;

  const PodcastFeed({
    this.programs = const [],
    this.hasMore = false,
    this.total = 0,
  });

  factory PodcastFeed.fromJson(Map<String, dynamic> json) {
    final programsJson = json['programs'] as List? ?? [];
    return PodcastFeed(
      programs: programsJson
          .map((e) => PodcastSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      hasMore: json['hasMore'] ?? false,
      total: json['total'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'programs': programs.map((e) => e.toJson()).toList(),
      'hasMore': hasMore,
      'total': total,
    };
  }
}

/// 单集列表响应
class EpisodesResponse {
  final List<PodcastEpisode> episodes;
  final bool hasMore;
  final int total;

  const EpisodesResponse({
    this.episodes = const [],
    this.hasMore = false,
    this.total = 0,
  });

  factory EpisodesResponse.fromJson(Map<String, dynamic> json) {
    final episodesJson = json['episodes'] as List? ?? [];
    return EpisodesResponse(
      episodes: episodesJson
          .map((e) => PodcastEpisode.fromJson(e as Map<String, dynamic>))
          .toList(),
      hasMore: json['hasMore'] ?? false,
      total: json['total'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'episodes': episodes.map((e) => e.toJson()).toList(),
      'hasMore': hasMore,
      'total': total,
    };
  }
}

/// 视图模式
enum ListViewMode {
  list,
  grid,
}
