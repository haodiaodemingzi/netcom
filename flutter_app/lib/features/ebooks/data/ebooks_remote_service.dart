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
        '/ebooks/categories',
        queryParameters: {'source': source},
      );

      if (response.statusCode == 200) {
        final responseData = response.data;
        if (responseData == null) {
          return [];
        }
        
        List<dynamic> categoriesList;
        if (responseData is Map) {
          final data = responseData['data'];
          if (data == null) {
            return [];
          }
          if (data is List) {
            categoriesList = data;
          } else if (data is Map && data.containsKey('categories')) {
            categoriesList = data['categories'] as List<dynamic>;
          } else {
            throw Exception('Unexpected data format: data is not a list');
          }
        } else if (responseData is List) {
          categoriesList = responseData;
        } else {
          throw Exception('Unexpected response format: ${responseData.runtimeType}');
        }
        
        return categoriesList
            .map((item) => EbookCategory.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to fetch categories: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '获取分类失败');
    } catch (e) {
      throw Exception('解析分类数据失败: ${e.toString()}');
    }
  }

  /// 获取数据源列表
  Future<List<EbookSourceInfo>> fetchSources() async {
    try {
      final response = await _dio.get('/ebooks/sources');

      if (response.statusCode == 200) {
        final data = response.data;
        List<dynamic> sourcesList;
        
        if (data is Map) {
          if (data.containsKey('data') && data['data'] is Map && data['data'].containsKey('sources')) {
            sourcesList = data['data']['sources'] as List<dynamic>;
          } else if (data.containsKey('sources')) {
            sourcesList = data['sources'] as List<dynamic>;
          } else if (data.containsKey('data') && data['data'] is List) {
            sourcesList = data['data'] as List<dynamic>;
          } else {
            throw Exception('Unexpected data format: missing sources field');
          }
        } else if (data is List) {
          sourcesList = data;
        } else {
          throw Exception('Unexpected data format: ${data.runtimeType}');
        }
        
        return sourcesList
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
        '/ebooks/category/$categoryId',
        queryParameters: {
          'page': page,
          'limit': limit,
          'source': source,
        },
      );

      if (response.statusCode == 200) {
        final responseData = response.data;
        if (responseData == null) {
          return [];
        }
        
        List<dynamic> booksList;
        if (responseData is Map) {
          final data = responseData['data'];
          if (data == null) {
            return [];
          }
          if (data is List) {
            booksList = data;
          } else if (data is Map && data.containsKey('books')) {
            booksList = data['books'] as List<dynamic>;
          } else {
            throw Exception('Unexpected data format: data is not a list');
          }
        } else if (responseData is List) {
          booksList = responseData;
        } else {
          throw Exception('Unexpected response format: ${responseData.runtimeType}');
        }
        
        return booksList
            .map((item) => EbookSummary.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to fetch books: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '获取书籍列表失败');
    } catch (e) {
      throw Exception('解析书籍列表失败: ${e.toString()}');
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
        '/ebooks/search',
        queryParameters: {
          'keyword': keyword,
          'page': page,
          'limit': limit,
          'source': source,
        },
      );

      if (response.statusCode == 200) {
        final responseData = response.data;
        if (responseData == null) {
          return [];
        }
        
        List<dynamic> booksList;
        if (responseData is Map) {
          final data = responseData['data'];
          if (data == null) {
            return [];
          }
          if (data is List) {
            booksList = data;
          } else if (data is Map && data.containsKey('books')) {
            booksList = data['books'] as List<dynamic>;
          } else {
            throw Exception('Unexpected data format: data is not a list');
          }
        } else if (responseData is List) {
          booksList = responseData;
        } else {
          throw Exception('Unexpected response format: ${responseData.runtimeType}');
        }
        
        return booksList
            .map((item) => EbookSummary.fromJson(item as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to search books: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw _handleDioError(e, '搜索书籍失败');
    } catch (e) {
      throw Exception('解析搜索结果失败: ${e.toString()}');
    }
  }

  /// 获取书籍详情
  Future<EbookDetail> fetchBookDetail({
    required String bookId,
    required String source,
  }) async {
    try {
      final response = await _dio.get(
        '/ebooks/$bookId',
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
        '/ebooks/$bookId/chapters',
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
        '/ebooks/chapters/$chapterId/content',
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
