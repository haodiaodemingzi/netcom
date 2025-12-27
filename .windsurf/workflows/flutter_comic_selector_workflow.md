# Flutter 漫画详情页选择器 UI 优化实施工作流

## 概述
本工作流旨在根据 `plans/flutter_comic_selector_plan.md` 中的设计方案，对 Flutter 漫画详情页进行代码优化。主要目标是实现一个三层选择器，并增强批量选择功能。

## 前置条件
- 已阅读并理解 `plans/flutter_comic_selector_plan.md` 中的设计方案。
- 开发环境已配置好 Flutter 项目。

## 任务清单
- [ ] 步骤 1: 修改 `flutter_app/lib/features/comics/comics_models.dart` - 添加新数据模型
- [ ] 步骤 2: 修改 `flutter_app/lib/features/comics/comic_detail_provider.dart` - 更新状态管理
- [ ] 步骤 3: 修改 `flutter_app/lib/features/comics/comic_detail_page.dart` - 实现UI组件
- [ ] 步骤 4: 验证功能并测试

## 实施步骤

### 步骤 1: 修改 `flutter_app/lib/features/comics/comics_models.dart`
**目标**: 添加新的数据模型和枚举，以支持新的选择器逻辑。

**操作**:
1.  在文件顶部添加 `ChapterDisplayType` 枚举。
2.  在文件末尾添加 `ComicVolume` 类。

**代码变更**:

```dart
// 在文件顶部添加
import '../../core/network/image_proxy.dart';

/// 章节显示类型枚举
enum ChapterDisplayType {
  /// 全部章节
  all,
  /// 按卷显示
  volume,
  /// 按章显示
  chapter,
}
```

```dart
// 在文件末尾添加
/// 漫画卷模型
class ComicVolume {
  const ComicVolume({
    required this.id,
    required this.title,
    required this.chapters,
  });

  /// 卷的唯一标识符，例如 "volume-1"
  final String id;
  /// 卷的标题，例如 "第一卷"
  final String title;
  /// 该卷包含的章节列表
  final List<ComicChapter> chapters;
}
```

### 步骤 2: 修改 `flutter_app/lib/features/comics/comic_detail_provider.dart`
**目标**: 扩展状态管理，添加新的字段和逻辑方法，以支持新的UI交互。

**操作**:
1.  修改 `ComicDetailState` 类，添加新的状态字段。
2.  修改 `ComicDetailNotifier` 类，添加新的逻辑方法。

**代码变更**:

```dart
// 1. 修改 ComicDetailState 类
class ComicDetailState {
  const ComicDetailState({
    this.detail,
    this.chapters = const <ComicChapter>[],
    this.loading = false,
    this.error,
    this.descending = true,
    this.selectedChapterIds = const <String>{},
    this.selectionMode = false,
    this.isFavorite = false,
    this.segments = const <ChapterSegment>[],
    this.currentSegmentIndex = 0,
    this.segmentSize = 50,
    // --- 新增字段开始 ---
    this.chapterDisplayType = ChapterDisplayType.all,
    this.segmentMap = const <ChapterDisplayType, List<ChapterSegment>>{},
    this.currentSegment,
    this.sortOrderMap = const <String, bool>{},
    this.allChapters = const <ComicChapter>[],
    this.allVolumes = const <ComicVolume>[],
    // --- 新增字段结束 ---
  });

  final ComicDetail? detail;
  final List<ComicChapter> chapters;
  final bool loading;
  final String? error;
  final bool descending; // 保留用于向后兼容，但主要使用 sortOrderMap
  final Set<String> selectedChapterIds;
  final bool selectionMode;
  final bool isFavorite;
  final List<ChapterSegment> segments; // 保留用于向后兼容
  final int currentSegmentIndex; // 保留用于向后兼容
  final int segmentSize;

  // --- 新增字段开始 ---
  final ChapterDisplayType chapterDisplayType;
  final Map<ChapterDisplayType, List<ChapterSegment>> segmentMap;
  final ChapterSegment? currentSegment;
  final Map<String, bool> sortOrderMap; // true for descending
  final List<ComicChapter> allChapters;
  final List<ComicVolume> allVolumes;
  // --- 新增字段结束 ---

  ComicDetailState copyWith({
    ComicDetail? detail,
    List<ComicChapter>? chapters,
    bool? loading,
    String? error,
    bool? descending,
    Set<String>? selectedChapterIds,
    bool? selectionMode,
    bool? isFavorite,
    List<ChapterSegment>? segments,
    int? currentSegmentIndex,
    int? segmentSize,
    // --- 新增字段开始 ---
    ChapterDisplayType? chapterDisplayType,
    Map<ChapterDisplayType, List<ChapterSegment>>? segmentMap,
    ChapterSegment? currentSegment,
    Map<String, bool>? sortOrderMap,
    List<ComicChapter>? allChapters,
    List<ComicVolume>? allVolumes,
    // --- 新增字段结束 ---
  }) {
    return ComicDetailState(
      detail: detail ?? this.detail,
      chapters: chapters ?? this.chapters,
      loading: loading ?? this.loading,
      error: error,
      descending: descending ?? this.descending,
      selectedChapterIds: selectedChapterIds != null
          ? Set<String>.unmodifiable(selectedChapterIds)
          : this.selectedChapterIds,
      selectionMode: selectionMode ?? this.selectionMode,
      isFavorite: isFavorite ?? this.isFavorite,
      segments: segments ?? this.segments,
      currentSegmentIndex: currentSegmentIndex ?? this.currentSegmentIndex,
      segmentSize: segmentSize ?? this.segmentSize,
      // --- 新增字段开始 ---
      chapterDisplayType: chapterDisplayType ?? this.chapterDisplayType,
      segmentMap: segmentMap ?? this.segmentMap,
      currentSegment: currentSegment ?? this.currentSegment,
      sortOrderMap: sortOrderMap ?? this.sortOrderMap,
      allChapters: allChapters ?? this.allChapters,
      allVolumes: allVolumes ?? this.allVolumes,
      // --- 新增字段结束 ---
    );
  }
}
```

```dart
// 2. 修改 ComicDetailNotifier 类
class ComicDetailNotifier extends StateNotifier<ComicDetailState> {
  // ... 现有构造函数和字段 ...

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final sourceId = _request.sourceId?.isNotEmpty == true ? _request.sourceId : _sourceRepository?.currentSource();
      final data = await _remoteService.fetchDetail(comicId: _request.id, sourceId: sourceId);

      // --- 新逻辑开始 ---
      // 1. 解析卷和章节
      final volumes = _parseVolumesFromChapters(data.chapters);
      final chaptersOnly = _extractChaptersOnly(data.chapters);

      // 2. 构建不同类型的分段
      final segmentMap = {
        ChapterDisplayType.all: _buildSegmentsFor(data.chapters),
        ChapterDisplayType.volume: _buildSegmentsForVolumes(volumes),
        ChapterDisplayType.chapter: _buildSegmentsFor(chaptersOnly),
      };

      // 3. 设置初始状态
      final initialSegment = segmentMap[ChapterDisplayType.all]?.first;
      final initialSortOrder = state.descending; // 使用现有的 descending 作为默认值
      final initialSortKey = _getCurrentViewKey(ChapterDisplayType.all, initialSegment);
      final initialSortMap = {initialSortKey: initialSortOrder};
      // --- 新逻辑结束 ---

      final sorted = _sortChapters(data.chapters, descending: state.descending);
      final segments = _buildSegments(sorted, size: state.segmentSize);
      final defaultSegmentIndex = _pickDefaultSegmentIndex(segments, descending: state.descending);
      final isFavorite = _favoritesRepository?.isFavorite(_request.id) ?? false;

      state = state.copyWith(
        detail: data.detail,
        chapters: sorted,
        loading: false,
        error: null,
        isFavorite: isFavorite,
        selectedChapterIds: const <String>{},
        selectionMode: false,
        segments: segments, // 保留旧字段
        currentSegmentIndex: defaultSegmentIndex, // 保留旧字段
        // --- 新字段开始 ---
        allChapters: data.chapters,
        allVolumes: volumes,
        segmentMap: segmentMap,
        chapterDisplayType: ChapterDisplayType.all,
        currentSegment: initialSegment,
        sortOrderMap: initialSortMap,
        // --- 新字段结束 ---
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: '加载失败 ${e.toString()}');
    }
  }

  // --- 新方法开始 ---

  /// 当用户切换第一层 Tab (全部/卷/章)
  void setChapterDisplayType(ChapterDisplayType type) {
    final segments = state.segmentMap[type] ?? [];
    final newSegment = segments.isNotEmpty ? segments.first : null;
    state = state.copyWith(
      chapterDisplayType: type,
      currentSegment: newSegment,
      selectedChapterIds: const <String>{},
      selectionMode: false,
    );
  }

  /// 当用户选择第二层区域 (e.g., "1-50")
  void setSegment(ChapterSegment segment) {
    state = state.copyWith(
      currentSegment: segment,
      selectedChapterIds: const <String>{},
      selectionMode: false,
    );
  }

  /// 当用户切换第三层排序
  void toggleSortOrder() {
    final key = _getCurrentViewKey();
    final currentOrder = state.sortOrderMap[key] ?? true;
    final newSortOrderMap = Map<String, bool>.from(state.sortOrderMap);
    newSortOrderMap[key] = !currentOrder;
    state = state.copyWith(sortOrderMap: newSortOrderMap);
  }

  /// 获取当前可见的章节列表 (核心逻辑)
  List<ComicChapter> getVisibleChapters() {
    // 1. 根据 chapterDisplayType 获取基础列表
    List<ComicChapter> baseList;
    if (state.chapterDisplayType == ChapterDisplayType.volume) {
      baseList = _getChaptersFromVolumesInSegment(state.currentSegment);
    } else {
      baseList = _getChaptersInSegment(state.chapterDisplayType, state.currentSegment);
    }

    // 2. 根据 sortOrderMap 获取当前视图的排序方式
    final key = _getCurrentViewKey();
    final descending = state.sortOrderMap[key] ?? true;

    // 3. 排序
    return _sortChapters(baseList, descending: descending);
  }

  /// 生成一个代表当前视图的唯一键
  String _getCurrentViewKey([ChapterDisplayType? type, ChapterSegment? segment]) {
    final displayType = type ?? state.chapterDisplayType;
    final seg = segment ?? state.currentSegment;
    return "${displayType.name}-${seg?.label() ?? 'all'}";
  }

  /// 从章节列表中解析出卷
  List<ComicVolume> _parseVolumesFromChapters(List<ComicChapter> allChapters) {
    final Map<String, List<ComicChapter>> volumeMap = {};
    for (final chapter in allChapters) {
      final volMatch = RegExp(r'(第\d+卷|Vol\.\d+)', caseSensitive: false).firstMatch(chapter.title);
      if (volMatch != null) {
        final volumeTitle = volMatch.group(0)!;
        volumeMap.putIfAbsent(volumeTitle, () => []).add(chapter);
      }
    }

    return volumeMap.entries.map((entry) {
      return ComicVolume(id: entry.key, title: entry.key, chapters: entry.value);
    }).toList();
  }

  /// 从章节列表中提取出纯章节（不含卷标）
  List<ComicChapter> _extractChaptersOnly(List<ComicChapter> allChapters) {
    return allChapters.where((chapter) {
      final volMatch = RegExp(r'(第\d+卷|Vol\.\d+)', caseSensitive: false).firstMatch(chapter.title);
      return volMatch == null;
    }).toList();
  }

  /// 为卷列表构建分段
  List<ChapterSegment> _buildSegmentsForVolumes(List<ComicVolume> volumes) {
    if (volumes.isEmpty) return const <ChapterSegment>[];
    const size = 10; // 每个分段包含10卷
    final List<ChapterSegment> result = <ChapterSegment>[];
    for (var i = 0; i < volumes.length; i += size) {
      final end = (i + size - 1).clamp(0, volumes.length - 1);
      result.add(ChapterSegment(start: i + 1, end: end + 1));
    }
    return result;
  }

  /// 为章节列表构建分段
  List<ChapterSegment> _buildSegmentsFor(List<ComicChapter> chapters) {
    if (chapters.isEmpty) return const <ChapterSegment>[];
    const size = 50;
    final List<ChapterSegment> result = <ChapterSegment>[];
    for (var i = 0; i < chapters.length; i += size) {
      final end = (i + size - 1).clamp(0, chapters.length - 1);
      result.add(ChapterSegment(start: i + 1, end: end + 1));
    }
    return result;
  }

  /// 从卷中获取当前分段内的章节
  List<ComicChapter> _getChaptersFromVolumesInSegment(ChapterSegment? segment) {
    if (segment == null || state.allVolumes.isEmpty) return const <ComicChapter>[];
    // segment.start 和 end 是卷的索引（从1开始）
    final startIndex = segment.start - 1;
    final endIndex = segment.end - 1;
    final volumesInSegment = state.allVolumes.sublist(
      startIndex.clamp(0, state.allVolumes.length),
      (endIndex + 1).clamp(0, state.allVolumes.length),
    );
    return volumesInSegment.expand((volume) => volume.chapters).toList();
  }

  /// 从章节列表中获取当前分段内的章节
  List<ComicChapter> _getChaptersInSegment(ChapterDisplayType type, ChapterSegment? segment) {
    final baseList = type == ChapterDisplayType.all ? state.allChapters : _extractChaptersOnly(state.allChapters);
    if (segment == null || baseList.isEmpty) return baseList;
    // segment.start 和 end 是章节的索引（从1开始）
    final startIndex = segment.start - 1;
    final endIndex = segment.end - 1;
    return baseList.sublist(
      startIndex.clamp(0, baseList.length),
      (endIndex + 1).clamp(0, baseList.length),
    );
  }

  // --- 新方法结束 ---

  // ... 保留现有方法 ...
}
```

### 步骤 3: 修改 `flutter_app/lib/features/comics/comic_detail_page.dart`
**目标**: 实现新的选择器UI和批量操作UI。

**操作**:
1.  在 `_buildDetailContent` 方法中，用新的选择器面板替换旧的 `_buildActionBar` 和 `segments` 选择器。
2.  创建 `_buildNewSelectorPanel` 方法来构建新的选择器UI。
3.  创建 `_buildBatchActionsBar` 方法来构建批量操作栏。
4.  在 `Scaffold` 中添加 `bottomNavigationBar`，用于显示批量操作栏。
5.  更新 `_buildChapterList` 方法，使用 `notifier.getVisibleChapters()` 来获取可见章节。

**代码变更**:

```dart
// 1. 修改 _buildDetailContent 方法
Widget _buildDetailContent(
  BuildContext context,
  WidgetRef ref,
  ComicDetailState state,
  ComicDetailNotifier notifier,
  ComicDetail detail,
) {
  final downloadNotifier = ref.read(downloadCenterProvider.notifier);
  final colorScheme = Theme.of(context).colorScheme;

  return Scaffold(
    appBar: AppBar(
      title: Text(detail.title),
      actions: [
        IconButton(
          icon: Icon(state.isFavorite ? Icons.favorite : Icons.favorite_border),
          onPressed: notifier.toggleFavorite,
        ),
      ],
    ),
    // --- 新增 bottomNavigationBar 开始 ---
    bottomNavigationBar: state.selectionMode
        ? _buildBatchActionsBar(context, state, notifier, downloadNotifier)
        : null,
    // --- 新增 bottomNavigationBar 结束 ---
    body: CustomScrollView(
      slivers: [
        // ... 现有的 SliverToBoxAdapter (封面、简介) ...
        SliverToBoxAdapter(
          child: _buildNewSelectorPanel(context, state, notifier), // 替换旧的 _buildActionBar
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              '章节列表 (${notifier.getVisibleChapters().length})',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ),
        ),
        // --- 移除旧的 segments 选择器 ---
        // if (state.segments.isNotEmpty) ... { ... }
        _buildChapterList(context, state, notifier, downloadNotifier),
      ],
    ),
  );
}
```

```dart
// 2. 创建 _buildNewSelectorPanel 方法
Widget _buildNewSelectorPanel(
  BuildContext context,
  ComicDetailState state,
  ComicDetailNotifier notifier,
) {
  return Card(
    margin: const EdgeInsets.all(12),
    child: Padding(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        children: [
          // 第一层: 类型选择
          ToggleButtons(
            isSelected: [
              state.chapterDisplayType == ChapterDisplayType.all,
              state.chapterDisplayType == ChapterDisplayType.volume,
              state.chapterDisplayType == ChapterDisplayType.chapter,
            ],
            onPressed: (index) {
              notifier.setChapterDisplayType(ChapterDisplayType.values[index]);
            },
            children: const [Text('全部'), Text('卷'), Text('章节')],
          ),
          const SizedBox(height: 12),

          // 第二层和第三层
          Row(
            children: [
              // 第二层: 区域选择
              Expanded(
                child: DropdownButton<ChapterSegment>(
                  value: state.currentSegment,
                  isExpanded: true,
                  hint: Text('选择区域'),
                  items: (state.segmentMap[state.chapterDisplayType] ?? []).map((segment) {
                    return DropdownMenuItem(
                      value: segment,
                      child: Text(segment.label()),
                    );
                  }).toList(),
                  onChanged: (segment) {
                    if (segment != null) {
                      notifier.setSegment(segment);
                    }
                  },
                ),
              ),
              const SizedBox(width: 16),

              // 第三层: 排序
              final key = notifier._getCurrentViewKey();
              final descending = state.sortOrderMap[key] ?? true;
              TextButton.icon(
                onPressed: notifier.toggleSortOrder,
                icon: Icon(descending ? Icons.arrow_downward : Icons.arrow_upward),
                label: Text(descending ? '倒序' : '正序'),
              ),

              // 第三层: 批量选择
              IconButton(
                icon: Icon(state.selectionMode ? Icons.close : Icons.select_all),
                onPressed: notifier.toggleSelectionMode,
              ),
            ],
          ),

          // 批量选择模式下的额外按钮
          if (state.selectionMode)
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: notifier.selectAllVisibleChapters, child: Text('全选当前')),
                TextButton(onPressed: notifier.clearSelection, child: Text('清空选择')),
              ],
            )
        ],
      ),
    ),
  );
}
```

```dart
// 3. 创建 _buildBatchActionsBar 方法
Widget _buildBatchActionsBar(
  BuildContext context,
  ComicDetailState state,
  ComicDetailNotifier notifier,
  DownloadCenterNotifier downloadNotifier,
) {
  final selectedCount = state.selectedChapterIds.length;
  return Container(
    padding: const EdgeInsets.all(8),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      border: Border(
        top: BorderSide(color: Theme.of(context).dividerColor),
      ),
    ),
    child: Row(
      children: [
        Text('已选 $selectedCount 项'),
        const Spacer(),
        if (selectedCount > 0) ...[
          IconButton(
            icon: const Icon(Icons.download),
            onPressed: () => _handleDownloadSelected(context, state, notifier, downloadNotifier),
            tooltip: '下载',
          ),
          IconButton(
            icon: const Icon(Icons.pause),
            onPressed: () {
              // TODO: 实现暂停选中项的逻辑
            },
            tooltip: '暂停',
          ),
          IconButton(
            icon: const Icon(Icons.play_arrow),
            onPressed: () {
              // TODO: 实现继续选中项的逻辑
            },
            tooltip: '继续',
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () {
              // TODO: 实现删除选中项的逻辑
            },
            tooltip: '删除',
          ),
        ],
      ],
    ),
  );
}
```

```dart
// 4. 更新 _buildChapterList 方法
Widget _buildChapterList(
  BuildContext context,
  ComicDetailState state,
  ComicDetailNotifier notifier,
  DownloadCenterNotifier downloadNotifier,
) {
  if (state.loading && state.chapters.isEmpty) {
    return const SliverFillRemaining(
      child: Center(child: CircularProgressIndicator()),
    );
  }

  final visible = notifier.getVisibleChapters(); // 使用新方法

  if (visible.isEmpty) {
    return const SliverFillRemaining(
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_outlined, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('暂无章节'),
          ],
        ),
      ),
    );
  }

  return SliverPadding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
    sliver: SliverList(
      delegate: SliverChildBuilderDelegate(
        (ctx, index) {
          final chapter = visible[index];
          final isSelected = state.selectedChapterIds.contains(chapter.id);
          return _buildChapterItem(
            context,
            state,
            notifier,
            downloadNotifier,
            chapter,
            isSelected,
          );
        },
        childCount: visible.length,
      ),
    ),
  );
}
```

## 验证步骤
1.  运行 Flutter 应用。
2.  进入任意漫画详情页。
3.  验证新的三层选择器UI是否正确显示。
4.  测试切换“全部”、“卷”、“章节”Tab。
5.  测试在下拉菜单中切换不同区域。
6.  测试切换正序/倒序，确认排序只影响当前视图。
7.  测试批量选择功能，包括全选、清空和下载。
8.  检查在不同屏幕尺寸下的UI表现。
