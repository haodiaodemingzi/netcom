enum DownloadStatus {
  pending,
  downloading,
  paused,
  failed,
  completed,
}

enum DownloadType {
  comic,
  video,
  ebook,
}

class DownloadItem {
  DownloadItem({
    required this.id,
    required this.type,
    required this.kind,
    required this.title,
    required this.parentTitle,
    required this.status,
    this.progress = 0,
    this.source,
    this.error,
    this.downloadedAt,
    this.parentId,
    this.resourceId,
    this.metadata,
  });

  final String id;
  final DownloadType type;
  final String kind; // task or downloaded
  final String title;
  final String parentTitle;
  final DownloadStatus status;
  final double progress;
  final String? source;
  final String? error;
  final DateTime? downloadedAt;
  final String? parentId;
  final String? resourceId;
  final Map<String, dynamic>? metadata;

  DownloadItem copyWith({
    DownloadStatus? status,
    double? progress,
    String? error,
    DateTime? downloadedAt,
    Map<String, dynamic>? metadata,
  }) {
    return DownloadItem(
      id: id,
      type: type,
      kind: kind,
      title: title,
      parentTitle: parentTitle,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      source: source,
      error: error ?? this.error,
      downloadedAt: downloadedAt ?? this.downloadedAt,
      parentId: parentId,
      resourceId: resourceId,
      metadata: metadata ?? this.metadata,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'type': _typeToString(type),
      'kind': kind,
      'title': title,
      'parentTitle': parentTitle,
      'status': _statusToString(status),
      'progress': progress,
      'source': source,
      'error': error,
      'downloadedAt': downloadedAt?.millisecondsSinceEpoch,
      'parentId': parentId,
      'resourceId': resourceId,
      'metadata': metadata,
    };
  }

  static DownloadItem fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return DownloadItem(
        id: '',
        type: DownloadType.video,
        kind: 'task',
        title: '',
        parentTitle: '',
        status: DownloadStatus.pending,
      );
    }
    return DownloadItem(
      id: (json['id'] as String?) ?? '',
      type: _parseType(json['type'] as String?),
      kind: (json['kind'] as String?) ?? 'task',
      title: (json['title'] as String?) ?? '',
      parentTitle: (json['parentTitle'] as String?) ?? '',
      status: _parseStatus(json['status'] as String?),
      progress: (json['progress'] as num?)?.toDouble() ?? 0,
      source: json['source'] as String?,
      error: json['error'] as String?,
      downloadedAt: _parseDate(json['downloadedAt']),
      parentId: json['parentId'] as String?,
      resourceId: json['resourceId'] as String?,
      metadata: (json['metadata'] as Map?)?.map((key, value) => MapEntry(key.toString(), value)),
    );
  }

  static DownloadStatus _parseStatus(String? raw) {
    switch (raw) {
      case 'pending':
        return DownloadStatus.pending;
      case 'downloading':
        return DownloadStatus.downloading;
      case 'paused':
        return DownloadStatus.paused;
      case 'failed':
        return DownloadStatus.failed;
      case 'completed':
        return DownloadStatus.completed;
      default:
        return DownloadStatus.pending;
    }
  }

  static DownloadType _parseType(String? raw) {
    switch (raw) {
      case 'video':
        return DownloadType.video;
      case 'comic':
        return DownloadType.comic;
      case 'ebook':
        return DownloadType.ebook;
      default:
        return DownloadType.video;
    }
  }

  static String _statusToString(DownloadStatus status) {
    switch (status) {
      case DownloadStatus.pending:
        return 'pending';
      case DownloadStatus.downloading:
        return 'downloading';
      case DownloadStatus.paused:
        return 'paused';
      case DownloadStatus.failed:
        return 'failed';
      case DownloadStatus.completed:
        return 'completed';
    }
  }

  static String _typeToString(DownloadType type) {
    switch (type) {
      case DownloadType.video:
        return 'video';
      case DownloadType.comic:
        return 'comic';
      case DownloadType.ebook:
        return 'ebook';
    }
  }

  static DateTime? _parseDate(dynamic raw) {
    if (raw is int) {
      return DateTime.fromMillisecondsSinceEpoch(raw);
    }
    if (raw is String && raw.isNotEmpty) {
      return DateTime.tryParse(raw);
    }
    return null;
  }
}
