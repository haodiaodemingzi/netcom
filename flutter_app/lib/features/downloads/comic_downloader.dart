import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/network/api_client.dart';
import '../../core/network/network_providers.dart';
import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import '../comics/comics_models.dart';

typedef ComicDownloadProgress = void Function(int completed, int total);

final comicDownloaderProvider = Provider<ComicDownloader>((ref) {
  final api = ref.watch(apiClientProvider);
  final settingsRepo = ref.watch(settingsRepositoryProvider);
  final settings = settingsRepo?.load() ?? SettingsModel();
  return ComicDownloader(api, maxConcurrent: settings.maxConcurrentDownloads);
});

class ComicDownloader {
  ComicDownloader(this._apiClient, {int maxConcurrent = 4}) : _maxConcurrent = maxConcurrent;

  final ApiClient _apiClient;
  final int _maxConcurrent;

  Future<void> downloadChapter({
    required ComicDetail detail,
    required ComicChapter chapter,
    required ComicDownloadInfo downloadInfo,
    ComicDownloadProgress? onProgress,
    CancelToken? cancelToken,
  }) async {
    if (detail.id.isEmpty || chapter.id.isEmpty || downloadInfo.images.isEmpty) {
      throw ArgumentError('下载参数缺失');
    }

    final dir = await _ensureChapterDir(detail.id, chapter.id);
    final total = downloadInfo.images.length;
    var completed = 0;
    final headers = _buildHeaders(downloadInfo.downloadConfig);
    await _preheatCookie(downloadInfo.downloadConfig, headers, cancelToken);

    await _runWithConcurrency<ComicPageImage>(
      downloadInfo.images,
      _maxConcurrent,
      (image) async {
        if (cancelToken?.isCancelled == true) {
          return;
        }
        if (image.url.isEmpty) {
          return;
        }
        final success = await _downloadImage(
          image: image,
          dir: dir,
          headers: headers,
          total: total,
          cancelToken: cancelToken,
        );
        if (!success) {
          return;
        }
        completed += 1;
        onProgress?.call(completed, total);
      },
    );

    if (completed <= 0) {
      throw StateError('下载失败: 没有成功下载任何图片');
    }

    await _writeMeta(dir, detail, chapter, total, completed);
    debugPrint('下载完成: ${detail.title} - ${chapter.title}, 成功 $completed/$total 张');
    if (kDebugMode) {
      debugPrint('漫画目录: ${dir.path}');
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  Future<bool> _downloadImage({
    required ComicPageImage image,
    required Directory dir,
    required Map<String, dynamic> headers,
    required int total,
    CancelToken? cancelToken,
  }) async {
    final page = image.page.toString().padLeft(3, '0');
    final ext = image.url.split('.').last;
    final fileName = '$page.$ext';
    final filePath = p.join(dir.path, fileName);
    final file = File(filePath);

    if (await file.exists()) {
      return true;
    }

    const maxRetries = 3;
    var retryCount = 0;

    while (retryCount < maxRetries) {
      if (cancelToken?.isCancelled == true) {
        return false;
      }
      try {
        final response = await _apiClient.get<List<int>>(
          image.url,
          options: Options(
            responseType: ResponseType.bytes,
            receiveTimeout: const Duration(seconds: 35),
            headers: headers,
            followRedirects: true,
          ),
          cancelToken: cancelToken,
        );
        final data = response.data;
        if (data != null && data.isNotEmpty) {
          await file.writeAsBytes(data);
          final fileSize = await file.length();
          final ext = p.extension(filePath);
          if (kDebugMode) {
            debugPrint('图片 ${image.page}/$total 下载成功: $filePath (${ext.toUpperCase()} ${_formatBytes(fileSize)})');
          }
          return true;
        }
      } catch (e, stack) {
        retryCount += 1;
        if (retryCount >= maxRetries) {
          debugPrint('下载图片失败 page=${image.page} url=${image.url} error=${e.toString()}');
          if (kDebugMode) {
            debugPrintStack(stackTrace: stack);
          }
          return false;
        }
        if (kDebugMode) {
          debugPrint('下载图片失败，第 $retryCount 次重试 page=${image.page} url=${image.url} error=${e.toString()}');
        }
        await Future.delayed(Duration(seconds: retryCount));
      }
    }
    return false;
  }

  Future<void> _preheatCookie(
    Map<String, dynamic> config,
    Map<String, dynamic> headers,
    CancelToken? cancelToken,
  ) async {
    final url = (config['cookie_url'] as String?)?.trim();
    if (url == null || url.isEmpty) {
      return;
    }
    try {
      await _apiClient.get<String>(
        url,
        options: Options(headers: headers, followRedirects: true),
        cancelToken: cancelToken,
      );
    } catch (e, stack) {
      if (kDebugMode) {
        debugPrint('预热 cookie 失败 url=$url error=${e.toString()}');
        debugPrintStack(stackTrace: stack);
      }
    }
  }

  Future<Directory> _ensureChapterDir(String comicId, String chapterId) async {
    final safeComicId = _safeId(comicId);
    final safeChapterId = _safeId(chapterId);
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(base.path, 'comics', safeComicId, safeChapterId));
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

  Future<void> _writeMeta(
    Directory dir,
    ComicDetail detail,
    ComicChapter chapter,
    int total,
    int completed,
  ) async {
    final meta = <String, dynamic>{
      'comicId': detail.id,
      'chapterId': chapter.id,
      'title': chapter.title,
      'comicTitle': detail.title,
      'total': total,
      'completed': completed,
      'updatedAt': DateTime.now().toIso8601String(),
    };
    final file = File(p.join(dir.path, 'meta.json'));
    try {
      await file.writeAsString(jsonEncode(meta));
    } catch (e, stack) {
      if (kDebugMode) {
        debugPrint('写入 meta.json 失败 path=${file.path} error=${e.toString()}');
        debugPrintStack(stackTrace: stack);
      }
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

  Map<String, dynamic> _buildHeaders(Map<String, dynamic> config) {
    if (config.isEmpty) {
      return <String, dynamic>{};
    }
    final headers = <String, dynamic>{};
    final rawHeaders = config['headers'];
    if (rawHeaders is Map) {
      headers.addAll(rawHeaders.map((key, value) => MapEntry(key.toString(), value)));
    }
    if (config['referer'] is String && (config['referer'] as String).isNotEmpty) {
      headers.putIfAbsent('Referer', () => config['referer']);
    }
    if (config['cookie'] is String && (config['cookie'] as String).isNotEmpty) {
      headers.putIfAbsent('Cookie', () => config['cookie']);
    }
    return headers;
  }
}
