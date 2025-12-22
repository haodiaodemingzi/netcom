import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/network_providers.dart';
import '../comics/comics_models.dart';

typedef ComicDownloadProgress = void Function(int completed, int total);

final comicDownloaderProvider = Provider<ComicDownloader>((ref) {
  final api = ref.watch(apiClientProvider);
  return ComicDownloader(api);
});

class ComicDownloader {
  ComicDownloader(this._apiClient);

  final ApiClient _apiClient;

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
    
    final total = downloadInfo.images.length;
    var completed = 0;
    
    for (final image in downloadInfo.images) {
      if (cancelToken?.isCancelled == true) {
        return;
      }
      if (image.url.isEmpty) {
        continue;
      }
      try {
        final response = await _apiClient.get<List<int>>(
          '/proxy/image',
          query: <String, dynamic>{
            'url': image.url,
            'source': detail.source,
          },
          options: Options(
            responseType: ResponseType.bytes,
          ),
          cancelToken: cancelToken,
        );
        
        if (response.data != null && response.data!.isNotEmpty) {
          if (kIsWeb) {
            debugPrint('Web 环境下载图片 ${image.page}/${total} 成功 (${response.data!.length} bytes)');
          }
          completed += 1;
          onProgress?.call(completed, total);
        }
      } catch (e, stack) {
        debugPrint('下载图片失败 page=${image.page} url=${image.url} error=${e.toString()}');
        if (kDebugMode) {
          debugPrintStack(stackTrace: stack);
        }
      }
    }
    
    if (completed <= 0) {
      throw StateError('下载失败: 没有成功下载任何图片');
    }
    
    debugPrint('下载完成: ${detail.title} - ${chapter.title}, 成功 $completed/$total 张');
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
