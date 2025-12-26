import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/storage/storage_repository.dart';
import '../../core/storage/storage_providers.dart';
import 'ebook_models.dart';
import 'ebook_providers.dart';

class EbookReaderPage extends ConsumerStatefulWidget {
  final String chapterId;

  const EbookReaderPage({
    super.key,
    required this.chapterId,
  });

  @override
  ConsumerState<EbookReaderPage> createState() => _EbookReaderPageState();
}

class _EbookReaderPageState extends ConsumerState<EbookReaderPage> {
  final ScrollController _scrollController = ScrollController();

  bool _showControls = true;
  bool _showDrawer = false;
  double _fontSize = 16.0;
  double _lineHeight = 1.5;
  double _columnWidth = 0.8;
  ReadingTheme _theme = ReadingTheme.light;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(chapterContentProvider(widget.chapterId).notifier).load();
    });
  }

  void _saveReadingProgress() {
    final historyRepo = ref.read(historyRepositoryProvider);
    if (historyRepo != null) {
      final state = ref.watch(chapterContentProvider(widget.chapterId));
      if (state.content != null) {
        historyRepo.addEbook(
          id: widget.chapterId,
          title: state.content!.title,
          chapterId: widget.chapterId,
          page: 1,
        );
      }
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
  }

  void _showSettings() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _buildSettingsSheet(),
    );
  }

  void _toggleDrawer() {
    setState(() {
      _showDrawer = !_showDrawer;
    });
  }

  void _jumpToChapter(String chapterId) {
    if (chapterId.isEmpty) {
      return;
    }
    context.push('/ebook-reader/$chapterId');
    setState(() {
      _showDrawer = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chapterContentProvider(widget.chapterId));

    return Scaffold(
      backgroundColor: _getThemeBackgroundColor(),
      body: SafeArea(
        child: Stack(
          children: [
            // 内容区域
            GestureDetector(
              onTap: _toggleControls,
              child: _buildContent(state),
            ),

            // 控制栏
            if (_showControls) ...[
              _buildTopBar(state),
              _buildBottomBar(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildContent(EbookChapterContentState state) {
    if (state.loading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    // 保存阅读进度到历史记录
    if (state.content != null && state.error == null) {
      _saveReadingProgress();
    }

    if (state.error != null && state.content == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              state.error!,
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                ref.read(chapterContentProvider(widget.chapterId).notifier).load();
              },
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (state.content == null) {
      return const Center(
        child: Text('章节内容不存在'),
      );
    }

    return Stack(
      children: [
        // 主内容
        SingleChildScrollView(
          controller: _scrollController,
          padding: EdgeInsets.symmetric(
            horizontal: MediaQuery.of(context).size.width * (1 - _columnWidth) / 2,
            vertical: 16,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * _columnWidth,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    state.content!.title,
                    style: TextStyle(
                      fontSize: _fontSize + 4,
                      fontWeight: FontWeight.bold,
                      color: _getThemeTextColor(),
                      height: _lineHeight,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    state.content!.content,
                    style: TextStyle(
                      fontSize: _fontSize,
                      color: _getThemeTextColor(),
                      height: _lineHeight,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // 目录侧边栏
        if (_showDrawer) _buildChapterDrawer(),
      ],
    );
  }

  Widget _buildChapterDrawer() {
    return GestureDetector(
      onTap: _toggleDrawer,
      child: Container(
        color: Colors.black.withOpacity(0.3),
        child: Align(
          alignment: Alignment.centerRight,
          child: GestureDetector(
            onTap: () {},
            child: Container(
              width: MediaQuery.of(context).size.width * 0.7,
              height: MediaQuery.of(context).size.height,
              color: _getThemeBackgroundColor(),
              child: SafeArea(
                child: Column(
                  children: [
                    // 标题栏
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: _getThemeTextColor().withOpacity(0.2),
                          ),
                        ),
                      ),
                      child: Row(
                        children: [
                          Text(
                            '目录',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: _getThemeTextColor(),
                            ),
                          ),
                          const Spacer(),
                          IconButton(
                            onPressed: _toggleDrawer,
                            icon: Icon(
                              Icons.close,
                              color: _getThemeTextColor(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar(EbookChapterContentState state) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            _getThemeBackgroundColor().withOpacity(0.95),
            _getThemeBackgroundColor().withOpacity(0.8),
          ],
        ),
      ),
      child: SafeArea(
        child: Row(
          children: [
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: Icon(
                Icons.arrow_back,
                color: _getThemeTextColor(),
              ),
            ),
            Expanded(
              child: Text(
                state.content?.title ?? '章节',
                style: TextStyle(
                  color: _getThemeTextColor(),
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            IconButton(
              onPressed: _showSettings,
              icon: Icon(
                Icons.settings,
                color: _getThemeTextColor(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              _getThemeBackgroundColor().withOpacity(0.95),
              _getThemeBackgroundColor().withOpacity(0.8),
            ],
          ),
        ),
        child: SafeArea(
          child: Row(
            children: [
              const Spacer(),
              IconButton(
                onPressed: _toggleDrawer,
                icon: Icon(
                  Icons.list,
                  color: _getThemeTextColor(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettingsSheet() {
    return StatefulBuilder(
      builder: (context, setModalState) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          minChildSize: 0.3,
          maxChildSize: 0.9,
          builder: (context, scrollController) => Container(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '阅读设置',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 24),

                // 字体大小
                Text(
                  '字体大小',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        if (_fontSize > 12) {
                          setState(() => _fontSize -= 2);
                          setModalState(() {});
                        }
                      },
                      icon: const Icon(Icons.remove),
                    ),
                    Expanded(
                      child: Slider(
                        value: _fontSize,
                        min: 12,
                        max: 24,
                        divisions: 6,
                        onChanged: (value) {
                          setState(() => _fontSize = value);
                          setModalState(() {});
                        },
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        if (_fontSize < 24) {
                          setState(() => _fontSize += 2);
                          setModalState(() {});
                        }
                      },
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 行距
                Text(
                  '行距',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        if (_lineHeight > 1.0) {
                          setState(() => _lineHeight -= 0.2);
                          setModalState(() {});
                        }
                      },
                      icon: const Icon(Icons.remove),
                    ),
                    Expanded(
                      child: Slider(
                        value: _lineHeight,
                        min: 1.0,
                        max: 2.0,
                        divisions: 5,
                        onChanged: (value) {
                          setState(() => _lineHeight = value);
                          setModalState(() {});
                        },
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        if (_lineHeight < 2.0) {
                          setState(() => _lineHeight += 0.2);
                          setModalState(() {});
                        }
                      },
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 列宽
                Text(
                  '列宽',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        if (_columnWidth > 0.5) {
                          setState(() => _columnWidth -= 0.1);
                          setModalState(() {});
                        }
                      },
                      icon: const Icon(Icons.remove),
                    ),
                    Expanded(
                      child: Slider(
                        value: _columnWidth,
                        min: 0.5,
                        max: 1.0,
                        divisions: 5,
                        onChanged: (value) {
                          setState(() => _columnWidth = value);
                          setModalState(() {});
                        },
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        if (_columnWidth < 1.0) {
                          setState(() => _columnWidth += 0.1);
                          setModalState(() {});
                        }
                      },
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 主题
                Text(
                  '主题',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Wrap(
                  spacing: 8,
                  children: ReadingTheme.values.map((theme) {
                    return FilterChip(
                      label: Text(_getThemeName(theme)),
                      selected: _theme == theme,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() => _theme = theme);
                          setModalState(() {});
                        }
                      },
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _getThemeName(ReadingTheme theme) {
    switch (theme) {
      case ReadingTheme.light:
        return '白天';
      case ReadingTheme.sepia:
        return '护眼';
      case ReadingTheme.dark:
        return '夜间';
      case ReadingTheme.green:
        return '绿色';
    }
  }

  Color _getThemeBackgroundColor() {
    switch (_theme) {
      case ReadingTheme.light:
        return Colors.white;
      case ReadingTheme.sepia:
        return const Color(0xFFF4ECD8);
      case ReadingTheme.dark:
        return const Color(0xFF1A1A1A);
      case ReadingTheme.green:
        return const Color(0xFFE8F5E8);
    }
  }

  Color _getThemeTextColor() {
    switch (_theme) {
      case ReadingTheme.light:
        return Colors.black87;
      case ReadingTheme.sepia:
        return const Color(0xFF5D4E37);
      case ReadingTheme.dark:
        return Colors.white70;
      case ReadingTheme.green:
        return const Color(0xFF2E7D32);
    }
  }
}

enum ReadingTheme {
  light,
  sepia,
  dark,
  green,
}
