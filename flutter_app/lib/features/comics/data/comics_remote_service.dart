import '../../../core/network/api_client.dart';
import '../comics_models.dart';

class ComicsRemoteService {
  ComicsRemoteService(this._api);

  static const String _defaultSource = 'baozimh';
  final ApiClient _api;

  Future<ComicFeed> fetchFeed({
    required String categoryId,
    required int page,
    required int limit,
    String? sourceId,
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    dynamic payload;
    if (categoryId == 'hot') {
      final response = await _api.get<dynamic>('/comics/hot', query: params);
      payload = response.data;
    } else if (categoryId == 'latest') {
      final response = await _api.get<dynamic>('/comics/latest', query: params);
      payload = response.data;
    } else {
      params['category'] = categoryId;
      final response = await _api.get<dynamic>('/comics/category', query: params);
      payload = response.data;
    }
    return _parseFeed(payload);
  }

  Future<List<ComicSummary>> search({
    required String keyword,
    required String? sourceId,
    int page = 1,
    int limit = 50,
  }) async {
    final params = <String, dynamic>{
      'keyword': keyword,
      'page': page,
      'limit': limit,
    };
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final response = await _api.get<dynamic>('/comics/search', query: params);
    final data = _unwrap(response.data);
    if (data is Map<String, dynamic>) {
      final items = data['comics'] ?? data['items'] ?? data['results'];
      if (items is List) {
        return items.whereType<Map<String, dynamic>>().map(ComicSummary.fromJson).where((e) => e.id.isNotEmpty).toList();
      }
    }
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().map(ComicSummary.fromJson).where((e) => e.id.isNotEmpty).toList();
    }
    return <ComicSummary>[];
  }

  Future<List<ComicCategory>> fetchCategories(String? sourceId) async {
    final params = <String, dynamic>{};
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final response = await _api.get<dynamic>('/categories', query: params);
    final data = _unwrap(response.data);
    final result = <ComicCategory>[];
    if (data is Map<String, dynamic>) {
      final categories = data['categories'] ?? data['data'];
      if (categories is List) {
        result.addAll(
          categories.whereType<Map<String, dynamic>>().map(ComicCategory.fromJson).where((e) => e.id.isNotEmpty),
        );
      }
    } else if (data is List) {
      result.addAll(
        data.whereType<Map<String, dynamic>>().map(ComicCategory.fromJson).where((e) => e.id.isNotEmpty),
      );
    }
    return result;
  }

  Future<Map<String, ComicSourceInfo>> fetchSources() async {
    final response = await _api.get<dynamic>('/sources');
    final data = _unwrap(response.data);
    if (data is Map<String, dynamic>) {
      final entries = <String, ComicSourceInfo>{};
      for (final entry in data.entries) {
        final info = ComicSourceInfo.fromJson(entry.key, entry.value as Map<String, dynamic>?);
        entries[entry.key] = info;
      }
      return entries;
    }
    return <String, ComicSourceInfo>{};
  }

  Future<ComicDetailData> fetchDetail({
    required String comicId,
    required String? sourceId,
  }) async {
    final params = <String, dynamic>{};
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final detailResponse = await _api.get<dynamic>('/comics/$comicId', query: params);
    final detailData = ComicDetail.fromJson(_unwrap(detailResponse.data) as Map<String, dynamic>?);
    final chapterResponse = await _api.get<dynamic>('/comics/$comicId/chapters', query: params);
    final chapters = _parseChapters(_unwrap(chapterResponse.data));
    return ComicDetailData(detail: detailData, chapters: chapters);
  }

  Future<ComicChapterImages> fetchChapterImages({
    required String chapterId,
    required String? sourceId,
  }) async {
    final params = <String, dynamic>{};
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    // 后端真实路径是 /chapters/<id>/images (无 /comics 前缀)，此前会导致 404
    final response = await _api.get<dynamic>('/chapters/$chapterId/images', query: params);
    return _parseChapterImages(_unwrap(response.data));
  }

  Future<ComicDownloadInfo> fetchChapterDownloadInfo({
    required String chapterId,
    required String? sourceId,
  }) async {
    final params = <String, dynamic>{};
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final response = await _api.get<dynamic>('/chapters/$chapterId/download-info', query: params);
    return _parseDownloadInfo(_unwrap(response.data));
  }

  List<ComicChapter> _parseChapters(dynamic data) {
    final list = <ComicChapter>[];
    List? raw;
    if (data is Map<String, dynamic>) {
      raw = data['chapters'] as List?;
    } else if (data is List) {
      raw = data;
    }
    if (raw == null) {
      return list;
    }
    var index = 1;
    for (final item in raw) {
      if (item is Map<String, dynamic>) {
        list.add(ComicChapter.fromJson(item, index: index));
        index += 1;
      }
    }
    return list.where((e) => e.id.isNotEmpty).toList();
  }

  ComicFeed _parseFeed(dynamic raw) {
    final data = _unwrap(raw);
    List? comicsRaw;
    bool hasMore = false;
    if (data is Map<String, dynamic>) {
      comicsRaw = data['comics'] as List? ?? data['items'] as List?;
      hasMore = (data['hasMore'] as bool?) ?? false;
    } else if (data is List) {
      comicsRaw = data;
    }
    final items = comicsRaw
            ?.whereType<Map<String, dynamic>>()
            .map(ComicSummary.fromJson)
            .where((e) => e.id.isNotEmpty)
            .toList() ??
        <ComicSummary>[];
    return ComicFeed(items: items, hasMore: hasMore);
  }

  dynamic _unwrap(dynamic raw) {
    if (raw is Map<String, dynamic>) {
      if (raw.containsKey('data')) {
        return raw['data'];
      }
      if (raw.containsKey('result')) {
        return raw['result'];
      }
    }
    return raw;
  }

  ComicChapterImages _parseChapterImages(dynamic raw) {
    if (raw is Map<String, dynamic>) {
      final total = (raw['total'] as num?)?.toInt() ?? (raw['expected_total'] as num?)?.toInt() ?? 0;
      final imagesRaw = raw['images'];
      final images = <ComicPageImage>[];
      if (imagesRaw is List) {
        for (final item in imagesRaw.whereType<Map<String, dynamic>>()) {
          final image = ComicPageImage.fromJson(item);
          if (image.page > 0 && image.url.isNotEmpty) {
            images.add(image);
          }
        }
      }
      return ComicChapterImages(
        images: images,
        total: total > 0 ? total : images.length,
        expectedTotal: (raw['expected_total'] as num?)?.toInt(),
      );
    }
    return const ComicChapterImages(images: <ComicPageImage>[], total: 0);
  }

  ComicDownloadInfo _parseDownloadInfo(dynamic raw) {
    if (raw is Map<String, dynamic>) {
      final data = raw['data'] is Map<String, dynamic> ? raw['data'] as Map<String, dynamic> : raw;
      final images = _parseChapterImages(data).images;
      final downloadConfig = (data['download_config'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      return ComicDownloadInfo(
        images: images,
        downloadConfig: downloadConfig,
      );
    }
    return const ComicDownloadInfo(images: <ComicPageImage>[], downloadConfig: <String, dynamic>{});
  }

  String? _resolveSource(String? sourceId) {
    final normalized = sourceId?.trim() ?? '';
    if (normalized.isNotEmpty) {
      return normalized;
    }
    return _defaultSource;
  }
}
