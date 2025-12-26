import 'dart:io';
import 'package:path_provider/path_provider.dart';

class EbookFileCacheService {
  EbookFileCacheService();

  Future<Directory> get _cacheDir async {
    final dir = await getApplicationDocumentsDirectory();
    return Directory('${dir.path}/ebook_cache');
  }

  Future<String?> getCachedChapterContent(String chapterId) async {
    try {
      final cacheDir = await _cacheDir;
      if (!await cacheDir.exists()) {
        return null;
      }
      final file = File('${cacheDir.path}/$chapterId.txt');
      if (await file.exists()) {
        return await file.readAsString();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> saveChapterContent(String chapterId, String content) async {
    try {
      final cacheDir = await _cacheDir;
      if (!await cacheDir.exists()) {
        await cacheDir.create(recursive: true);
      }
      final file = File('${cacheDir.path}/$chapterId.txt');
      await file.writeAsString(content);
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> deleteChapterContent(String chapterId) async {
    try {
      final cacheDir = await _cacheDir;
      final file = File('${cacheDir.path}/$chapterId.txt');
      if (await file.exists()) {
        await file.delete();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> clearCache() async {
    try {
      final cacheDir = await _cacheDir;
      if (await cacheDir.exists()) {
        await cacheDir.delete(recursive: true);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<int> getCacheSize() async {
    try {
      final cacheDir = await _cacheDir;
      if (!await cacheDir.exists()) {
        return 0;
      }
      int totalSize = 0;
      await for (final entity in cacheDir.list()) {
        if (entity is File) {
          totalSize += await entity.length();
        } else if (entity is Directory) {
          totalSize += await _getDirSize(entity);
        }
      }
      return totalSize;
    } catch (e) {
      return 0;
    }
  }

  Future<int> _getDirSize(Directory dir) async {
    int totalSize = 0;
    await for (final entity in dir.list()) {
      if (entity is File) {
        totalSize += await entity.length();
      } else if (entity is Directory) {
        totalSize += await _getDirSize(entity);
      }
    }
    return totalSize;
  }
}
