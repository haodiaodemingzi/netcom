import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/network_providers.dart';
import '../../core/storage/storage_providers.dart';
import '../ebooks/data/ebook_remote_service.dart';
import '../ebooks/ebook_models.dart';
import '../ebooks/ebook_repository.dart';

typedef EbookChapterDownloadProgress = void Function(double progress);

final ebookChapterDownloaderProvider = Provider<EbookChapterDownloader>((ref) {
  final api = ref.watch(apiClientProvider);
  final cacheService = ref.watch(ebookFileCacheServiceProvider);
  final remoteService = EbookRemoteService(api);
  final repository = EbookRepository(
    remoteService: remoteService,
    cacheService: cacheService,
  );
  return EbookChapterDownloader(repository);
});

class EbookChapterDownloader {
  EbookChapterDownloader(this._repository);

  final EbookRepository _repository;

  Future<String> downloadChapter({
    required EbookDetail detail,
    required EbookChapter chapter,
    EbookChapterDownloadProgress? onProgress,
    CancelToken? cancelToken,
  }) async {
    if (detail.id.isEmpty || chapter.id.isEmpty) {
      throw ArgumentError('下载参数缺失');
    }

    if (cancelToken?.isCancelled == true) {
      throw DioException(
        requestOptions: RequestOptions(path: ''),
        type: DioExceptionType.cancel,
      );
    }

    onProgress?.call(0.0);

    try {
      // 使用 Repository 获取章节内容（会自动使用缓存）
      final content = await _repository.getChapterContent(chapter.id);

      if (cancelToken?.isCancelled == true) {
        throw DioException(
          requestOptions: RequestOptions(path: ''),
          type: DioExceptionType.cancel,
        );
      }

      onProgress?.call(1.0);

      debugPrint('下载完成: ${detail.title} - ${chapter.title}');
      return content.content ?? '';
    } catch (e) {
      if (cancelToken?.isCancelled == true) {
        throw DioException(
          requestOptions: RequestOptions(path: ''),
          type: DioExceptionType.cancel,
        );
      }
      debugPrint('下载章节失败: ${chapter.title}, error=${e.toString()}');
      rethrow;
    }
  }
}
