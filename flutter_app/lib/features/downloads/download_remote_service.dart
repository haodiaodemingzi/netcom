import '../../core/network/api_client.dart';
import '../../core/network/network_providers.dart';
import 'download_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final downloadRemoteServiceProvider = Provider<DownloadRemoteService>((ref) {
  final api = ref.watch(apiClientProvider);
  return DownloadRemoteService(api);
});

class DownloadRemoteServiceResult {
  DownloadRemoteServiceResult({
    required this.queue,
    required this.completed,
  });

  final List<DownloadItem> queue;
  final List<DownloadItem> completed;
}

class DownloadRemoteService {
  DownloadRemoteService(this._api);

  final ApiClient _api;

  Future<DownloadRemoteServiceResult> fetchAll() async {
    final queue = await _fetchList('/api/downloads/tasks', kind: 'task');
    final completed = await _fetchList('/api/downloads/completed', kind: 'downloaded');
    return DownloadRemoteServiceResult(queue: queue, completed: completed);
  }

  Future<List<DownloadItem>> _fetchList(String path, {required String kind}) async {
    final resp = await _api.get<List<dynamic>>(path);
    final data = resp.data;
    if (data == null) {
      throw const FormatException('响应为空');
    }
    final list = <DownloadItem>[];
    for (final item in data) {
      if (item is! Map<String, dynamic>) {
        continue;
      }
      list.add(_mapItem(item, kind));
    }
    return list;
  }

  DownloadItem _mapItem(Map<String, dynamic> json, String kind) {
    final id = (json['id'] as String?) ?? '';
    final title = (json['title'] as String?) ?? '';
    final parent = (json['parentTitle'] as String?) ?? '';
    final status = _parseStatus(json['status'] as String?);
    final progress = (json['progress'] as num?)?.toDouble() ?? 0;
    final source = json['source'] as String?;
    final err = json['error'] as String?;
    final downloadedAtRaw = json['downloadedAt'];
    DateTime? downloadedAt;
    if (downloadedAtRaw is String && downloadedAtRaw.isNotEmpty) {
      downloadedAt = DateTime.tryParse(downloadedAtRaw);
    } else if (downloadedAtRaw is int) {
      downloadedAt = DateTime.fromMillisecondsSinceEpoch(downloadedAtRaw);
    }
    return DownloadItem(
      id: id,
      type: _parseType(json['type'] as String?),
      kind: kind,
      title: title,
      parentTitle: parent,
      status: status,
      progress: progress.clamp(0, 1),
      source: source,
      error: err,
      downloadedAt: downloadedAt,
    );
  }

  DownloadStatus _parseStatus(String? raw) {
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

  DownloadType _parseType(String? raw) {
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
}
