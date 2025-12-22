const String _defaultBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://192.168.123.178:5000');

class ApiConfig {
  ApiConfig({
    required this.baseUrl,
    this.connectTimeout = const Duration(seconds: 10),
    this.receiveTimeout = const Duration(seconds: 20),
    this.sendTimeout = const Duration(seconds: 20),
  });

  final String baseUrl;
  final Duration connectTimeout;
  final Duration receiveTimeout;
  final Duration sendTimeout;

  factory ApiConfig.fromEnv() {
    final normalized = _normalizeBaseUrl(_defaultBaseUrl);
    final withApiPrefix = normalized.endsWith('/api') ? normalized : '$normalized/api';
    return ApiConfig(baseUrl: withApiPrefix);
  }
}

String _normalizeBaseUrl(String raw) {
  if (raw.isEmpty) {
    return 'http://192.168.123.178:5000';
  }
  final trimmed = raw.trim();
  if (trimmed.endsWith('/')) {
    return trimmed.substring(0, trimmed.length - 1);
  }
  return trimmed;
}
