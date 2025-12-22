import '../../../core/network/api_client.dart';
import '../../videos/video_models.dart';
import '../../../core/utils/string_utils.dart';

class VideoRemoteService {
  VideoRemoteService(this._api);

  final ApiClient _api;

  Future<Map<String, VideoSourceInfo>> fetchSources() async {
    final response = await _api.get<dynamic>('/videos/sources');
    final data = _unwrap(response.data);
    final sourcesRaw = _unwrap(data is Map<String, dynamic> ? data['sources'] : data);
    if (sourcesRaw is! Map<String, dynamic>) {
      return <String, VideoSourceInfo>{};
    }
    final result = <String, VideoSourceInfo>{};
    for (final entry in sourcesRaw.entries) {
      if (entry.key is! String) {
        continue;
      }
      result[entry.key as String] = VideoSourceInfo.fromJson(entry.key as String, entry.value as Map<String, dynamic>?);
    }
    return result;
  }

  Future<List<VideoCategory>> fetchCategories(String? sourceId) async {
    final params = <String, dynamic>{};
    if (isNotBlank(sourceId)) {
      params['source'] = sourceId!.trim();
    }
    final response = await _api.get<dynamic>('/videos/categories', query: params);
    final data = _unwrap(response.data);
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().map(VideoCategory.fromJson).where((e) => isNotBlank(e.id)).toList();
    }
    if (data is Map<String, dynamic>) {
      final list = data['categories'];
      if (list is List) {
        return list.whereType<Map<String, dynamic>>().map(VideoCategory.fromJson).where((e) => isNotBlank(e.id)).toList();
      }
    }
    return <VideoCategory>[];
  }

  Future<VideoFeed> fetchFeed({
    required String categoryId,
    required int page,
    required int limit,
    String? sourceId,
  }) async {
    final params = <String, dynamic>{
      'category': categoryId,
      'page': page,
      'limit': limit,
    };
    if (isNotBlank(sourceId)) {
      params['source'] = sourceId!.trim();
    }
    final response = await _api.get<dynamic>('/videos/series', query: params);
    return _parseFeed(_unwrap(response.data));
  }

  Future<VideoFeed> search({
    required String keyword,
    required String? sourceId,
    int page = 1,
    int limit = 20,
  }) async {
    final trimmed = keyword.trim();
    if (trimmed.isEmpty) {
      return const VideoFeed(items: <VideoSummary>[], hasMore: false);
    }
    final params = <String, dynamic>{
      'keyword': trimmed,
      'page': page,
      'limit': limit,
    };
    if (isNotBlank(sourceId)) {
      params['source'] = sourceId!.trim();
    }
    final response = await _api.get<dynamic>('/videos/search', query: params);
    return _parseFeed(_unwrap(response.data));
  }

  VideoFeed _parseFeed(dynamic raw) {
    final data = _unwrap(raw);
    List? seriesRaw;
    bool hasMore = false;
    if (data is Map<String, dynamic>) {
      seriesRaw = data['series'] as List?;
      hasMore = (data['hasMore'] as bool?) ?? false;
    } else if (data is List) {
      seriesRaw = data;
    }
    final items = seriesRaw
            ?.whereType<Map<String, dynamic>>()
            .map(VideoSummary.fromJson)
            .where((e) => isNotBlank(e.id))
            .toList() ??
        <VideoSummary>[];
    return VideoFeed(items: items, hasMore: hasMore);
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
}
