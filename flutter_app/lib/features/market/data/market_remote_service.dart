import 'package:flutter_app/features/market/market_models.dart';
import 'package:flutter_app/core/network/api_client.dart';

/// 激活码验证响应
class ActivationResponse {
  const ActivationResponse({
    required this.success,
    this.token,
    this.message,
  });

  final bool success;
  final String? token;
  final String? message;

  factory ActivationResponse.fromJson(Map<String, dynamic> json) {
    return ActivationResponse(
      success: json['success'] as bool? ?? false,
      token: json['token'] as String?,
      message: json['message'] as String?,
    );
  }
}

/// 市场数据源远程服务
class MarketRemoteService {
  MarketRemoteService(this._apiClient);

  final ApiClient _apiClient;

  /// 获取市场数据（源 + 分类）
  Future<MarketResponse> fetchMarketData() async {
    try {
      // 并发获取 sources 和 categories
      final results = await Future.wait([
        _apiClient.get<Map<String, dynamic>>('/market/sources'),
        _apiClient.get<Map<String, dynamic>>('/market/categories'),
      ]);

      final sourcesData = results[0].data;
      final categoriesData = results[1].data;

      if (sourcesData == null || categoriesData == null) {
        throw Exception('Empty response');
      }

      final sourcesJson = sourcesData['sources'] as List?;
      final categoriesJson = categoriesData['categories'] as List?;

      return MarketResponse(
        sources: sourcesJson
                ?.map((e) => MarketSource.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        categories: categoriesJson
                ?.map((e) => MarketCategory.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
    } catch (e) {
      throw Exception('Failed to load market data: $e');
    }
  }

  /// 按分类获取数据源列表
  Future<List<MarketSource>> fetchSourcesByCategory(
    String category, {
    String? search,
  }) async {
    try {
      final query = <String, dynamic>{'category': category};
      if (search != null && search.isNotEmpty) {
        query['search'] = search;
      }
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/market/sources',
        query: query,
      );
      final data = response.data;
      if (data == null) {
        return [];
      }
      final sourcesJson = data['sources'] as List?;
      if (sourcesJson == null) {
        return [];
      }
      return sourcesJson
          .map((e) => MarketSource.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw Exception('Failed to load sources: $e');
    }
  }

  /// 获取数据源详情
  Future<MarketSource> fetchSourceDetail(String id) async {
    if (id.isEmpty) {
      throw ArgumentError('Source id cannot be empty');
    }
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/market/sources/$id',
      );
      final data = response.data;
      if (data == null) {
        throw Exception('Empty response');
      }
      return MarketSource.fromJson(data);
    } catch (e) {
      throw Exception('Failed to load source detail: $e');
    }
  }

  /// 获取分类列表
  Future<List<MarketCategory>> fetchCategories() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/market/categories',
      );
      final data = response.data;
      if (data == null) {
        return [];
      }
      final categoriesJson = data['categories'] as List?;
      if (categoriesJson == null) {
        return [];
      }
      return categoriesJson
          .map((e) => MarketCategory.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw Exception('Failed to load categories: $e');
    }
  }

  /// 验证激活码
  Future<ActivationResponse> activate(String code) async {
    if (code.trim().isEmpty) {
      throw ArgumentError('激活码不能为空');
    }
    try {
      final response = await _apiClient.postJson<Map<String, dynamic>>(
        '/market/activate',
        body: {'code': code.trim()},
      );
      final data = response.data;
      if (data == null) {
        throw Exception('Empty response');
      }
      return ActivationResponse.fromJson(data);
    } catch (e) {
      throw Exception('激活失败: $e');
    }
  }
}
