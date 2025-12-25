import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:flutter/services.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_config.dart';
import '../../core/network/network_providers.dart';
import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import '../videos/video_models.dart';
import 'web_downloader_stub.dart'
    if (dart.library.html) 'web_downloader_html.dart';

typedef VideoDownloadProgress = void Function(int received, int total);

final videoDownloaderProvider = Provider<VideoDownloader>((ref) {
  final api = ref.watch(apiClientProvider);
  final config = ref.watch(apiConfigProvider);
  final settingsRepo = ref.watch(settingsRepositoryProvider);
  final settings = settingsRepo?.load() ?? SettingsModel();
  return VideoDownloader(api, config, segmentMaxConcurrent: settings.maxConcurrentDownloads);
});

class VideoDownloader {
  VideoDownloader(this._apiClient, this._apiConfig, {int segmentMaxConcurrent = 4})
      : _segmentMaxConcurrent = segmentMaxConcurrent;

  final ApiClient _apiClient;
  final ApiConfig _apiConfig;
  final int _segmentMaxConcurrent;
  static const int _segmentMaxRetries = 3;
  static const Duration _segmentRetryDelay = Duration(seconds: 2);

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

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
    
    final safeDetailId = _safeId(detail.id);
    final safeEpisodeId = _safeId(episode.id);
    
    if (kIsWeb) {
      return await _downloadForWeb(
        detail: detail,
        episode: episode,
        source: source,
        cancelToken: cancelToken,
        onProgress: onProgress,
      );
    }
    
    final dir = await _ensureVideoDir(safeDetailId);
    final filePath = p.join(dir.path, '$safeEpisodeId.mp4');
    final file = File(filePath);
    
    if (await file.exists()) {
      if (kDebugMode) {
        debugPrint('视频文件已存在: $filePath');
      }
      await _writeMeta(dir, detail, episode, filePath);
      return filePath;
    }
    
    final isM3u8 = source.url.contains('.m3u8') || source.url.contains('m3u8');
    
    if (isM3u8) {
      return await _downloadM3u8Video(
        detail: detail,
        episode: episode,
        source: source,
        filePath: filePath,
        cancelToken: cancelToken,
        onProgress: onProgress,
      );
    } else {
      return await _downloadDirectVideo(
        source: source,
        dir: dir,
        detail: detail,
        episode: episode,
        filePath: filePath,
        cancelToken: cancelToken,
        onProgress: onProgress,
      );
    }
  }

  Future<String> _downloadDirectVideo({
    required VideoPlaySource source,
    required Directory dir,
    required VideoDetail detail,
    required VideoEpisode episode,
    required String filePath,
    CancelToken? cancelToken,
    VideoDownloadProgress? onProgress,
  }) async {
    final headers = _buildHeaders(source);
    final dio = Dio(BaseOptions(headers: headers));
    await dio.download(
      source.url,
      filePath,
      cancelToken: cancelToken,
      onReceiveProgress: (count, total) {
        if (total <= 0) return;
        onProgress?.call(count, total);
      },
    );
    await _scanMedia(filePath);
    await _writeMeta(dir, detail, episode, filePath);
    final fileSize = await File(filePath).length();
    final ext = p.extension(filePath);
    if (kDebugMode) {
      debugPrint('视频下载完成: $filePath (${ext.toUpperCase()} ${_formatBytes(fileSize)})');
    }
    return filePath;
  }

  Future<String> _downloadM3u8Video({
    required VideoDetail detail,
    required VideoEpisode episode,
    required VideoPlaySource source,
    required String filePath,
    CancelToken? cancelToken,
    VideoDownloadProgress? onProgress,
  }) async {
    final headers = _buildHeaders(source);
    final playlistText = await _fetchM3u8(
      source.url,
      headers,
      cancelToken,
    );
    final segments = _parseSegments(playlistText, source.url);
    if (segments.isEmpty) {
      throw Exception('m3u8 未包含可用分片');
    }

    final segmentDir = Directory(p.join(p.dirname(filePath), '${_safeId(episode.id)}_segments'));
    if (!(await segmentDir.exists())) {
      await segmentDir.create(recursive: true);
    }

    final segmentPaths = await _downloadSegments(
      segments: segments,
      dir: segmentDir,
      headers: headers,
      cancelToken: cancelToken,
      onProgress: onProgress,
    );

    await _mergeSegments(
      segmentPaths: segmentPaths,
      outputPath: filePath,
      cancelToken: cancelToken,
    );

    await _scanMedia(filePath);
    await _writeMeta(await Directory(p.dirname(filePath)).create(recursive: true), detail, episode, filePath);
    await _cleanupSegments(segmentPaths);
    final fileSize = await File(filePath).length();
    final ext = p.extension(filePath);
    if (kDebugMode) {
      debugPrint('视频下载完成: $filePath (${ext.toUpperCase()} ${_formatBytes(fileSize)})');
    }
    return filePath;
  }

  Future<String> _downloadForWeb({
    required VideoDetail detail,
    required VideoEpisode episode,
    required VideoPlaySource source,
    CancelToken? cancelToken,
    VideoDownloadProgress? onProgress,
  }) async {
    final isM3u8 = source.url.contains('.m3u8') || source.url.contains('m3u8');
    
    if (isM3u8) {
      if (kDebugMode) {
        debugPrint('Web 平台 m3u8 格式, 调用后端转换接口');
      }
      
      final safeEpisodeId = _safeId(episode.id);
      final safeSeriesId = _safeId(detail.id);
      
      final convertResponse = await _apiClient.postJson<dynamic>(
        '/videos/convert',
        body: {
          'm3u8_url': source.url,
          'episode_id': safeEpisodeId,
          'series_id': safeSeriesId,
          'source': detail.source,
          'play_referer': source.headers['Referer'] ?? '',
        },
      );
      
      final convertData = convertResponse.data;
      if (convertData is! Map<String, dynamic>) {
        throw Exception('转换接口返回格式错误');
      }
      
      final success = convertData['success'] as bool? ?? false;
      if (!success) {
        final error = convertData['error'] as String? ?? '转换失败';
        throw Exception(error);
      }
      
      final taskId = convertData['task_id'] as String?;
      if (taskId == null || taskId.isEmpty) {
        throw Exception('未返回任务 ID');
      }
      
      if (kDebugMode) {
        debugPrint('m3u8 转换任务已创建: $taskId');
      }
      
      String? downloadUrl;
      var pollCount = 0;
      const maxPolls = 300;
      const pollInterval = Duration(seconds: 2);
      
      while (pollCount < maxPolls) {
        if (cancelToken?.isCancelled ?? false) {
          throw Exception('下载已取消');
        }
        
        await Future.delayed(pollInterval);
        pollCount++;
        final statusResponse = await _apiClient.get<dynamic>(
          '/videos/convert/status/$taskId',
        );
        
        final statusData = statusResponse.data;
        if (statusData is! Map<String, dynamic>) {
          continue;
        }
        
        final status = statusData['status'] as String? ?? '';
        final progress = (statusData['progress'] as num?)?.toDouble() ?? 0.0;
        
        if (progress > 0 && onProgress != null) {
          final received = (progress * 100).toInt();
          onProgress(received, 100);
        }
        
        if (status == 'completed') {
          downloadUrl = statusData['download_url'] as String?;
          if (kDebugMode) {
            debugPrint('m3u8 转换完成, 下载地址: $downloadUrl');
          }
          break;
        } else if (status == 'failed') {
          final error = statusData['error'] as String? ?? '转换失败';
          throw Exception('视频转换失败: $error');
        }
      }
      
      if (downloadUrl == null || downloadUrl.isEmpty) {
        throw Exception('转换超时或未获取到下载地址');
      }
      
      final baseUrl = _apiConfig.baseUrl;
      final fullUrl = downloadUrl.startsWith('http') 
          ? downloadUrl 
          : '$baseUrl$downloadUrl';
      
      await triggerBrowserDownload(fullUrl, '${episode.title}.mp4');
      
      return fullUrl;
    } else {
      await triggerBrowserDownload(source.url, '${episode.title}.mp4');
      return source.url;
    }
  }

  Map<String, String> _buildHeaders(VideoPlaySource source) {
    final headers = <String, String>{};
    headers.addAll(source.headers);
    if (!headers.containsKey('Referer') || (headers['Referer']?.isEmpty ?? true)) {
      try {
        final uri = Uri.parse(source.url);
        if (uri.hasScheme && uri.host.isNotEmpty) {
          headers['Referer'] = '${uri.scheme}://${uri.host}';
        }
      } catch (_) {}
    }
    return headers;
  }

  Future<String> _fetchM3u8(
    String url,
    Map<String, String> headers,
    CancelToken? cancelToken,
  ) async {
    final response = await _apiClient.get<String>(
      url,
      options: Options(
        headers: headers,
        responseType: ResponseType.plain,
        followRedirects: true,
      ),
      cancelToken: cancelToken,
    );
    return response.data ?? '';
  }

  List<Uri> _parseSegments(String playlist, String baseUrl) {
    if (playlist.isEmpty) {
      return <Uri>[];
    }
    final lines = playlist.split('\n').map((e) => e.trim()).where((e) => e.isNotEmpty && !e.startsWith('#'));
    final base = Uri.tryParse(baseUrl);
    final result = <Uri>[];
    for (final line in lines) {
      final uri = Uri.tryParse(line);
      if (uri == null) {
        continue;
      }
      if (uri.hasScheme) {
        result.add(uri);
        continue;
      }
      if (base != null) {
        result.add(base.resolveUri(uri));
      }
    }
    return result;
  }

  Future<List<String>> _downloadSegments({
    required List<Uri> segments,
    required Directory dir,
    required Map<String, String> headers,
    CancelToken? cancelToken,
    VideoDownloadProgress? onProgress,
  }) async {
    final dio = Dio(BaseOptions(headers: headers, responseType: ResponseType.bytes));
    final paths = List<String>.filled(segments.length, '');
    var completed = 0;
    final total = segments.length;

    Future<void> worker(int index) async {
      if (cancelToken?.isCancelled ?? false) {
        return;
      }
      final uri = segments[index];
      final fileName = '${index.toString().padLeft(5, '0')}.ts';
      final savePath = p.join(dir.path, fileName);

      var attempt = 0;
      while (attempt < _segmentMaxRetries) {
        if (cancelToken?.isCancelled ?? false) {
          return;
        }
        try {
          await dio.download(
            uri.toString(),
            savePath,
            cancelToken: cancelToken,
          );
          paths[index] = savePath;
          completed += 1;
          if (onProgress != null && total > 0) {
            onProgress(completed, total);
          }
          return;
        } catch (e) {
          attempt += 1;
          if (attempt >= _segmentMaxRetries) {
            rethrow;
          }
          if (kDebugMode) {
            debugPrint('分片下载重试 index=$index attempt=$attempt url=$uri err=${e.toString()}');
          }
          await Future.delayed(_segmentRetryDelay * attempt);
        }
      }
    }

    await _runWithConcurrency<int>(
      List<int>.generate(segments.length, (i) => i),
      _segmentMaxConcurrent,
      worker,
    );

    if (paths.any((p) => p.isEmpty)) {
      throw Exception('部分分片下载失败');
    }
    return paths;
  }

  Future<void> _mergeSegments({
    required List<String> segmentPaths,
    required String outputPath,
    CancelToken? cancelToken,
  }) async {
    final output = File(outputPath);
    if (await output.exists()) {
      await output.delete();
    }
    final sink = output.openWrite();
    try {
      for (final path in segmentPaths) {
        if (cancelToken?.isCancelled ?? false) {
          break;
        }
        final file = File(path);
        if (await file.exists()) {
          await sink.addStream(file.openRead());
        }
      }
    } finally {
      await sink.close();
    }
  }

  Future<void> _cleanupSegments(List<String> segmentPaths) async {
    for (final path in segmentPaths) {
      try {
        final file = File(path);
        if (await file.exists()) {
          await file.delete();
        }
      } catch (_) {}
    }
  }

  Future<void> _runWithConcurrency<T>(
    List<T> items,
    int maxConcurrent,
    Future<void> Function(T item) worker,
  ) async {
    if (items.isEmpty) {
      return;
    }
    final queue = List<Future<void>>.empty(growable: true);
    final iterator = items.iterator;

    Future<void> addNext() async {
      if (!iterator.moveNext()) {
        return;
      }
      final current = iterator.current;
      final future = worker(current);
      queue.add(future);
      future.whenComplete(() => queue.remove(future));
    }

    for (var i = 0; i < maxConcurrent; i++) {
      await addNext();
    }

    while (queue.isNotEmpty) {
      await Future.any(queue);
      await addNext();
    }
  }

  Future<Directory> _ensureVideoDir(String videoId) async {
    Directory? base;
    // Android 优先外部存储 Download/Movies 目录，便于用户访问
    try {
      base = await getExternalStorageDirectory();
      if (base != null) {
        final moviesDir = Directory(p.join(base.path, 'Movies'));
        if (await moviesDir.exists() == false) {
          await moviesDir.create(recursive: true);
        }
        base = moviesDir;
        if (kDebugMode) {
          debugPrint('使用外部存储 Movies 目录: ${base.path}');
        }
      }
    } catch (e, stack) {
      if (kDebugMode) {
        debugPrint('访问外部存储失败: $e');
        debugPrintStack(stackTrace: stack);
      }
      base = null;
    }

    // 兜底使用应用文档目录
    if (base == null) {
      base = await getApplicationDocumentsDirectory();
      if (kDebugMode) {
        debugPrint('回退到应用文档目录: ${base.path}');
      }
    }

    final dir = Directory(p.join(base.path, 'video', videoId));
    if (!(await dir.exists())) {
      if (kDebugMode) {
        debugPrint('创建视频子目录: ${dir.path}');
      }
      await dir.create(recursive: true);
    }
    return dir;
  }

  Future<void> _writeMeta(
    Directory dir,
    VideoDetail detail,
    VideoEpisode episode,
    String filePath,
  ) async {
    final meta = <String, dynamic>{
      'videoId': detail.id,
      'episodeId': episode.id,
      'title': episode.title,
      'videoTitle': detail.title,
      'localPath': filePath,
      'updatedAt': DateTime.now().toIso8601String(),
    };
    final file = File(p.join(dir.path, 'meta.json'));
    try {
      await file.writeAsString(jsonEncode(meta));
    } catch (e) {
      if (kDebugMode) {
        debugPrint('写入 meta.json 失败 path=${file.path} error=${e.toString()}');
      }
    }
  }

  Future<void> _scanMedia(String filePath) async {
    if (!Platform.isAndroid) return;
    final channel = MethodChannel('flutter_app/media_scanner');
    try {
      await channel.invokeMethod<void>('scanFile', {'path': filePath});
    } catch (_) {
      // 忽略扫描失败以避免阻断下载流程
    }
  }

  String _safeId(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return '';
    }
    return trimmed.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
  }
}
