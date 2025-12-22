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
      metadata: metadata,
    );
  }
}
