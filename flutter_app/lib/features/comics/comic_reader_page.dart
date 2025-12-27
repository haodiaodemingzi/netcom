import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../core/network/api_config.dart';
import '../../core/network/network_providers.dart';
import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import 'comics_provider.dart';
import 'data/comics_remote_service.dart';
import 'comics_models.dart';

class ComicReaderArgs {
  const ComicReaderArgs({
    required this.chapters,
    required this.currentChapterId,
    required this.comicTitle,
    required this.sourceId,
  });

  final List<ComicChapter> chapters;
  final String currentChapterId;
  final String comicTitle;
  final String sourceId;
}

class ComicReaderPage extends ConsumerStatefulWidget {
  const ComicReaderPage({
    super.key,
    required this.comicId,
    required this.args,
  });

  const ComicReaderPage.fallback({super.key})
      : comicId = '',
        args = const ComicReaderArgs(
          chapters: <ComicChapter>[],
          currentChapterId: '',
          comicTitle: '',
          sourceId: '',
        );

  final String comicId;
  final ComicReaderArgs args;

  @override
  ConsumerState<ComicReaderPage> createState() => _ComicReaderPageState();
}

class _ComicReaderPageState extends ConsumerState<ComicReaderPage> {
  List<ComicPageImage> _images = <ComicPageImage>[];
  Map<String, dynamic> _downloadConfig = <String, dynamic>{};
  Map<int, String> _localImagePaths = <int, String>{};
  bool _useLocalImages = false;
  SettingsModel _settings = SettingsModel();
  bool _loading = false;
  String? _error;
  late int _currentIndex;
  int _currentPage = 1;
  bool _isFullscreen = false;

  final PageController _horizontalController = PageController();
  final ScrollController _verticalController = ScrollController();
  final Map<int, double> _itemHeights = <int, double>{};

  @override
  void initState() {
    super.initState();
    _currentIndex = _resolveInitialIndex();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadSettings();
      _loadImages();
    });
    _verticalController.addListener(_handleVerticalScroll);
  }


  ComicChapter? get _currentChapter {
    if (_currentIndex < 0 || _currentIndex >= widget.args.chapters.length) {
      return null;
    }
    return widget.args.chapters[_currentIndex];
  }

  bool get _hasNext => _currentIndex + 1 < widget.args.chapters.length;
  bool get _hasPrev => _currentIndex - 1 >= 0;
  bool get _isHorizontal => _settings.scrollMode == 'horizontal';

  int _resolveInitialIndex() {
    final chapters = widget.args.chapters;
    if (chapters.isEmpty) {
      return 0;
    }
    final target = widget.args.currentChapterId;
    final index = chapters.indexWhere((element) => element.id == target);
    if (index >= 0) {
      return index;
    }
    return 0;
  }

  Future<void> _loadSettings() async {
    final repo = ref.read(settingsRepositoryProvider);
    if (repo == null) {
      return;
    }
    final next = repo.load();
    setState(() {
      _settings = next;
    });
  }

  Future<void> _loadImages() async {
    final chapter = _currentChapter;
    if (chapter == null || chapter.id.isEmpty) {
      setState(() {
        _images = <ComicPageImage>[];
        _downloadConfig = <String, dynamic>{};
        _localImagePaths = <int, String>{};
        _useLocalImages = false;
        _error = '未找到章节';
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _images = <ComicPageImage>[];
      _downloadConfig = <String, dynamic>{};
      _localImagePaths = <int, String>{};
      _useLocalImages = false;
    });

    final localPaths = await _checkLocalChapter(widget.comicId, chapter.id);
    if (localPaths.isNotEmpty) {
      debugPrint('使用本地已下载图片: ${localPaths.length} 张');
      final images = localPaths.entries
          .map((e) => ComicPageImage(page: e.key, url: ''))
          .toList()
        ..sort((a, b) => a.page.compareTo(b.page));
      if (!mounted) return;
      setState(() {
        _images = images;
        _localImagePaths = localPaths;
        _useLocalImages = true;
        _loading = false;
        _error = images.isEmpty ? '暂无图片' : null;
      });
      if (images.isNotEmpty) {
        _saveHistory(page: 1);
      }
      return;
    }

    final service = ref.read(comicsRemoteServiceProvider);
    try {
      final data = await service.fetchChapterDownloadInfo(
        chapterId: chapter.id,
        sourceId: widget.args.sourceId,
      );
      final images = data.images;
      if (!mounted) {
        return;
      }
      setState(() {
        _images = images;
        _downloadConfig = data.downloadConfig;
        _loading = false;
        _error = images.isEmpty ? '暂无图片' : null;
      });
      if (images.isNotEmpty) {
        await _preheatCookie();
        _prefetchAround(0);
        _saveHistory(page: 1);
      }
    } catch (e, stack) {
      debugPrint('加载章节图片失败 ${chapter.id} ${e.toString()}');
      debugPrintStack(stackTrace: stack);
      setState(() {
        _loading = false;
        _error = '加载失败 ${e.toString()}';
      });
    }
  }

  Future<Map<int, String>> _checkLocalChapter(String comicId, String chapterId) async {
    final localPaths = <int, String>{};
    try {
      final safeComicId = comicId.trim().replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
      final safeChapterId = chapterId.trim().replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
      final base = await getApplicationDocumentsDirectory();
      final dir = Directory(p.join(base.path, 'comics', safeComicId, safeChapterId));
      if (!await dir.exists()) {
        return localPaths;
      }
      final metaFile = File(p.join(dir.path, 'meta.json'));
      if (!await metaFile.exists()) {
        return localPaths;
      }
      final files = await dir.list().toList();
      for (final entity in files) {
        if (entity is! File) continue;
        final name = p.basename(entity.path);
        if (name == 'meta.json') continue;
        final ext = p.extension(name).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].contains(ext)) continue;
        final baseName = p.basenameWithoutExtension(name);
        final page = int.tryParse(baseName);
        if (page != null && page > 0) {
          localPaths[page] = entity.path;
        }
      }
    } catch (e) {
      debugPrint('检查本地章节失败: $e');
    }
    return localPaths;
  }

  Future<void> _preheatCookie() async {
    final cookieUrl = (_downloadConfig['cookie_url'] as String?)?.trim();
    if (cookieUrl == null || cookieUrl.isEmpty) {
      return;
    }
    try {
      debugPrint('预热 Cookie: $cookieUrl');
      final api = ref.read(apiClientProvider);
      final headers = _buildImageHeaders();
      await api.get<String>(
        cookieUrl,
        options: Options(
          headers: {
            'User-Agent': headers['User-Agent'] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            if (headers['Referer'] != null) 'Referer': headers['Referer'],
          },
          followRedirects: true,
          validateStatus: (status) => status != null && status < 500,
        ),
      );
      debugPrint('Cookie 预热成功');
    } catch (e) {
      debugPrint('预热 cookie 失败: $e');
    }
  }

  void _switchChapter(int nextIndex) {
    if (nextIndex < 0 || nextIndex >= widget.args.chapters.length) {
      return;
    }
    setState(() {
      _currentIndex = nextIndex;
    });
    _horizontalController.jumpToPage(0);
    _verticalController.jumpTo(0);
    _currentPage = 1;
    _loadImages();
  }

  @override
  Widget build(BuildContext context) {
    final chapter = _currentChapter;
    final title = chapter?.title ?? '阅读器';
    
    if (_isFullscreen) {
      return Scaffold(
        backgroundColor: _settings.backgroundColor == 'white' ? Colors.white : Colors.black,
        body: Stack(
          children: [
            _buildBody(context),
            _buildFullscreenControls(),
          ],
        ),
      );
    }
    
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.args.comicTitle} - $title'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _loadImages,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: '刷新',
          ),
          IconButton(
            onPressed: _toggleFullscreen,
            icon: const Icon(Icons.fullscreen),
            tooltip: '全屏',
          ),
        ],
      ),
      body: _buildBody(context),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  void _toggleFullscreen() {
    setState(() {
      _isFullscreen = !_isFullscreen;
    });
    if (_isFullscreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.portraitDown,
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
    } else {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    }
  }

  @override
  void dispose() {
    if (_isFullscreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    }
    _horizontalController.dispose();
    _verticalController.dispose();
    super.dispose();
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _loadImages,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }
    if (_images.isEmpty) {
      return const Center(child: Text('暂无图片'));
    }
    if (_isHorizontal) {
      return PageView.builder(
        controller: _horizontalController,
        itemCount: _images.length,
        onPageChanged: (index) {
          final page = index + 1;
          _currentPage = page;
          _prefetchAround(index);
          _saveHistory(page: page);
          setState(() {});
        },
        itemBuilder: (context, index) {
          final image = _images[index];
          return Center(
            child: _buildImageCard(image),
          );
        },
      );
    }
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        _handleScrollNotification(notification);
        return false;
      },
      child: Scrollbar(
        controller: _verticalController,
        child: ListView.builder(
          controller: _verticalController,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          itemCount: _images.length,
          itemBuilder: (context, index) {
            final image = _images[index];
            return _MeasuredItem(
              onHeight: (height) => _itemHeights[index] = height,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _buildImageCard(image),
              ),
            );
          },
        ),
      ),
    );
  }

  double _calcAspectRatio(ComicPageImage image) {
    final width = image.width ?? 0;
    final height = image.height ?? 0;
    if (width <= 0 || height <= 0) {
      return 0.7;
    }
    final ratio = width / height;
    if (ratio <= 0) {
      return 0.7;
    }
    return ratio;
  }

  Widget _buildBottomBar() {
    final chapter = _currentChapter;
    final title = chapter?.title ?? '';
    final total = _images.isEmpty ? 1 : _images.length;
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          border: Border(
            top: BorderSide(color: Theme.of(context).dividerColor),
          ),
        ),
        child: Row(
          children: [
            IconButton(
              onPressed: _hasPrev ? () => _switchChapter(_currentIndex - 1) : null,
              icon: const Icon(Icons.arrow_back_ios_new_rounded),
              tooltip: '上一话',
            ),
            IconButton(
              onPressed: _hasNext ? () => _switchChapter(_currentIndex + 1) : null,
              icon: const Icon(Icons.arrow_forward_ios_rounded),
              tooltip: '下一话',
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            Text(
              '$_currentPage/$total',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Map<String, String> _buildImageHeaders() {
    final headers = <String, String>{};
    final referer = _downloadConfig['referer'] as String?;
    if (referer != null && referer.isNotEmpty) {
      headers['Referer'] = referer;
    }
    final configHeaders = _downloadConfig['headers'];
    if (configHeaders is Map) {
      for (final entry in configHeaders.entries) {
        if (entry.key is String && entry.value is String) {
          headers[entry.key as String] = entry.value as String;
        }
      }
    }
    if (headers['User-Agent'] == null) {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
    }
    return headers;
  }

  Widget _buildImageCard(ComicPageImage image) {
    final fit = _settings.imageFitMode == 'height' ? BoxFit.fitHeight : BoxFit.contain;
    final bg = _settings.backgroundColor == 'white' ? Colors.white : Colors.black;
    final zoomScale = _settings.imageZoomScale;
    
    Widget imageWidget;
    final localPath = _localImagePaths[image.page];
    if (_useLocalImages && localPath != null && localPath.isNotEmpty) {
      imageWidget = Image.file(
        File(localPath),
        fit: fit,
        errorBuilder: (_, __, ___) => Container(
          color: Colors.grey.shade200,
          alignment: Alignment.center,
          child: const Icon(Icons.broken_image),
        ),
      );
    } else {
      final headers = _buildImageHeaders();
      imageWidget = Image.network(
        image.url,
        headers: headers,
        fit: fit,
        errorBuilder: (_, __, ___) => Container(
          color: Colors.grey.shade200,
          alignment: Alignment.center,
          child: const Icon(Icons.broken_image),
        ),
      );
    }
    
    return Container(
      color: bg,
      alignment: Alignment.center,
      child: Transform.scale(
        scale: zoomScale,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: AspectRatio(
            aspectRatio: _calcAspectRatio(image),
            child: imageWidget,
          ),
        ),
      ),
    );
  }

  Widget _buildFullscreenControls() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withOpacity(0.7),
                Colors.transparent,
              ],
            ),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: _toggleFullscreen,
                icon: const Icon(Icons.fullscreen_exit, color: Colors.white),
                tooltip: '退出全屏',
              ),
              const Spacer(),
              IconButton(
                onPressed: _loading ? null : _loadImages,
                icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                tooltip: '刷新',
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _prefetchAround(int index) {
    if (_images.isEmpty) {
      return;
    }
    _prefetch(index);
    if (index + 1 < _images.length) {
      _prefetch(index + 1);
    }
    if (index + 2 < _images.length) {
      _prefetch(index + 2);
    }
  }

  void _prefetch(int index) {
    if (index < 0 || index >= _images.length) {
      return;
    }
    final image = _images[index];
    if (image.url.isEmpty) {
      return;
    }
    precacheImage(NetworkImage(image.url), context);
  }

  void _handleVerticalScroll() {
    if (_images.isEmpty) {
      return;
    }
    _updateCurrentPageFromOffset(_verticalController.offset);
  }

  void _handleScrollNotification(ScrollNotification notification) {
    if (notification is! ScrollUpdateNotification) {
      return;
    }
    _updateCurrentPageFromOffset(notification.metrics.pixels);
  }

  void _updateCurrentPageFromOffset(double offset) {
    if (_itemHeights.isEmpty) {
      return;
    }
    double consumed = 0;
    for (int i = 0; i < _images.length; i++) {
      final height = _itemHeights[i] ?? 0;
      if (height <= 0) {
        continue;
      }
      if (consumed + height > offset) {
        final page = i + 1;
        if (page != _currentPage) {
          _currentPage = page;
          _prefetchAround(i);
          _saveHistory(page: page);
          setState(() {});
        }
        return;
      }
      consumed += height;
    }
  }

  Future<void> _saveHistory({required int page}) async {
    final chapter = _currentChapter;
    final title = widget.args.comicTitle;
    final repo = ref.read(historyRepositoryProvider);
    if (chapter == null || repo == null || widget.comicId.isEmpty) {
      return;
    }
    await repo.addComic(
      id: widget.comicId,
      title: title,
      chapterId: chapter.id,
      page: page,
      source: widget.args.sourceId,
    );
  }
}

class _MeasuredItem extends StatelessWidget {
  const _MeasuredItem({
    required this.child,
    required this.onHeight,
  });

  final Widget child;
  final ValueChanged<double> onHeight;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final render = context.findRenderObject();
          if (render is RenderBox) {
            onHeight(render.size.height);
          }
        });
        return child;
      },
    );
  }
}
