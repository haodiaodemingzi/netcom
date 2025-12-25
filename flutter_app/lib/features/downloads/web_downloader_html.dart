// Web 端触发浏览器下载
import 'dart:html' as html;

import 'package:flutter/foundation.dart';

Future<void> triggerBrowserDownload(String url, String filename) async {
  try {
    final response = await html.HttpRequest.request(
      url,
      method: 'GET',
      responseType: 'blob',
      requestHeaders: {
        'Accept': 'video/mp4,application/octet-stream',
      },
    );
    final blob = response.response as html.Blob?;
    if (blob == null) {
      throw Exception('下载响应为空');
    }
    final objectUrl = html.Url.createObjectUrlFromBlob(blob);
    final anchor = html.AnchorElement(href: objectUrl)
      ..setAttribute('download', filename)
      ..style.display = 'none';
    html.document.body?.append(anchor);
    anchor.click();
    anchor.remove();
    html.Url.revokeObjectUrl(objectUrl);
  } catch (e) {
    final anchor = html.AnchorElement(href: url)
      ..setAttribute('download', filename)
      ..style.display = 'none';
    html.document.body?.append(anchor);
    anchor.click();
    anchor.remove();
    if (kDebugMode) {
      debugPrint('Blob 下载失败，回退直接链接: $url, err: $e');
    }
  }
  if (kDebugMode) {
    debugPrint('触发浏览器下载(无跳转): $url');
  }
}
