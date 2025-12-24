import 'package:dio/dio.dart';
import 'package:flutter_app/core/network/api_config.dart';
import 'package:flutter_app/features/ebooks/ebooks_models.dart';

/// 电子书远程服务
class EbooksRemoteService {
  final Dio _dio;
  final ApiConfig _config = ApiConfig.fromEnv();

  EbooksRemoteService({Dio? dio}) : _dio = dio ?? Dio() {
    _dio.options.baseUrl = _config.baseUrl;
    _dio.options.connectTimeout = _config.connectTimeout;
    _dio.options.receiveTimeout = _config.receiveTimeout;
    _dio.options.sendTimeout = _config.sendTimeout;
  }

  /// 获取电子书分类
  Future<List<EbookCategory>> fetchCategories(String source) async {
    try {
      final response = await _dio.get(
        '/api/ebooks/categories',
        queryParameters: {'source': source},
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List<dynamic>;
        return data
            .map((item) => EbookCategory.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to fetch categories: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '获取分类失败');
    }
  }

  /// 获取数据源列表
  Future<List<EbookSourceInfo>> fetchSources() async {
    try {
      final response = await _dio.get('/api/ebooks/sources');

      if (response.statusCode == 200) {
        final data = response.data['data'] as List<dynamic>;
        return data
            .map((item) => EbookSourceInfo.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to fetch sources: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '获取数据源失败');
    }
  }

  /// 根据分类获取书籍列表
  Future<List<EbookSummary>> fetchBooksByCategory({
    required String categoryId,
    required String source,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get(
        '/api/ebooks/category/$categoryId',
        queryParameters: {
          'page': page,
          'limit': limit,
          'source': source,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List<dynamic>;
        return data
            .map((item) => EbookSummary.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to fetch books: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '获取书籍列表失败');
    }
  }

  /// 搜索书籍
  Future<List<EbookSummary>> searchBooks({
    required String keyword,
    required String source,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get(
        '/api/ebooks/search',
        queryParameters: {
          'keyword': keyword,
          'page': page,
          'limit': limit,
          'source': source,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List<dynamic>;
        return data
            .map((item) => EbookSummary.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to search books: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '搜索书籍失败');
    }
  }

  /// 获取书籍详情
  Future<EbookDetail> fetchBookDetail({
    required String bookId,
    required String source,
  }) async {
    try {
      final response = await _dio.get(
        '/api/ebooks/$bookId',
        queryParameters: {'source': source},
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>;
        return EbookDetail.fromJson(data);
      } else {
        throw Exception('Failed to fetch book detail: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '获取书籍详情失败');
    }
  }

  /// 获取章节列表
  Future<List<EbookChapter>> fetchChapters({
    required String bookId,
    required String source,
  }) async {
    try {
      final response = await _dio.get(
        '/api/ebooks/$bookId/chapters',
        queryParameters: {'source': source},
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List<dynamic>;
        return data
            .map((item) => EbookChapter.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to fetch chapters: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '获取章节列表失败');
    }
  }

  /// 获取章节内容
  Future<ChapterContent> fetchChapterContent({
    required String chapterId,
    required String source,
  }) async {
    try {
      final response = await _dio.get(
        '/api/ebooks/chapters/$chapterId/content',
        queryParameters: {'source': source},
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>;
        return ChapterContent.fromJson(data);
      } else {
        throw Exception('Failed to fetch chapter content: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '获取章节内容失败');
    }
  }

  /// 处理 Dio 错误
  Exception _handleDioError(DioException e, String defaultMessage) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception('网络连接超时');
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        if (statusCode != null) {
          switch (statusCode) {
            case 400:
              return Exception('请求参数错误');
            case 401:
              return Exception('未授权访问');
            case 403:
              return Exception('访问被禁止');
            case 404:
              return Exception('请求的资源不存在');
            case 500:
              return Exception('服务器内部错误');
            default:
              return Exception('服务器响应错误: $statusCode');
          }
        }
        return Exception('服务器响应错误');
      case DioExceptionType.cancel:
        return Exception('请求已取消');
      case DioExceptionType.unknown:
        return Exception('网络连接失败');
      default:
        return Exception(defaultMessage);
    }
  }
}
