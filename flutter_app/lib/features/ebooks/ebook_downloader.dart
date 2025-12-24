import 'dart:async';
import 'dart:collection';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_app/features/ebooks/data/ebooks_remote_service.dart';
import 'package:flutter_app/features/ebooks/ebooks_models.dart';

/// 电子书下载管理器
class EbookDownloader {
  final EbooksRemoteService _remoteService;
  final void Function(double)? onProgress;
  final void Function(String)? onChapterComplete;
  final void Function()? onComplete;
  final void Function(String)? onError;
  final void Function()? onCancel;

  bool _isDownloading = false;
  bool _isPaused = false;
  double _progress = 0.0;
  int _completedChapters = 0;
  int _totalChapters = 0;

  EbookDownloader({
    required EbooksRemoteService remoteService,
    this.onProgress,
    this.onChapterComplete,
    this.onComplete,
    this.onError,
    this.onCancel,
  }) : _remoteService = remoteService;

  /// 下载状态
  bool get isDownloading => _isDownloading;
  bool get isPaused => _isPaused;
  double get progress => _progress;
  int get completedChapters => _completedChapters;
  int get totalChapters => _totalChapters;

  /// 开始下载整本书
  Future<void> downloadBook({
    required EbookDetail detail,
    int maxConcurrent = 3,
  }) async {
    if (_isDownloading && !_isPaused) return;

    try {
      _isDownloading = true;
      _isPaused = false;
      _progress = 0.0;
      _completedChapters = 0;
      _totalChapters = detail.chapters.length;

      // 创建临时目录
      final tempDir = await _createTempDirectory(detail.id);
      
      // 并发下载章节
      await _downloadChaptersConcurrently(
        detail.chapters,
        detail.source,
        tempDir,
        maxConcurrent,
      );

      // 合并章节
      final finalFile = await _mergeChapters(detail, tempDir);

      // 清理临时文件
      await _cleanupTempDirectory(tempDir);

      _isDownloading = false;
      _progress = 1.0;
      onComplete?.call();
    } catch (e) {
      _isDownloading = false;
      onError?.call(e.toString());
    }
  }

  /// 暂停下载
  void pause() {
    _isPaused = true;
  }

  /// 继续下载
  void resume() {
    _isPaused = false;
  }

  /// 取消下载
  void cancel() {
    _isDownloading = false;
    _isPaused = false;
    onCancel?.call();
  }

  /// 创建临时目录
  Future<Directory> _createTempDirectory(String bookId) async {
    final appDir = await getApplicationDocumentsDirectory();
    final tempDir = Directory('${appDir.path}/ebooks_temp_${bookId}');
    
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
    
    await tempDir.create(recursive: true);
    return tempDir;
  }

  /// 并发下载章节
  Future<void> _downloadChaptersConcurrently(
    List<EbookChapter> chapters,
    String source,
    Directory tempDir,
    int maxConcurrent,
  ) async {
    final semaphore = _Semaphore(maxConcurrent);
    final futures = <Future<void>>[];

    for (int i = 0; i < chapters.length; i++) {
      if (!_isDownloading) break;

      final future = _downloadChapterWithSemaphore(
        chapters[i],
        source,
        tempDir,
        semaphore,
        i + 1,
      );
      futures.add(future);
    }

    await Future.wait(futures);
  }

  /// 使用信号量控制并发下载章节
  Future<void> _downloadChapterWithSemaphore(
    EbookChapter chapter,
    String source,
    Directory tempDir,
    _Semaphore semaphore,
    int chapterNumber,
  ) async {
    await semaphore.acquire();

    try {
      while (_isPaused && _isDownloading) {
        await Future.delayed(const Duration(milliseconds: 100));
      }

      if (!_isDownloading) return;

      // 获取章节内容
      final content = await _remoteService.fetchChapterContent(
        chapterId: chapter.id,
        source: source,
      );

      // 格式化章节内容
      final formattedContent = _formatChapterContent(
        chapter.title,
        content.content,
        chapterNumber,
      );

      // 保存到临时文件
      final fileName = 'chapter_${chapterNumber.toString().padLeft(4, '0')}.txt';
      final file = File('${tempDir.path}/$fileName');
      await file.writeAsString(formattedContent);

      // 更新进度
      _completedChapters++;
      _progress = _completedChapters / _totalChapters;
      onProgress?.call(_progress);
      onChapterComplete?.call(chapter.title);
    } catch (e) {
      // 单个章节失败不影响整体下载
      print('下载章节 ${chapter.title} 失败: $e');
    } finally {
      semaphore.release();
    }
  }

  /// 格式化章节内容
  String _formatChapterContent(String title, String content, int chapterNumber) {
    final buffer = StringBuffer();
    
    // 添加章节标题
    buffer.writeln('=' * 50);
    buffer.writeln('$title');
    buffer.writeln('=' * 50);
    buffer.writeln();
    
    // 添加章节内容
    buffer.writeln(content);
    buffer.writeln();
    buffer.writeln();
    
    return buffer.toString();
  }

  /// 合并章节
  Future<File> _mergeChapters(EbookDetail detail, Directory tempDir) async {
    final appDir = await getApplicationDocumentsDirectory();
    final ebooksDir = Directory('${appDir.path}/ebooks');
    
    if (!await ebooksDir.exists()) {
      await ebooksDir.create(recursive: true);
    }

    final finalFile = File('${ebooksDir.path}/${detail.id}.txt');
    final buffer = StringBuffer();

    // 添加书籍信息
    buffer.writeln('=' * 60);
    buffer.writeln('书名：${detail.title}');
    buffer.writeln('作者：${detail.author}');
    buffer.writeln('状态：${detail.status}');
    buffer.writeln('数据源：${detail.source}');
    buffer.writeln('=' * 60);
    buffer.writeln();
    buffer.writeln();

    // 合并所有章节文件
    final tempFiles = await tempDir.list().toList();
    final chapterFiles = tempFiles
        .whereType<File>()
        .where((file) => file.path.endsWith('.txt'))
        .toList();

    // 按文件名排序
    chapterFiles.sort((a, b) => a.path.compareTo(b.path));

    for (final file in chapterFiles) {
      final content = await file.readAsString();
      buffer.write(content);
    }

    await finalFile.writeAsString(buffer.toString());
    return finalFile;
  }

  /// 清理临时目录
  Future<void> _cleanupTempDirectory(Directory tempDir) async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  }

  /// 检查书籍是否已下载
  static Future<bool> isBookDownloaded(String bookId) async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final file = File('${appDir.path}/ebooks/$bookId.txt');
      return await file.exists();
    } catch (e) {
      return false;
    }
  }

  /// 获取已下载的书籍文件
  static Future<File?> getDownloadedBook(String bookId) async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final file = File('${appDir.path}/ebooks/$bookId.txt');
      return await file.exists() ? file : null;
    } catch (e) {
      return null;
    }
  }

  /// 删除已下载的书籍
  static Future<bool> deleteDownloadedBook(String bookId) async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final file = File('${appDir.path}/ebooks/$bookId.txt');
      
      if (await file.exists()) {
        await file.delete();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /// 获取下载统计信息
  static Future<Map<String, dynamic>> getDownloadStats() async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final ebooksDir = Directory('${appDir.path}/ebooks');
      
      if (!await ebooksDir.exists()) {
        return {
          'totalBooks': 0,
          'totalSize': 0,
        };
      }

      final files = await ebooksDir.list().toList();
      final bookFiles = files.whereType<File>().where((file) => file.path.endsWith('.txt')).toList();
      
      int totalSize = 0;
      for (final file in bookFiles) {
        totalSize += await file.length();
      }

      return {
        'totalBooks': bookFiles.length,
        'totalSize': totalSize,
      };
    } catch (e) {
      return {
        'totalBooks': 0,
        'totalSize': 0,
      };
    }
  }

  /// 清理所有下载的书籍
  static Future<void> clearAllDownloads() async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final ebooksDir = Directory('${appDir.path}/ebooks');
      
      if (await ebooksDir.exists()) {
        await ebooksDir.delete(recursive: true);
      }
    } catch (e) {
      // 忽略错误
    }
  }
}

/// 简单的信号量实现
class _Semaphore {
  final int maxCount;
  int _currentCount;
  final Queue<Completer<void>> _waitQueue = Queue<Completer<void>>();

  _Semaphore(this.maxCount) : _currentCount = maxCount;

  Future<void> acquire() async {
    if (_currentCount > 0) {
      _currentCount--;
      return;
    }

    final completer = Completer<void>();
    _waitQueue.add(completer);
    return completer.future;
  }

  void release() {
    if (_waitQueue.isNotEmpty) {
      final completer = _waitQueue.removeFirst();
      completer.complete();
    } else {
      _currentCount++;
    }
  }
}
