import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  bool _loading = false;
  String? _error;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = _resolveInitialIndex();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadImages();
    });
  }

  ComicChapter? get _currentChapter {
    if (_currentIndex < 0 || _currentIndex >= widget.args.chapters.length) {
      return null;
    }
    return widget.args.chapters[_currentIndex];
  }

  bool get _hasNext => _currentIndex + 1 < widget.args.chapters.length;
  bool get _hasPrev => _currentIndex - 1 >= 0;

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
      setState(() {
        _images = data.images;
        _loading = false;
        _error = data.images.isEmpty ? '暂无图片' : null;
      });
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
    return Scrollbar(
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        itemCount: _images.length,
        itemBuilder: (context, index) {
          final image = _images[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: AspectRatio(
                aspectRatio: _calcAspectRatio(image),
                child: Image.network(
                  image.url,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    alignment: Alignment.center,
                    child: const Icon(Icons.broken_image),
                  ),
                ),
              ),
            ),
          );
        },
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
              '${_currentIndex + 1}/${widget.args.chapters.length}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
