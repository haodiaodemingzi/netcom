import 'package:dio/dio.dart';

class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? query,
    Options? options,
    CancelToken? cancelToken,
  }) {
    if (path.isEmpty) {
      throw ArgumentError('path 不能为空');
    }
    return _dio.get<T>(
      path,
      queryParameters: query,
      options: options,
      cancelToken: cancelToken,
    );
  }

  Future<Response<T>> postJson<T>(
    String path, {
    Map<String, dynamic>? body,
    Map<String, dynamic>? query,
    Options? options,
    CancelToken? cancelToken,
  }) {
    if (path.isEmpty) {
      throw ArgumentError('path 不能为空');
    }
    final mergedOptions = options?.copyWith(
          contentType: Headers.jsonContentType,
        ) ??
        Options(contentType: Headers.jsonContentType);
    return _dio.post<T>(
      path,
      data: body,
      queryParameters: query,
      options: mergedOptions,
      cancelToken: cancelToken,
    );
  }

  Future<Response<T>> delete<T>(
    String path, {
    Map<String, dynamic>? query,
    Options? options,
    CancelToken? cancelToken,
  }) {
    if (path.isEmpty) {
      throw ArgumentError('path 不能为空');
    }
    return _dio.delete<T>(
      path,
      queryParameters: query,
      options: options,
      cancelToken: cancelToken,
    );
  }
}
