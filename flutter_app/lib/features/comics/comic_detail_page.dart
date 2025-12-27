import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../downloads/download_center_provider.dart';
import '../downloads/download_models.dart';
import 'comic_reader_page.dart';
import 'comic_detail_provider.dart';
import 'comics_models.dart';
import 'comics_provider.dart';
import '../../core/network/image_proxy.dart';

class ComicDetailPage extends ConsumerStatefulWidget {
  const ComicDetailPage({super.key, required this.comicId});

  final String comicId;

  @override
  ConsumerState<ComicDetailPage> createState() => _ComicDetailPageState();
}

class _ComicDetailPageState extends ConsumerState<ComicDetailPage> {
  bool _descExpanded = false;

  @override
  Widget build(BuildContext context) {
    final comicsState = ref.watch(comicsProvider);
    final currentSource = comicsState.selectedSource;
    final request = ComicDetailRequest(id: widget.comicId, sourceId: currentSource);
    final state = ref.watch(comicDetailProvider(request));
    final notifier = ref.read(comicDetailProvider(request).notifier);
    
    if (state.loading && state.detail == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (state.error != null && state.detail == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(state.error!, style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: notifier.refresh,
                child: const Text('重试'),
              ),
            ],
          ),
        ),
      );
    }

    final detail = state.detail;
    if (detail == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('漫画不存在')),
      );
    }

    return _buildDetailContent(context, ref, state, notifier, detail);
  }

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
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.all(16),
              color: Theme.of(context).colorScheme.surface,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 封面图
                  Container(
                    width: 120,
                    height: 160,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: proxyImageUrl(detail.cover),
                        width: 120,
                        height: 160,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          width: 120,
                          height: 160,
                          color: Colors.grey[300],
                          child: const Center(
                            child: CircularProgressIndicator(),
                          ),
                        ),
                        errorWidget: (context, url, error) => Container(
                          width: 120,
                          height: 160,
                          color: Colors.grey[300],
                          child: const Icon(Icons.broken_image, size: 48),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  // 右侧信息
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 标题
                        Text(
                          detail.title,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 8),
                        // 作者
                        Text(
                          detail.author,
                          style: Theme.of(context).textTheme.bodyMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 8),
                        // 状态和来源
                        Row(
                          children: [
                            if (detail.status.isNotEmpty)
                              Text(
                                detail.status == 'completed' ? '完结' : '连载中',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colorScheme.primary),
                              ),
                            const SizedBox(width: 12),
                            if (detail.source.isNotEmpty)
                              Text(
                                detail.source,
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colorScheme.primary),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        // 操作按钮
                        Row(
                          children: [
                            OutlinedButton.icon(
                              icon: const Icon(Icons.menu_book, size: 18),
                              label: const Text('试读'),
                              onPressed: () {
                                if (state.chapters.isNotEmpty) {
                                  _handleStartReading(context, state);
                                }
                              },
                            ),
                            const SizedBox(width: 8),
                            FilledButton(
                              onPressed: () {
                                if (state.chapters.isNotEmpty) {
                                  _handleStartReading(context, state);
                                }
                              },
                              child: const Text('开始阅读'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              color: Theme.of(context).colorScheme.surface,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (detail.tags.isNotEmpty) ...[
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: detail.tags.map((tag) {
                        return Chip(
                          label: Text(tag),
                          backgroundColor: colorScheme.surfaceContainerHighest,
                          side: BorderSide(color: colorScheme.outlineVariant),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),
                  ],
                  ..._buildDescriptionSection(detail.description),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: _buildNewSelectorPanel(context, state, notifier),
          ),
          _buildChapterList(context, state, notifier, downloadNotifier),
        ],
      ),
      bottomNavigationBar: state.selectionMode && state.selectedChapterIds.isNotEmpty
          ? _buildBatchActionBar(context, state, notifier, downloadNotifier)
          : null,
    );
  }
  
  Widget _buildBatchActionBar(
    BuildContext context,
    ComicDetailState state,
    ComicDetailNotifier notifier,
    DownloadCenterNotifier downloadNotifier,
  ) {
    final selectedCount = state.selectedChapterIds.length;
    return BottomAppBar(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Text(
              '已选 $selectedCount 项',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const Spacer(),
            FilledButton.icon(
              onPressed: () => _handleDownloadSelected(
                context,
                state,
                notifier,
                downloadNotifier,
              ),
              icon: const Icon(Icons.download, size: 20),
              label: Text('下载 ($selectedCount)'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNewSelectorPanel(
    BuildContext context,
    ComicDetailState state,
    ComicDetailNotifier notifier,
  ) {
    final key = '${state.chapterDisplayType.name}-${state.currentSegment?.label() ?? 'all'}';
    final descending = state.sortOrderMap[key] ?? true;
    final selectedCount = state.selectedChapterIds.length;
    
    return Card(
      margin: const EdgeInsets.all(12),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '章节列表 (${state.allChapters.length})',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            ToggleButtons(
              isSelected: [
                state.chapterDisplayType == ChapterDisplayType.all,
                state.chapterDisplayType == ChapterDisplayType.volume,
                state.chapterDisplayType == ChapterDisplayType.chapter,
              ],
              onPressed: (index) {
                notifier.setChapterDisplayType(ChapterDisplayType.values[index]);
              },
              borderRadius: BorderRadius.circular(8),
              constraints: const BoxConstraints(minHeight: 36, minWidth: 80),
              children: const [
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('全部'),
                ),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('卷'),
                ),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('章节'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildSegmentDropdown(context, state, notifier),
                ),
                const SizedBox(width: 12),
                TextButton.icon(
                  onPressed: notifier.toggleSortOrder,
                  icon: Icon(
                    descending ? Icons.arrow_downward : Icons.arrow_upward,
                    size: 18,
                  ),
                  label: Text(descending ? '倒序' : '正序'),
                ),
                IconButton(
                  icon: Icon(state.selectionMode ? Icons.close : Icons.select_all),
                  onPressed: notifier.toggleSelectionMode,
                  tooltip: state.selectionMode ? '取消选择' : '批量选择',
                ),
              ],
            ),
            if (state.selectionMode) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Text('已选 $selectedCount 章', style: Theme.of(context).textTheme.bodyMedium),
                  const Spacer(),
                  TextButton(
                    onPressed: notifier.selectAllVisibleChapters,
                    child: const Text('全选当前'),
                  ),
                  TextButton(
                    onPressed: notifier.clearSelection,
                    child: const Text('清空选择'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  Widget _buildSegmentDropdown(
    BuildContext context,
    ComicDetailState state,
    ComicDetailNotifier notifier,
  ) {
    final segments = state.segmentMap[state.chapterDisplayType] ?? [];
    
    if (segments.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: Theme.of(context).dividerColor),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text('全部'),
      );
    }
    
    String getLabel(ChapterSegment segment) {
      if (state.chapterDisplayType == ChapterDisplayType.volume) {
        return '第${segment.start + 1}-${segment.end + 1}卷';
      }
      
      return '${segment.start}-${segment.end}';
    }
    
    return DropdownButton<ChapterSegment>(
      value: state.currentSegment,
      isExpanded: true,
      underline: Container(),
      items: segments.map((segment) {
        return DropdownMenuItem(
          value: segment,
          child: Text(getLabel(segment)),
        );
      }).toList(),
      onChanged: (segment) {
        if (segment != null) {
          notifier.setSegment(segment);
        }
      },
    );
  }

  List<Widget> _buildDescriptionSection(String? description) {
    final raw = description?.trim() ?? '';
    if (raw.isEmpty) {
      return const <Widget>[];
    }
    const maxLines = 1;
    final painter = TextPainter(
      text: TextSpan(text: raw, style: Theme.of(context).textTheme.bodyMedium),
      textDirection: TextDirection.ltr,
      maxLines: maxLines,
    )..layout(maxWidth: MediaQuery.of(context).size.width - 32);
    final exceeds = painter.didExceedMaxLines;
    return [
      Text('简介', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
      const SizedBox(height: 2),
      Text(
        raw,
        style: Theme.of(context).textTheme.bodyMedium,
        maxLines: _descExpanded ? null : maxLines,
        overflow: _descExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
      ),
      if (exceeds)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () {
              setState(() {
                _descExpanded = !_descExpanded;
              });
            },
            child: Text(_descExpanded ? '收起' : '展开简介'),
          ),
        ),
      const SizedBox(height: 8),
    ];
  }


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

    if (state.chapters.isEmpty) {
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

    final visible = notifier.visibleChapters();

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

  Widget _buildChapterItem(
    BuildContext context,
    ComicDetailState state,
    ComicDetailNotifier notifier,
    DownloadCenterNotifier downloadNotifier,
    ComicChapter chapter,
    bool isSelected,
  ) {
    return Consumer(
      builder: (context, ref, _) {
        final downloadState = ref.watch(downloadCenterProvider);
        final downloadItem = _findDownloadItem(downloadState, chapter.id);
        final colorScheme = Theme.of(context).colorScheme;
        final status = _resolveDownloadStatus(downloadItem);
        
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(
            side: BorderSide(color: isSelected ? colorScheme.primary : colorScheme.outlineVariant),
            borderRadius: BorderRadius.circular(12),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () {
              if (state.selectionMode) {
                notifier.toggleChapterSelection(chapter.id);
              } else {
                _handleChapterTap(context, chapter, state);
              }
            },
            onLongPress: () => notifier.beginSelectionWith(chapter.id),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  if (state.selectionMode)
                    Checkbox(
                      value: isSelected,
                      onChanged: (_) => notifier.toggleChapterSelection(chapter.id),
                    )
                  else
                    const SizedBox(width: 0),
                  IconButton(
                    icon: const Icon(Icons.menu_book),
                    color: colorScheme.primary,
                    onPressed: () => _handleChapterTap(context, chapter, state),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          chapter.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? colorScheme.primary : null,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            if (status.isNotEmpty)
                              Text(
                                status,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: _statusColor(status, colorScheme),
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            if (chapter.updateTime != null) ...[
                              if (status.isNotEmpty) const SizedBox(width: 8),
                              Text(
                                chapter.updateTime!,
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (!isSelected)
                    _buildDownloadTrailing(
                      context,
                      state,
                      chapter,
                      downloadNotifier,
                      downloadItem,
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _resolveDownloadStatus(DownloadItem? downloadItem) {
    if (downloadItem == null) {
      return '';
    }
    switch (downloadItem.status) {
      case DownloadStatus.pending:
        return '待下载';
      case DownloadStatus.downloading:
        final percent = (downloadItem.progress * 100).toInt();
        return '下载中 $percent%';
      case DownloadStatus.paused:
        return '已暂停';
      case DownloadStatus.failed:
        return '失败';
      case DownloadStatus.completed:
        return '已完成';
    }
  }

  Color _statusColor(String status, ColorScheme scheme) {
    if (status.startsWith('下载中') || status == '待下载') {
      return scheme.primary;
    }
    if (status == '已完成') {
      return Colors.green;
    }
    if (status == '失败') {
      return Colors.red;
    }
    if (status == '已暂停') {
      return scheme.onSurfaceVariant;
    }
    return scheme.onSurfaceVariant;
  }

  DownloadItem? _findDownloadItem(DownloadCenterState downloadState, String chapterId) {
    for (final item in downloadState.queue) {
      if (item.resourceId == chapterId) {
        return item;
      }
    }
    for (final item in downloadState.completed) {
      if (item.resourceId == chapterId) {
        return item;
      }
    }
    return null;
  }

  Widget _buildDownloadTrailing(
    BuildContext context,
    ComicDetailState state,
    ComicChapter chapter,
    DownloadCenterNotifier downloadNotifier,
    DownloadItem? downloadItem,
  ) {
    if (downloadItem == null) {
      return IconButton(
        icon: const Icon(Icons.download_outlined),
        onPressed: () => _handleDownloadChapter(
          context,
          state,
          chapter,
          downloadNotifier,
        ),
      );
    }

    if (downloadItem.status == DownloadStatus.completed) {
      return const Chip(
        label: Text('已下载', style: TextStyle(fontSize: 12)),
        avatar: Icon(Icons.check_circle, size: 16),
        padding: EdgeInsets.symmetric(horizontal: 4),
      );
    }

    if (downloadItem.status == DownloadStatus.downloading) {
      final percent = (downloadItem.progress * 100).toInt();
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 40,
            child: Text(
              '$percent%',
              style: const TextStyle(fontSize: 12),
              textAlign: TextAlign.right,
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              value: downloadItem.progress,
              strokeWidth: 2,
            ),
          ),
        ],
      );
    }

    if (downloadItem.status == DownloadStatus.pending) {
      return const Chip(
        label: Text('排队中', style: TextStyle(fontSize: 12)),
        padding: EdgeInsets.symmetric(horizontal: 4),
      );
    }

    if (downloadItem.status == DownloadStatus.failed) {
      return const Chip(
        label: Text('失败', style: TextStyle(fontSize: 12)),
        avatar: Icon(Icons.error_outline, size: 16),
        padding: EdgeInsets.symmetric(horizontal: 4),
      );
    }

    return IconButton(
      icon: const Icon(Icons.download_outlined),
      onPressed: () => _handleDownloadChapter(
        context,
        state,
        chapter,
        downloadNotifier,
      ),
    );
  }

  void _handleStartReading(BuildContext context, ComicDetailState state) {
    if (state.chapters.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('暂无章节')),
      );
      return;
    }
    final chapter = state.descending ? state.chapters.last : state.chapters.first;
    _handleChapterTap(context, chapter, state);
  }

  void _handleChapterTap(BuildContext context, ComicChapter chapter, ComicDetailState state) {
    final detail = state.detail;
    if (detail == null || chapter.id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('章节信息缺失')),
      );
      return;
    }
    final comicsState = ref.read(comicsProvider);
    final currentSource = comicsState.selectedSource;
    final sourceId = (currentSource != null && currentSource.isNotEmpty)
        ? currentSource
        : detail.source;
    final args = ComicReaderArgs(
      chapters: state.chapters,
      currentChapterId: chapter.id,
      comicTitle: detail.title,
      sourceId: sourceId,
    );
    context.pushNamed(
      'comicReader',
      pathParameters: {'id': detail.id},
      extra: args,
    );
  }

  void _handleDownloadChapter(
    BuildContext context,
    ComicDetailState state,
    ComicChapter chapter,
    DownloadCenterNotifier downloadNotifier,
  ) {
    final detail = state.detail;
    if (detail == null) {
      return;
    }
    final comicsState = ref.read(comicsProvider);
    final currentSource = comicsState.selectedSource;
    final detailWithSource = (currentSource != null && currentSource.isNotEmpty)
        ? detail.copyWith(source: currentSource)
        : detail;
    downloadNotifier.enqueueComicChapters(
      detail: detailWithSource,
      chapters: [chapter],
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${chapter.title} 已加入下载队列')),
    );
  }

  void _handleDownloadSelected(
    BuildContext context,
    ComicDetailState state,
    ComicDetailNotifier notifier,
    DownloadCenterNotifier downloadNotifier,
  ) {
    final detail = state.detail;
    if (detail == null) {
      return;
    }
    final chapters = notifier.selectedChapters();
    if (chapters.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先选择章节')),
      );
      return;
    }
    final comicsState = ref.read(comicsProvider);
    final currentSource = comicsState.selectedSource;
    final detailWithSource = (currentSource != null && currentSource.isNotEmpty)
        ? detail.copyWith(source: currentSource)
        : detail;
    downloadNotifier.enqueueComicChapters(detail: detailWithSource, chapters: chapters);
    notifier.clearSelection();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已加入 ${chapters.length} 个章节到下载队列')),
    );
  }
}
