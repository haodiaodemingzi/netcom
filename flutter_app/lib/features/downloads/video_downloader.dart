import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:universal_html/html.dart' as html;

import '../../core/network/api_client.dart';
import '../../core/network/api_config.dart';
import '../../core/network/network_providers.dart';
import '../videos/video_models.dart';

typedef VideoDownloadProgress = void Function(int received, int total);

final videoDownloaderProvider = Provider<VideoDownloader>((ref) {
  final api = ref.watch(apiClientProvider);
  final config = ref.watch(apiConfigProvider);
  return VideoDownloader(api, config);
});

class VideoDownloader {
  VideoDownloader(this._apiClient, this._apiConfig);

  final ApiClient _apiClient;
  final ApiConfig _apiConfig;

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
        filePath: filePath,
        cancelToken: cancelToken,
        onProgress: onProgress,
      );
    }
  }

  Future<String> _downloadDirectVideo({
    required VideoPlaySource source,
    required String filePath,
    CancelToken? cancelToken,
    VideoDownloadProgress? onProgress,
  }) async {
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

  Future<String> _downloadM3u8Video({
    required VideoDetail detail,
    required VideoEpisode episode,
    required VideoPlaySource source,
    required String filePath,
    CancelToken? cancelToken,
    VideoDownloadProgress? onProgress,
  }) async {
    if (kDebugMode) {
      debugPrint('检测到 m3u8 格式, 调用后端转换接口');
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
    
    if (kDebugMode) {
      debugPrint('开始下载转换后的视频: $fullUrl');
    }
    
    final dio = Dio();
    await dio.download(
      fullUrl,
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
      
      await _triggerBrowserDownload(fullUrl, '${episode.title}.mp4');
      
      return fullUrl;
    } else {
      await _triggerBrowserDownload(source.url, '${episode.title}.mp4');
      return source.url;
    }
  }

  Future<void> _triggerBrowserDownload(String url, String filename) async {
    try {
      // 通过 Blob 避免页面跳转
      final response = await html.HttpRequest.request(
        url,
        method: 'GET',
        responseType: 'blob',
        requestHeaders: {
          'Accept': 'video/mp4,application/octet-stream',
        },
      );
      final blob = response.response as html.Blob?;
      if (blob == null) {
        throw Exception('下载响应为空');
      }
      final objectUrl = html.Url.createObjectUrlFromBlob(blob);
      final anchor = html.AnchorElement(href: objectUrl)
        ..setAttribute('download', filename)
        ..style.display = 'none';
      html.document.body?.append(anchor);
      anchor.click();
      anchor.remove();
      html.Url.revokeObjectUrl(objectUrl);
    } catch (e) {
      // 回退: 直接打开链接（可能会新开标签，但确保用户能拿到文件）
      final anchor = html.AnchorElement(href: url)
        ..setAttribute('download', filename)
        ..style.display = 'none';
      html.document.body?.append(anchor);
      anchor.click();
      anchor.remove();
      if (kDebugMode) {
        debugPrint('Blob 下载失败，回退直接链接: $url, err: $e');
      }
    }
    if (kDebugMode) {
      debugPrint('触发浏览器下载(无跳转): $url');
    }
  }

  Future<Directory> _ensureVideoDir(String videoId) async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(base.path, 'video', videoId));
    if (!(await dir.exists())) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  String _safeId(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return '';
    }
    return trimmed.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
  }
}
