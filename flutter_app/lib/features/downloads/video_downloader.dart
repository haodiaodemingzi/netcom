import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/network/api_client.dart';
import '../../core/network/network_providers.dart';
import '../videos/video_models.dart';

typedef VideoDownloadProgress = void Function(int received, int total);

final videoDownloaderProvider = Provider<VideoDownloader>((ref) {
  final api = ref.watch(apiClientProvider);
  return VideoDownloader(api);
});

class VideoDownloader {
  VideoDownloader(this._apiClient);

  final ApiClient _apiClient;

  Future<String> downloadEpisode({
    required VideoDetail detail,
    required VideoEpisode episode,
    required VideoPlaySource source,
    CancelToken? cancelToken,
    VideoDownloadProgress? onProgress,
  }) async {
    if (detail.id.isEmpty || episode.id.isEmpty || source.url.isEmpty) {
      throw ArgumentError('下载参数缺失');
    }
    final dir = await _ensureVideoDir(detail.id);
    final filePath = p.join(dir.path, '${episode.id}.mp4');
    final file = File(filePath);
    if (await file.exists()) {
      await file.delete();
    }
    final dio = Dio(BaseOptions(headers: source.headers));
    await dio.download(
      source.url,
      filePath,
      cancelToken: cancelToken,
      onReceiveProgress: (count, total) {
        if (total <= 0) return;
        onProgress?.call(count, total);
      },
    );
    if (kDebugMode) {
      debugPrint('视频下载完成: $filePath');
    }
    return filePath;
  }

  Future<Directory> _ensureVideoDir(String videoId) async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(base.path, 'video', videoId));
    if (!(await dir.exists())) {
      await dir.create(recursive: true);
    }
    return dir;
  }
}
