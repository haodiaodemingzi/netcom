import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:image/image.dart' as img;

/// 图片去白边工具类
class ImageCropper {
  /// 检测并去除图片的白边
  /// 
  /// [imageData] 原始图片数据
  /// [threshold] 白色阈值，0-255，默认为 250
  /// 返回裁切后的图片数据
  static Future<Uint8List> removeWhiteBorder(
    Uint8List imageData, {
    int threshold = 250,
  }) async {
    try {
      // 使用 image 包解码图片
      final image = img.decodeImage(imageData);
      if (image == null) {
        return imageData;
      }

      // 检测白边边界
      final bounds = _detectWhiteBorder(image, threshold);
      
      // 如果没有检测到白边，返回原图
      if (bounds == null) {
        return imageData;
      }

      // 裁切图片
      final cropped = img.copyCrop(
        image,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      );

      // 编码为 PNG 格式
      return Uint8List.fromList(img.encodePng(cropped));
    } catch (e) {
      // 如果处理失败，返回原图
      return imageData;
    }
  }

  /// 检测图片的白边边界
  static _CropBounds? _detectWhiteBorder(img.Image image, int threshold) {
    final width = image.width;
    final height = image.height;
    
    // 从左向右扫描，找到第一个非白像素
    int left = 0;
    for (int x = 0; x < width; x++) {
      if (!_isColumnWhite(image, x, height, threshold)) {
        left = x;
        break;
      }
    }
    
    // 从右向左扫描，找到第一个非白像素
    int right = width - 1;
    for (int x = width - 1; x >= left; x--) {
      if (!_isColumnWhite(image, x, height, threshold)) {
        right = x;
        break;
      }
    }
    
    // 从上向下扫描，找到第一个非白像素
    int top = 0;
    for (int y = 0; y < height; y++) {
      if (!_isRowWhite(image, y, width, threshold)) {
        top = y;
        break;
      }
    }
    
    // 从下向上扫描，找到第一个非白像素
    int bottom = height - 1;
    for (int y = height - 1; y >= top; y--) {
      if (!_isRowWhite(image, y, width, threshold)) {
        bottom = y;
        break;
      }
    }
    
    // 计算裁切区域
    final cropWidth = right - left + 1;
    final cropHeight = bottom - top + 1;
    
    // 如果裁切区域与原图相同或更小，返回 null（不需要裁切）
    if (cropWidth >= width && cropHeight >= height) {
      return null;
    }
    
    // 如果裁切区域太小（可能是误判），返回 null
    if (cropWidth < width * 0.5 || cropHeight < height * 0.5) {
      return null;
    }
    
    return _CropBounds(
      x: left,
      y: top,
      width: cropWidth,
      height: cropHeight,
    );
  }

  /// 检查指定列是否全是白色
  static bool _isColumnWhite(img.Image image, int x, int height, int threshold) {
    for (int y = 0; y < height; y++) {
      final pixel = image.getPixel(x, y);
      final r = pixel.r.toInt();
      final g = pixel.g.toInt();
      final b = pixel.b.toInt();
      if (!_isWhitePixel(r, g, b, threshold)) {
        return false;
      }
    }
    return true;
  }

  /// 检查指定行是否全是白色
  static bool _isRowWhite(img.Image image, int y, int width, int threshold) {
    for (int x = 0; x < width; x++) {
      final pixel = image.getPixel(x, y);
      final r = pixel.r.toInt();
      final g = pixel.g.toInt();
      final b = pixel.b.toInt();
      if (!_isWhitePixel(r, g, b, threshold)) {
        return false;
      }
    }
    return true;
  }

  /// 检查像素是否为白色
  static bool _isWhitePixel(int r, int g, int b, int threshold) {
    // 如果 RGB 通道都大于阈值，认为是白色
    return r >= threshold && g >= threshold && b >= threshold;
  }
}

/// 裁切边界信息
class _CropBounds {
  final int x;
  final int y;
  final int width;
  final int height;

  _CropBounds({
    required this.x,
    required this.y,
    required this.width,
    required this.height,
  });
}
