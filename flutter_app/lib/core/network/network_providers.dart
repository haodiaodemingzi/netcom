import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/storage_providers.dart';
import 'api_client.dart';
import 'api_config.dart';

final apiConfigProvider = Provider<ApiConfig>((ref) {
  return ApiConfig.fromEnv();
});

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(apiConfigProvider);
  final activationRepository = ref.watch(activationRepositoryProvider);
  final options = BaseOptions(
    baseUrl: config.baseUrl,
    connectTimeout: config.connectTimeout,
    receiveTimeout: config.receiveTimeout,
    sendTimeout: config.sendTimeout,
    responseType: ResponseType.json,
    headers: <String, dynamic>{
      'Accept': 'application/json',
    },
  );
  final dio = Dio(options);
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final repo = activationRepository;
        if (repo != null) {
          final token = repo.loadToken();
          if (token.isNotEmpty) {
            options.headers.putIfAbsent('X-Activation-Token', () => token);
          }
        }
        handler.next(options);
      },
      onError: (err, handler) {
        final payload = <String, dynamic>{
          'path': err.requestOptions.path,
          'status': err.response?.statusCode,
          'msg': err.message,
          'error': err.error?.toString(),
        };
        // ignore: avoid_print
        print(payload);
        handler.next(err);
      },
    ),
  );
  return dio;
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final dio = ref.watch(dioProvider);
  return ApiClient(dio);
});
