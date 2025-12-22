import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../downloads/download_center_provider.dart';
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
    final downloadNotifier = ref.read(downloadCenterProvider.notifier);
    final detail = state.detail;
    return Scaffold(
      appBar: AppBar(
        title: Text(detail?.title.isNotEmpty == true ? detail!.title : '漫画详情'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: Icon(state.isFavorite ? Icons.favorite : Icons.favorite_border),
            tooltip: state.isFavorite ? '取消收藏' : '收藏',
            onPressed: detail == null ? null : notifier.toggleFavorite,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: state.loading ? null : notifier.refresh,
          ),
        ],
      ),
      body: Builder(
        builder: (_) {
          if (state.loading && detail == null) {
            return const Center(child: CircularProgressIndicator());
          }
          if (detail == null) {
            return _ErrorView(onRetry: notifier.refresh, message: state.error);
          }
          return _DetailView(
            state: state,
            onStartReading: () => _startReading(context, state),
            onChapterTap: (chapter) => _openReader(context, chapter),
            onToggleSort: notifier.toggleSortOrder,
            onToggleSelectionMode: notifier.toggleSelectionMode,
            onToggleChapterSelection: notifier.toggleChapterSelection,
            onBeginSelection: notifier.beginSelectionWith,
            onSelectAll: notifier.selectAllChapters,
            onClearSelection: notifier.clearSelection,
            onDownloadSelected: () => _downloadSelected(context, notifier, downloadNotifier),
            onDownloadChapter: (chapter) => _downloadSingle(context, state, chapter, downloadNotifier),
          );
        },
      ),
    );
  }

  void _startReading(BuildContext context, ComicDetailState state) {
    if (state.chapters.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('暂无章节可阅读')));
      return;
    }
    final chapter = state.descending ? state.chapters.last : state.chapters.first;
    _openReader(context, chapter);
  }

  void _openReader(BuildContext context, ComicChapter chapter) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('阅读器开发中：${chapter.title}')),
    );
  }

  void _downloadSelected(
    BuildContext context,
    ComicDetailNotifier notifier,
    DownloadCenterNotifier downloadNotifier,
  ) {
    final detail = notifier.state.detail;
    if (detail == null) {
      return;
    }
    final chapters = notifier.selectedChapters();
    if (chapters.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请先选择章节')));
      return;
    }
    downloadNotifier.enqueueComicChapters(detail: detail, chapters: chapters);
    notifier.clearSelection();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已加入 ${chapters.length} 个章节到下载队列')),
    );
  }

  void _downloadSingle(
    BuildContext context,
    ComicDetailState state,
    ComicChapter chapter,
    DownloadCenterNotifier downloadNotifier,
  ) {
    final detail = state.detail;
    if (detail == null) {
      return;
    }
    downloadNotifier.enqueueComicChapters(detail: detail, chapters: <ComicChapter>[chapter]);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('章节 ${chapter.title} 已加入下载队列')),
    );
  }
}

class _DetailView extends StatefulWidget {
  const _DetailView({
    required this.state,
    required this.onStartReading,
    required this.onChapterTap,
    required this.onToggleSort,
    required this.onToggleSelectionMode,
    required this.onToggleChapterSelection,
    required this.onBeginSelection,
    required this.onSelectAll,
    required this.onClearSelection,
    required this.onDownloadSelected,
    required this.onDownloadChapter,
  });

  final ComicDetailState state;
  final VoidCallback onStartReading;
  final ValueChanged<ComicChapter> onChapterTap;
  final VoidCallback onToggleSort;
  final VoidCallback onToggleSelectionMode;
  final ValueChanged<String> onToggleChapterSelection;
  final ValueChanged<String> onBeginSelection;
  final VoidCallback onSelectAll;
  final VoidCallback onClearSelection;
  final VoidCallback onDownloadSelected;
  final ValueChanged<ComicChapter> onDownloadChapter;

  @override
  State<_DetailView> createState() => _DetailViewState();
}

class _DetailViewState extends State<_DetailView> {
  bool _showFullDesc = false;

  @override
  Widget build(BuildContext context) {
    final detail = widget.state.detail;
    if (detail == null) {
      return const SizedBox.shrink();
    }
    final chapters = widget.state.chapters;
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: _Header(
            detail: detail,
            showFullDesc: _showFullDesc,
            onToggleDesc: () => setState(() => _showFullDesc = !_showFullDesc),
            onStartReading: widget.onStartReading,
            isFavorite: widget.state.isFavorite,
          ),
        ),
        SliverToBoxAdapter(
          child: _ActionPanel(
            state: widget.state,
            onStartReading: widget.onStartReading,
            onToggleSelectionMode: widget.onToggleSelectionMode,
            onDownloadSelected: widget.onDownloadSelected,
            onToggleSort: widget.onToggleSort,
            onSelectAll: widget.onSelectAll,
            onClearSelection: widget.onClearSelection,
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Text(
              '章节 (${chapters.length})',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        if (widget.state.loading && chapters.isEmpty)
          const SliverFillRemaining(
            child: Center(child: CircularProgressIndicator()),
          )
        else if (chapters.isEmpty)
          const SliverFillRemaining(
            child: Center(child: Text('暂无章节')),
          )
        else
          SliverList.separated(
            itemBuilder: (context, index) {
              final chapter = chapters[index];
              final selected = widget.state.selectedChapterIds.contains(chapter.id);
              return ListTile(
                leading: widget.state.selectionMode
                    ? Checkbox(
                        value: selected,
                        onChanged: (_) => widget.onToggleChapterSelection(chapter.id),
                      )
                    : CircleAvatar(
                        radius: 18,
                        child: Text(
                          '${chapter.index}',
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                      ),
                title: Text(chapter.title),
                subtitle: chapter.updateTime != null ? Text(chapter.updateTime!) : null,
                trailing: Wrap(
                  spacing: 4,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.download_rounded),
                      tooltip: '下载章节',
                      onPressed: () => widget.onDownloadChapter(chapter),
                    ),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ),
                onTap: () {
                  if (widget.state.selectionMode) {
                    widget.onToggleChapterSelection(chapter.id);
                    return;
                  }
                  widget.onChapterTap(chapter);
                },
                onLongPress: () => widget.onBeginSelection(chapter.id),
                selected: selected,
              );
            },
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemCount: chapters.length,
          ),
      ],
    );
  }
}

class _ActionPanel extends StatelessWidget {
  const _ActionPanel({
    required this.state,
    required this.onStartReading,
    required this.onToggleSelectionMode,
    required this.onDownloadSelected,
    required this.onToggleSort,
    required this.onSelectAll,
    required this.onClearSelection,
  });

  final ComicDetailState state;
  final VoidCallback onStartReading;
  final VoidCallback onToggleSelectionMode;
  final VoidCallback onDownloadSelected;
  final VoidCallback onToggleSort;
  final VoidCallback onSelectAll;
  final VoidCallback onClearSelection;

  @override
  Widget build(BuildContext context) {
    final selectedCount = state.selectedChapterIds.length;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              FilledButton.icon(
                onPressed: state.chapters.isEmpty ? null : onStartReading,
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('开始阅读'),
              ),
              OutlinedButton.icon(
                onPressed: onToggleSelectionMode,
                icon: Icon(state.selectionMode ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded),
                label: Text(state.selectionMode ? '退出多选' : '批量选择'),
              ),
              OutlinedButton.icon(
                onPressed: selectedCount > 0 ? onDownloadSelected : null,
                icon: const Icon(Icons.download_for_offline_rounded),
                label: Text(selectedCount > 0 ? '下载已选 ($selectedCount)' : '下载已选'),
              ),
              TextButton.icon(
                onPressed: onToggleSort,
                icon: Icon(state.descending ? Icons.swap_vert_rounded : Icons.sort_by_alpha_rounded),
                label: Text(state.descending ? '最新在前' : '最早在前'),
              ),
            ],
          ),
          if (state.selectionMode) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Text('已选择 $selectedCount 个章节'),
                const Spacer(),
                TextButton(
                  onPressed: onSelectAll,
                  child: const Text('全选'),
                ),
                TextButton(
                  onPressed: onClearSelection,
                  child: const Text('清空'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.detail,
    required this.showFullDesc,
    required this.onToggleDesc,
    required this.onStartReading,
    required this.isFavorite,
  });

  final ComicDetail detail;
  final bool showFullDesc;
  final VoidCallback onToggleDesc;
  final VoidCallback onStartReading;
  final bool isFavorite;

  @override
  Widget build(BuildContext context) {
    final chipTheme = Theme.of(context).chipTheme;
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: AspectRatio(
                  aspectRatio: 3 / 4,
                  child: Image.network(
                    detail.cover,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: colorScheme.surfaceVariant,
                      alignment: Alignment.center,
                      child: const Icon(Icons.broken_image_outlined, size: 40),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(detail.title, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    if (detail.author.isNotEmpty)
                      Text('作者 ${detail.author}', style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        Chip(label: Text(detail.status == 'completed' ? '完结' : '连载中')),
                        if (detail.source.isNotEmpty) Chip(label: Text('来源 ${detail.source}')),
                        ...detail.tags.map(
                          (tag) => Chip(
                            label: Text(tag),
                            backgroundColor: chipTheme.backgroundColor,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              FilledButton.icon(
                onPressed: onStartReading,
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('开始阅读'),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: null,
                icon: Icon(isFavorite ? Icons.favorite : Icons.favorite_border),
                label: Text(isFavorite ? '已收藏' : '收藏'),
              ),
            ],
          ),
          if (detail.description.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('简介', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              detail.description,
              style: Theme.of(context).textTheme.bodyMedium,
              maxLines: showFullDesc ? null : 3,
              overflow: showFullDesc ? TextOverflow.visible : TextOverflow.ellipsis,
            ),
            TextButton(
              onPressed: onToggleDesc,
              child: Text(showFullDesc ? '收起' : '展开'),
            ),
          ],
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({this.message, required this.onRetry});

  final String? message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message ?? '加载失败', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('重试')),
        ],
      ),
    );
  }
}
