const String _rawBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://192.168.123.178:5000');

String proxyImageUrl(String url) {
  if (url.isEmpty) {
    return url;
  }
  final base = _rawBaseUrl.endsWith('/api') ? _rawBaseUrl : '$_rawBaseUrl/api';
  final encoded = Uri.encodeComponent(url);
  return '$base/proxy/image?url=$encoded';
}
