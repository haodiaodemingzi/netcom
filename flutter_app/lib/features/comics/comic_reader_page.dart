import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  SettingsModel _settings = SettingsModel();
  bool _loading = false;
  String? _error;
  late int _currentIndex;
  int _currentPage = 1;

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

  @override
  void dispose() {
    _horizontalController.dispose();
    _verticalController.dispose();
    super.dispose();
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
        _error = '未找到章节';
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _images = <ComicPageImage>[];
    });
    final service = ref.read(comicsRemoteServiceProvider);
    try {
      final data = await service.fetchChapterImages(
        chapterId: chapter.id,
        sourceId: widget.args.sourceId,
      );
      final images = data.images;
      if (!mounted) {
        return;
      }
      setState(() {
        _images = images;
        _loading = false;
        _error = images.isEmpty ? '暂无图片' : null;
      });
      if (images.isNotEmpty) {
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
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.args.comicTitle} - $title'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _loadImages,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: '刷新',
          ),
        ],
      ),
      body: _buildBody(context),
      bottomNavigationBar: _buildBottomBar(),
    );
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

  Widget _buildImageCard(ComicPageImage image) {
    final fit = _settings.imageFitMode == 'height' ? BoxFit.fitHeight : BoxFit.contain;
    final bg = _settings.backgroundColor == 'white' ? Colors.white : Colors.black;
    return Container(
      color: bg,
      alignment: Alignment.center,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: AspectRatio(
          aspectRatio: _calcAspectRatio(image),
          child: Image.network(
            image.url,
            fit: fit,
            errorBuilder: (_, __, ___) => Container(
              color: Colors.grey.shade200,
              alignment: Alignment.center,
              child: const Icon(Icons.broken_image),
            ),
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
