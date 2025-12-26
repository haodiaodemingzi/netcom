import 'ebook_models.dart';
import 'data/ebook_remote_service.dart';
import '../../core/services/ebook_file_cache_service.dart';

class EbookRepository {
  const EbookRepository({
    required this.remoteService,
    required this.cacheService,
  });

  final EbookRemoteService remoteService;
  final EbookFileCacheService cacheService;

  Future<EbookChapterContent> getChapterContent(String chapterId) async {
    // 先尝试从缓存读取
    final cachedContentStr = await cacheService.getCachedChapterContent(chapterId);
    if (cachedContentStr != null) {
      return EbookChapterContent(
        id: chapterId,
        title: chapterId,
        content: cachedContentStr,
        url: '',
      );
    }

    // 缓存未命中，从API获取
    try {
      final content = await remoteService.fetchChapterContent(chapterId: chapterId);
      if (content != null) {
        // 异步保存到缓存
        cacheService.saveChapterContent(chapterId, content.content!);
      }
      return content;
    } catch (e) {
      // API失败，返回缓存的内容（如果有）
      if (cachedContentStr != null) {
        return EbookChapterContent(
          id: chapterId,
          title: chapterId,
          content: cachedContentStr,
          url: '',
        );
      }
      return EbookChapterContent(
        id: chapterId,
        title: chapterId,
        content: '',
        url: '',
      );
    }
  }
}
