import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

class EbookOfflineReaderPage extends StatefulWidget {
  final String bookId;
  final String bookTitle;

  const EbookOfflineReaderPage({
    super.key,
    required this.bookId,
    required this.bookTitle,
  });

  @override
  State<EbookOfflineReaderPage> createState() => _EbookOfflineReaderPageState();
}

class _EbookOfflineReaderPageState extends State<EbookOfflineReaderPage>
    with WidgetsBindingObserver {
  final ScrollController _scrollController = ScrollController();
  
  bool _isLoading = true;
  String? _error;
  String _bookContent = '';
  List<ChapterItem> _chapters = [];
  int _currentChapterIndex = 0;
  bool _showControls = true;
  bool _showSidebar = false;
  double _fontSize = 16.0;
  double _lineHeight = 1.5;
  ReadingTheme _theme = ReadingTheme.light;
  int _currentPage = 1;
  int _totalPages = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadOfflineBook();
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

  Future<void> _loadOfflineBook() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final directory = await getApplicationDocumentsDirectory();
      final file = File('${directory.path}/ebooks/${widget.bookId}.txt');

      if (!await file.exists()) {
        throw Exception('离线文件不存在');
      }

      final content = await file.readAsString();
      final chapters = _parseChapters(content);

      setState(() {
        _bookContent = content;
        _chapters = chapters;
        _isLoading = false;
        _totalPages = chapters.length;
      });

      _restoreReadingProgress();
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<ChapterItem> _parseChapters(String content) {
    final chapters = <ChapterItem>[];
    final lines = content.split('\n');
    
    String currentChapter = '';
    String currentTitle = '正文';
    int chapterIndex = 0;
    
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i].trim();
      
      // 检测章节标题
      if (_isChapterTitle(line)) {
        // 保存上一章
        if (currentChapter.isNotEmpty) {
          chapters.add(ChapterItem(
            title: currentTitle,
            content: currentChapter.trim(),
            index: chapterIndex++,
          ));
        }
        
        currentTitle = line;
        currentChapter = '';
      } else {
        currentChapter += line + '\n';
      }
    }
    
    // 保存最后一章
    if (currentChapter.isNotEmpty) {
      chapters.add(ChapterItem(
        title: currentTitle,
        content: currentChapter.trim(),
        index: chapterIndex,
      ));
    }
    
    return chapters.isEmpty ? [ChapterItem(title: '正文', content: content, index: 0)] : chapters;
  }

  bool _isChapterTitle(String line) {
    final patterns = [
      RegExp(r'^第[一二三四五六七八九十百千万\d]+章'),
      RegExp(r'^第[一二三四五六七八九十百千万\d]+节'),
      RegExp(r'^Chapter\s*\d+', caseSensitive: false),
      RegExp(r'^\d+\.'),
      RegExp(r'^\d+、'),
    ];
    
    return patterns.any((pattern) => pattern.hasMatch(line));
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

  void _toggleSidebar() {
    setState(() {
      _showSidebar = !_showSidebar;
    });
  }

  void _showSettings() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _buildSettingsSheet(),
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

  void _jumpToChapter(int index) {
    setState(() {
      _currentChapterIndex = index;
      _currentPage = index + 1;
      _showSidebar = false;
    });
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  void _previousChapter() {
    if (_currentChapterIndex > 0) {
      _jumpToChapter(_currentChapterIndex - 1);
    }
  }

  void _nextChapter() {
    if (_currentChapterIndex < _chapters.length - 1) {
      _jumpToChapter(_currentChapterIndex + 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _getThemeBackgroundColor(),
      body: SafeArea(
        child: Stack(
          children: [
            // 主内容区域
            GestureDetector(
              onTap: _toggleControls,
              child: _buildContent(),
            ),
            
            // 侧边栏
            if (_showSidebar) _buildSidebar(),
            
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
              onPressed: _loadOfflineBook,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_chapters.isEmpty) {
      return Center(
        child: Text(
          '无章节内容',
          style: TextStyle(
            color: _getThemeTextColor(),
          ),
        ),
      );
    }

    final currentChapter = _chapters[_currentChapterIndex];

    return SingleChildScrollView(
      controller: _scrollController,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            currentChapter.title,
            style: TextStyle(
              fontSize: _fontSize + 4,
              fontWeight: FontWeight.bold,
              color: _getThemeTextColor(),
              height: _lineHeight,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            currentChapter.content,
            style: TextStyle(
              fontSize: _fontSize,
              color: _getThemeTextColor(),
              height: _lineHeight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    return Positioned(
      top: 0,
      left: 0,
      bottom: 0,
      width: MediaQuery.of(context).size.width * 0.7,
      child: Container(
        decoration: BoxDecoration(
          color: _getThemeBackgroundColor(),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 10,
              offset: const Offset(2, 0),
            ),
          ],
        ),
        child: Column(
          children: [
            // 侧边栏头部
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
                  IconButton(
                    onPressed: _toggleSidebar,
                    icon: Icon(
                      Icons.close,
                      color: _getThemeTextColor(),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      '目录',
                      style: TextStyle(
                        color: _getThemeTextColor(),
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(width: 48), // 平衡布局
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
                        color: isCurrent
                            ? Theme.of(context).colorScheme.primary
                            : _getThemeTextColor(),
                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                    subtitle: Text(
                      '第${index + 1}章',
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
                widget.bookTitle,
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
              onPressed: _toggleSidebar,
              icon: Icon(
                Icons.menu,
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
                    '$_currentPage/$_totalPages',
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

class ChapterItem {
  final String title;
  final String content;
  final int index;

  ChapterItem({
    required this.title,
    required this.content,
    required this.index,
  });
}

enum ReadingTheme {
  light,
  sepia,
  dark,
  green,
}
