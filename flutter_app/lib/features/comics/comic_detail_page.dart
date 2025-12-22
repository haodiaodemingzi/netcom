import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../downloads/download_center_provider.dart';
import '../downloads/download_models.dart';
import 'comic_reader_page.dart';
import 'comic_detail_provider.dart';
import 'comics_models.dart';

class ComicDetailPage extends ConsumerWidget {
  const ComicDetailPage({super.key, required this.comicId});

  final String comicId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = ComicDetailRequest(id: comicId);
    final state = ref.watch(comicDetailProvider(request));
    final notifier = ref.read(comicDetailProvider(request).notifier);
    
    return Scaffold(
      appBar: AppBar(
        title: Text(state.detail?.title ?? '漫画详情'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: Icon(state.isFavorite ? Icons.favorite : Icons.favorite_border),
            tooltip: state.isFavorite ? '取消收藏' : '收藏',
            onPressed: state.detail != null ? notifier.toggleFavorite : null,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: state.loading ? null : notifier.refresh,
          ),
        ],
      ),
      body: _buildBody(context, ref, state, notifier),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    ComicDetailState state,
    ComicDetailNotifier notifier,
  ) {
    if (state.loading && state.detail == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.detail == null) {
      return _buildErrorView(context, state.error!, notifier.refresh);
    }

    if (state.detail == null) {
      return _buildErrorView(context, '加载失败', notifier.refresh);
    }

    return _buildDetailContent(context, ref, state, notifier);
  }

  Widget _buildErrorView(BuildContext context, String message, VoidCallback onRetry) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(message, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('重试'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailContent(
    BuildContext context,
    WidgetRef ref,
    ComicDetailState state,
    ComicDetailNotifier notifier,
  ) {
    final detail = state.detail!;
    final downloadNotifier = ref.read(downloadCenterProvider.notifier);

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: _buildHeader(context, detail, state.isFavorite, () {
            _handleStartReading(context, state);
          }),
        ),
        SliverToBoxAdapter(
          child: _buildActionBar(context, state, notifier, downloadNotifier),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              '章节列表 (${state.chapters.length})',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ),
        ),
        if (state.segments.isNotEmpty)
          SliverToBoxAdapter(
            child: SizedBox(
              height: 48,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemBuilder: (context, index) {
                  final segment = state.segments[index];
                  final selected = index == state.currentSegmentIndex;
                  return ChoiceChip(
                    label: Text(segment.label()),
                    selected: selected,
                    onSelected: (_) => notifier.selectSegment(index),
                  );
                },
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemCount: state.segments.length,
              ),
            ),
          ),
        _buildChapterList(context, state, notifier, downloadNotifier),
      ],
    );
  }

  Widget _buildHeader(
    BuildContext context,
    ComicDetail detail,
    bool isFavorite,
    VoidCallback onStartReading,
  ) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 120,
                  height: 160,
                  child: Image.network(
                    detail.cover,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: theme.colorScheme.surfaceContainerHighest,
                      child: const Icon(Icons.broken_image, size: 48),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      detail.title,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    if (detail.author.isNotEmpty)
                      Text(
                        detail.author,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        Chip(
                          label: Text(detail.status == 'completed' ? '完结' : '连载中'),
                          padding: EdgeInsets.zero,
                          visualDensity: VisualDensity.compact,
                        ),
                        if (detail.source.isNotEmpty)
                          Chip(
                            label: Text(detail.source),
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (detail.tags.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: detail.tags.map((tag) {
                return Chip(
                  label: Text(tag),
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                );
              }).toList(),
            ),
          ],
          if (detail.description.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              '简介',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              detail.description,
              style: theme.textTheme.bodyMedium,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onStartReading,
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text('开始阅读'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionBar(
    BuildContext context,
    ComicDetailState state,
    ComicDetailNotifier notifier,
    DownloadCenterNotifier downloadNotifier,
  ) {
    final selectedCount = state.selectedChapterIds.length;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
        border: Border(
          top: BorderSide(color: Theme.of(context).dividerColor),
          bottom: BorderSide(color: Theme.of(context).dividerColor),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: notifier.toggleSelectionMode,
                icon: Icon(
                  state.selectionMode ? Icons.close : Icons.check_box_outline_blank,
                  size: 20,
                ),
                label: Text(state.selectionMode ? '取消' : '多选'),
              ),
              const SizedBox(width: 8),
              if (state.selectionMode && selectedCount > 0)
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
              const Spacer(),
              TextButton.icon(
                onPressed: notifier.toggleSortOrder,
                icon: Icon(
                  state.descending ? Icons.arrow_downward : Icons.arrow_upward,
                  size: 20,
                ),
                label: Text(state.descending ? '倒序' : '正序'),
              ),
            ],
          ),
          if (state.selectionMode) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Text('已选 $selectedCount 章'),
                const Spacer(),
                TextButton(
                  onPressed: notifier.selectAllVisibleChapters,
                  child: const Text('全选'),
                ),
                TextButton(
                  onPressed: notifier.clearSelection,
                  child: const Text('清空'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
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

    return SliverList.builder(
      itemCount: visible.length,
      itemBuilder: (context, index) {
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
        
        return ListTile(
          leading: state.selectionMode
              ? Checkbox(
                  value: isSelected,
                  onChanged: (_) => notifier.toggleChapterSelection(chapter.id),
                )
              : CircleAvatar(
                  radius: 16,
                  child: Text(
                    '${chapter.index}',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
          title: Text(chapter.title),
          subtitle: chapter.updateTime != null ? Text(chapter.updateTime!) : null,
          trailing: state.selectionMode
              ? null
              : _buildDownloadTrailing(
                  context,
                  state,
                  chapter,
                  downloadNotifier,
                  downloadItem,
                ),
          selected: isSelected,
          onTap: () {
            if (state.selectionMode) {
              notifier.toggleChapterSelection(chapter.id);
            } else {
              _handleChapterTap(context, chapter, state);
            }
          },
          onLongPress: () => notifier.beginSelectionWith(chapter.id),
        );
      },
    );
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
    final args = ComicReaderArgs(
      chapters: state.chapters,
      currentChapterId: chapter.id,
      comicTitle: detail.title,
      sourceId: detail.source,
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
    downloadNotifier.enqueueComicChapters(
      detail: detail,
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
    downloadNotifier.enqueueComicChapters(detail: detail, chapters: chapters);
    notifier.clearSelection();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已加入 ${chapters.length} 个章节到下载队列')),
    );
  }
}

