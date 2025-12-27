import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/storage/storage_repository.dart';
import '../../core/storage/storage_providers.dart';
import '../downloads/ebook_chapter_downloader.dart';
import 'ebook_models.dart';
import 'ebook_providers.dart';
import 'ebook_page_calculator.dart';

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
  final PageController _pageController = PageController();

  bool _showControls = true;
  bool _showDrawer = false;
  double _fontSize = 16.0;
  double _lineHeight = 1.5;
  double _columnWidth = 0.8;
  ReadingTheme _theme = ReadingTheme.light;
  List<EbookChapter> _chapters = [];
  int _currentChapterIndex = 0;
  bool _swipeToTurnPages = true;
  List<String> _pages = [];
  int _currentPage = 0; // 左右滑动翻页开关

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(chapterContentProvider(widget.chapterId).notifier).load();
      _loadChapters();
    });
  }

  Future<void> _loadChapters() async {
    // 从章节ID中提取书籍ID
    final bookId = _extractBookIdFromChapterId(widget.chapterId);
    if (bookId.isEmpty) {
      return;
    }
    try {
      final remote = ref.read(ebookRemoteServiceProvider);
      final ebookListState = ref.read(ebookListProvider);
      final currentSource = ebookListState.selectedSource;
      final detailData = await remote.fetchBookDetail(bookId: bookId, sourceId: currentSource);
      if (mounted) {
        setState(() {
          _chapters = detailData.chapters;
          // 找到当前章节的索引
          for (int i = 0; i < _chapters.length; i++) {
            if (_chapters[i].id == widget.chapterId) {
              _currentChapterIndex = i;
              break;
            }
          }
        });
        // 预下载当前章节及后续4章
        _preloadChapters(detailData.detail);
      }
    } catch (e) {
      debugPrint('加载章节列表失败: $e');
    }
  }

  Future<void> _preloadChapters(EbookDetail? detail) async {
    if (detail == null || _chapters.isEmpty) {
      return;
    }
    // 预下载当前章节及后续4章（共5章）
    final startIndex = _currentChapterIndex;
    final endIndex = (startIndex + 4).clamp(0, _chapters.length - 1);
    
    for (int i = startIndex; i <= endIndex; i++) {
      final chapter = _chapters[i];
      try {
        final downloader = ref.read(ebookChapterDownloaderProvider);
        await downloader.downloadChapter(
          detail: detail,
          chapter: chapter,
        );
        debugPrint('预下载完成: ${chapter.title}');
      } catch (e) {
        debugPrint('预下载失败: ${chapter.title}, error=$e');
      }
    }
  }

  String _extractBookIdFromChapterId(String chapterId) {
    // 章节ID格式为 {bookId}_{序号}，如 wanxiangzhiwang-tiancantudou_1
    // 需要从最后一个下划线处分割，提取书籍ID
    final lastUnderscoreIndex = chapterId.lastIndexOf('_');
    if (lastUnderscoreIndex > 0) {
      return chapterId.substring(0, lastUnderscoreIndex);
    }
    return chapterId;
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
          page: _currentPage + 1,
        );
      }
    }
  }

  void _calculatePages(String content, Size screenSize) {
    if (content.isEmpty) {
      setState(() {
        _pages = [];
      });
      return;
    }

    final padding = EdgeInsets.symmetric(
      horizontal: screenSize.width * (1 - _columnWidth) / 2 + 16,
      vertical: 80,
    );

    final pages = EbookPageCalculator.calculatePages(
      content: content,
      fontSize: _fontSize,
      lineHeight: _lineHeight,
      pageWidth: screenSize.width,
      pageHeight: screenSize.height,
      padding: padding,
    );

    setState(() {
      _pages = pages;
      if (_currentPage >= pages.length) {
        _currentPage = pages.length - 1;
      }
      if (_currentPage < 0) {
        _currentPage = 0;
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pageController.hasClients && _currentPage < pages.length) {
        _pageController.jumpToPage(_currentPage);
      }
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
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

  void _previousChapter() {
    if (_currentChapterIndex > 0) {
      final prevChapter = _chapters[_currentChapterIndex - 1];
      _jumpToChapter(prevChapter.id);
    }
  }

  void _nextChapter() {
    if (_currentChapterIndex < _chapters.length - 1) {
      final nextChapter = _chapters[_currentChapterIndex + 1];
      _jumpToChapter(nextChapter.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chapterContentProvider(widget.chapterId));

    return Scaffold(
      backgroundColor: _getThemeBackgroundColor(),
      body: SafeArea(
        child: Stack(
          children: [
            _buildContent(state),

            // 控制栏
            if (_showControls) ...[
              _buildTopBar(state),
              _buildBottomBar(state),
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

    if (state.content != null && state.error == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          final screenSize = MediaQuery.of(context).size;
          _calculatePages(state.content!.content, screenSize);
          _saveReadingProgress();
        }
      });
    }

    return Stack(
      children: [
        if (_swipeToTurnPages)
          _buildPageView(state)
        else
          _buildScrollView(state),
        if (_showDrawer) _buildChapterDrawer(),
      ],
    );
  }

  Widget _buildPageView(EbookChapterContentState state) {
    if (_pages.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    return GestureDetector(
      onTap: _toggleControls,
      child: PageView.builder(
        controller: _pageController,
        onPageChanged: (index) {
          setState(() {
            _currentPage = index;
          });
          _saveReadingProgress();
        },
        itemCount: _pages.length,
        itemBuilder: (context, index) {
          return Container(
            padding: EdgeInsets.symmetric(
              horizontal: MediaQuery.of(context).size.width * (1 - _columnWidth) / 2 + 16,
              vertical: 80,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * _columnWidth,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (index == 0) ...[
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
                    ],
                    Expanded(
                      child: SingleChildScrollView(
                        child: Text(
                          _pages[index],
                          style: TextStyle(
                            fontSize: _fontSize,
                            color: _getThemeTextColor(),
                            height: _lineHeight,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildScrollView(EbookChapterContentState state) {
    return GestureDetector(
      onTap: _toggleControls,
      child: SingleChildScrollView(
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
                    // 章节列表
                    Expanded(
                      child: _chapters.isEmpty
                          ? Center(
                              child: Text(
                                '暂无章节',
                                style: TextStyle(
                                  color: _getThemeTextColor().withOpacity(0.6),
                                ),
                              ),
                            )
                          : ListView.builder(
                              itemCount: _chapters.length,
                              itemBuilder: (context, index) {
                                final chapter = _chapters[index];
                                final isCurrent = index == _currentChapterIndex;
                                return ListTile(
                                  title: Text(
                                    chapter.title,
                                    style: TextStyle(
                                      color: isCurrent
                                            ? Theme.of(context).colorScheme.primary
                                            : _getThemeTextColor(),
                                      fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                    ),
                                  ),
                                  subtitle: Text(
                                    '第${chapter.order}章',
                                    style: TextStyle(
                                      color: _getThemeTextColor().withOpacity(0.6),
                                      fontSize: 12,
                                    ),
                                  ),
                                  selected: isCurrent,
                                  onTap: () => _jumpToChapter(chapter.id),
                                );
                              },
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

  Widget _buildBottomBar(EbookChapterContentState state) {
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_swipeToTurnPages && _pages.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      Text(
                        '${_currentPage + 1}/${_pages.length}',
                        style: TextStyle(
                          color: _getThemeTextColor(),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: SliderTheme(
                          data: SliderThemeData(
                            trackHeight: 2,
                            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                            overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                          ),
                          child: Slider(
                            value: _currentPage.toDouble(),
                            min: 0,
                            max: (_pages.length - 1).toDouble(),
                            onChanged: (value) {
                              final page = value.round();
                              if (page != _currentPage) {
                                _pageController.jumpToPage(page);
                                setState(() {
                                  _currentPage = page;
                                });
                              }
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              Row(
                children: [
                  IconButton(
                    onPressed: _currentChapterIndex > 0 ? _previousChapter : null,
                    icon: Icon(
                      Icons.skip_previous,
                      color: _currentChapterIndex > 0
                          ? _getThemeTextColor()
                          : _getThemeTextColor().withOpacity(0.3),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: _toggleDrawer,
                    icon: Icon(
                      Icons.list,
                      color: _getThemeTextColor(),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: _currentChapterIndex < _chapters.length - 1 ? _nextChapter : null,
                    icon: Icon(
                      Icons.skip_next,
                      color: _currentChapterIndex < _chapters.length - 1
                          ? _getThemeTextColor()
                          : _getThemeTextColor().withOpacity(0.3),
                    ),
                  ),
                ],
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

                Text(
                  '字体大小',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        if (_fontSize > 12) {
                          setState(() {
                            _fontSize -= 2;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
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
                          setState(() {
                            _fontSize = value;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
                          setModalState(() {});
                        },
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        if (_fontSize < 24) {
                          setState(() {
                            _fontSize += 2;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
                          setModalState(() {});
                        }
                      },
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                Text(
                  '行距',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        if (_lineHeight > 1.0) {
                          setState(() {
                            _lineHeight -= 0.2;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
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
                          setState(() {
                            _lineHeight = value;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
                          setModalState(() {});
                        },
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        if (_lineHeight < 2.0) {
                          setState(() {
                            _lineHeight += 0.2;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
                          setModalState(() {});
                        }
                      },
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                Text(
                  '列宽',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        if (_columnWidth > 0.5) {
                          setState(() {
                            _columnWidth -= 0.1;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
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
                          setState(() {
                            _columnWidth = value;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
                          setModalState(() {});
                        },
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        if (_columnWidth < 1.0) {
                          setState(() {
                            _columnWidth += 0.1;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
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
                const SizedBox(height: 24),

                Text(
                  '翻页模式',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    FilterChip(
                      label: const Text('上下滑动'),
                      selected: !_swipeToTurnPages,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() => _swipeToTurnPages = false);
                          setModalState(() {});
                        }
                      },
                    ),
                    FilterChip(
                      label: const Text('左右翻页'),
                      selected: _swipeToTurnPages,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() {
                            _swipeToTurnPages = true;
                            final state = ref.read(chapterContentProvider(widget.chapterId));
                            if (state.content != null) {
                              _calculatePages(state.content!.content, MediaQuery.of(context).size);
                            }
                          });
                          setModalState(() {});
                        }
                      },
                    ),
                  ],
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
