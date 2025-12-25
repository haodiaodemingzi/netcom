import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_app/features/ebooks/data/ebooks_remote_service.dart';
import 'package:flutter_app/features/ebooks/ebooks_models.dart';

class EbookReaderPage extends ConsumerStatefulWidget {
  final String chapterId;
  final String bookId;
  final String source;
  final String bookTitle;
  final String bookCover;

  const EbookReaderPage({
    super.key,
    required this.chapterId,
    required this.bookId,
    required this.source,
    required this.bookTitle,
    required this.bookCover,
  });

  @override
  ConsumerState<EbookReaderPage> createState() => _EbookReaderPageState();
}

class _EbookReaderPageState extends ConsumerState<EbookReaderPage>
    with WidgetsBindingObserver {
  final EbooksRemoteService _remoteService = EbooksRemoteService();
  final ScrollController _scrollController = ScrollController();
  
  bool _isLoading = true;
  String? _error;
  ChapterContent? _chapterContent;
  List<EbookChapter> _chapters = [];
  int _currentChapterIndex = 0;
  bool _showControls = true;
  bool _showDrawer = false;
  double _fontSize = 16.0;
  double _lineHeight = 1.5;
  double _columnWidth = 0.8;
  ReadingTheme _theme = ReadingTheme.light;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadChapter();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _saveReadingProgress();
    }
  }

  Future<void> _loadChapter() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      // 加载章节内容
      final content = await _remoteService.fetchChapterContent(
        chapterId: widget.chapterId,
        source: widget.source,
      );

      // 加载章节列表
      final chapters = await _remoteService.fetchChapters(
        bookId: widget.bookId,
        source: widget.source,
      );

      // 找到当前章节索引
      final currentIndex = chapters.indexWhere((c) => c.id == widget.chapterId);

      setState(() {
        _chapterContent = content;
        _chapters = chapters;
        _currentChapterIndex = currentIndex >= 0 ? currentIndex : 0;
        _isLoading = false;
      });

      // 恢复阅读进度
      _restoreReadingProgress();
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _saveReadingProgress() {
    // TODO: 保存阅读进度到本地存储
  }

  void _restoreReadingProgress() {
    // TODO: 从本地存储恢复阅读进度
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

  void _showDrawer() {
    setState(() {
      _showDrawer = !_showDrawer;
    });
  }

  void _jumpToChapter(int index) {
    if (index >= 0 && index < _chapters.length) {
      final chapter = _chapters[index];
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => EbookReaderPage(
            chapterId: chapter.id,
            bookId: widget.bookId,
            source: widget.source,
            bookTitle: widget.bookTitle,
            bookCover: widget.bookCover,
          ),
        ),
      );
      setState(() {
        _showDrawer = false;
      });
    }
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

  void _previousChapter() {
    if (_currentChapterIndex > 0) {
      final previousChapter = _chapters[_currentChapterIndex - 1];
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => EbookReaderPage(
            chapterId: previousChapter.id,
            bookId: widget.bookId,
            source: widget.source,
            bookTitle: widget.bookTitle,
            bookCover: widget.bookCover,
          ),
        ),
      );
    }
  }

  void _nextChapter() {
    if (_currentChapterIndex < _chapters.length - 1) {
      final nextChapter = _chapters[_currentChapterIndex + 1];
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => EbookReaderPage(
            chapterId: nextChapter.id,
            bookId: widget.bookId,
            source: widget.source,
            bookTitle: widget.bookTitle,
            bookCover: widget.bookCover,
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _getThemeBackgroundColor(),
      body: SafeArea(
        child: Stack(
          children: [
            // 内容区域
            GestureDetector(
              onTap: _toggleControls,
              child: _buildContent(),
            ),
            
            // 控制栏
            if (_showControls) ...[
              _buildTopBar(),
              _buildBottomBar(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_error != null) {
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
              _error!,
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadChapter,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_chapterContent == null) {
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
                    _chapterContent!.title,
                    style: TextStyle(
                      fontSize: _fontSize + 4,
                      fontWeight: FontWeight.bold,
                      color: _getThemeTextColor(),
                      height: _lineHeight,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _chapterContent!.content,
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
      onTap: _showDrawer,
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
                            onPressed: _showDrawer,
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
                      child: ListView.builder(
                        itemCount: _chapters.length,
                        itemBuilder: (context, index) {
                          final chapter = _chapters[index];
                          final isCurrent = index == _currentChapterIndex;
                          return ListTile(
                            title: Text(
                              chapter.title,
                              style: TextStyle(
                                color: _getThemeTextColor(),
                                fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                            subtitle: Text(
                              '第${chapter.index + 1}章',
                              style: TextStyle(
                                color: _getThemeTextColor().withOpacity(0.6),
                                fontSize: 12,
                              ),
                            ),
                            selected: isCurrent,
                            onTap: () => _jumpToChapter(index),
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

  Widget _buildTopBar() {
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
                _chapterContent?.title ?? '章节',
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
          child: Column(
            children: [
              // 进度条
              LinearProgressIndicator(
                value: _chapters.isEmpty ? 0 : (_currentChapterIndex + 1) / _chapters.length,
                backgroundColor: _getThemeTextColor().withOpacity(0.2),
                valueColor: AlwaysStoppedAnimation<Color>(_getThemeTextColor()),
              ),
              const SizedBox(height: 8),
              
              // 章节导航
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  IconButton(
                    onPressed: _currentChapterIndex > 0 ? _previousChapter : null,
                    icon: Icon(
                      Icons.skip_previous,
                      color: _getThemeTextColor(),
                    ),
                  ),
                  Text(
                    '${_currentChapterIndex + 1}/${_chapters.length}',
                    style: TextStyle(
                      color: _getThemeTextColor(),
                      fontSize: 14,
                    ),
                  ),
                  IconButton(
                    onPressed: _currentChapterIndex < _chapters.length - 1 ? _nextChapter : null,
                    icon: Icon(
                      Icons.skip_next,
                      color: _getThemeTextColor(),
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
}

enum ReadingTheme {
  light,
  sepia,
  dark,
  green,
}
