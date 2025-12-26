import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../ebook_models.dart';

class EbookRemoteService {
  EbookRemoteService(this._api);

  static const String _defaultSource = 'kanunu8';
  final ApiClient _api;

  Future<EbookCategoriesResponse> fetchCategories({String? sourceId}) async {
    final params = <String, dynamic>{};
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final response = await _api.get<dynamic>('/ebooks/categories', query: params);
    return EbookCategoriesResponse.fromJson(_unwrap(response.data));
  }

  Future<EbookFeed> fetchBooksByCategory({
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
    final response = await _api.get<dynamic>('/ebooks/category/$categoryId', query: params);
    return EbookFeed.fromJson(_unwrap(response.data));
  }

  Future<EbookDetailData> fetchBookDetail({
    required String bookId,
    String? sourceId,
  }) async {
    final params = <String, dynamic>{};
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final response = await _api.get<dynamic>('/ebooks/$bookId', query: params);
    return EbookDetailData.fromJson(_unwrap(response.data));
  }

  Future<EbookChaptersData> fetchChapters({
    required String bookId,
    String? sourceId,
  }) async {
    final params = <String, dynamic>{};
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final response = await _api.get<dynamic>('/ebooks/$bookId/chapters', query: params);
    return EbookChaptersData.fromJson(_unwrap(response.data));
  }

  Future<EbookChapterContent> fetchChapterContent({
    required String chapterId,
    String? sourceId,
  }) async {
    final params = <String, dynamic>{};
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final response = await _api.get<dynamic>('/ebooks/chapters/$chapterId/content', query: params);
    return EbookChapterContent.fromJson(_unwrap(response.data));
  }

  Future<EbookFeed> searchBooks({
    required String keyword,
    String? sourceId,
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
    final response = await _api.get<dynamic>('/ebooks/search', query: params);
    return EbookFeed.fromJson(_unwrap(response.data));
  }

  Future<EbookSourcesResponse> fetchSources() async {
    final response = await _api.get<dynamic>('/ebooks/sources');
    return EbookSourcesResponse.fromJson(_unwrap(response.data));
  }

  Future<EbookMetadataResponse> fetchAllMetadata({
    String? sourceId,
    bool forceReload = false,
  }) async {
    final params = <String, dynamic>{
      'force_reload': forceReload,
    };
    final resolvedSource = _resolveSource(sourceId);
    if (resolvedSource != null) {
      params['source'] = resolvedSource;
    }
    final response = await _api.get<dynamic>('/ebooks/metadata/all', query: params);
    return EbookMetadataResponse.fromJson(response.data);
  }

  Future<Map<String, dynamic>> fetchMetadataStatus() async {
    final response = await _api.get<dynamic>('/ebooks/metadata/status');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> fetchMetadataConfig() async {
    final response = await _api.get<dynamic>('/ebooks/metadata/config');
    return response.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateMetadataConfig(Map<String, dynamic> config) async {
    final response = await _api.postJson<dynamic>('/ebooks/metadata/config', body: config);
    return response.data as Map<String, dynamic>;
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

  String? _resolveSource(String? sourceId) {
    final normalized = sourceId?.trim() ?? '';
    if (normalized.isNotEmpty) {
      return normalized;
    }
    return _defaultSource;
  }
}
