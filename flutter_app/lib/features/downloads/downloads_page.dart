import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'download_center_provider.dart';
import 'download_models.dart';

class DownloadsPage extends ConsumerStatefulWidget {
  const DownloadsPage({super.key});

  @override
  ConsumerState<DownloadsPage> createState() => _DownloadsPageState();
}

class _DownloadsPageState extends ConsumerState<DownloadsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(downloadCenterProvider.notifier).refreshFromRemote();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(downloadCenterProvider);
    final notifier = ref.read(downloadCenterProvider.notifier);
    return Scaffold(
      appBar: AppBar(
        title: const Text('下载管理'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: state.loading ? null : notifier.refreshFromRemote,
            tooltip: '刷新',
          ),
          IconButton(
            icon: const Icon(Icons.play_arrow_rounded),
            onPressed: state.selectedQueue.isEmpty ? null : notifier.resumeSelected,
            tooltip: '继续',
          ),
          IconButton(
            icon: const Icon(Icons.pause_rounded),
            onPressed: state.selectedQueue.isEmpty ? null : notifier.pauseSelected,
            tooltip: '暂停',
          ),
          IconButton(
            icon: const Icon(Icons.restart_alt_rounded),
            onPressed: state.selectedQueue.isEmpty ? null : notifier.retrySelected,
            tooltip: '重试',
          ),
          IconButton(
            icon: const Icon(Icons.cancel_rounded),
            onPressed: state.selectedQueue.isEmpty ? null : notifier.cancelSelected,
            tooltip: '取消',
          ),
        ],
      ),
      body: DefaultTabController(
        length: 2,
        child: Column(
          children: [
            const TabBar(
              tabs: [
                Tab(text: '队列'),
                Tab(text: '已完成'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _buildQueue(context, state, notifier),
                  _buildCompleted(context, state, notifier),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQueue(BuildContext context, DownloadCenterState state, DownloadCenterNotifier notifier) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null) {
      return _EmptySection(
        title: state.error!,
        action: TextButton(
          onPressed: state.loading ? null : notifier.refreshFromRemote,
          child: const Text('重试'),
        ),
      );
    }
    if (state.queue.isEmpty) {
      return _EmptySection(
        title: '暂无任务',
        action: TextButton(
          onPressed: () => notifier.clearSelection(inQueue: true),
          child: const Text('刷新列表'),
        ),
      );
    }
    return Column(
      children: [
        _SelectionBar(
          onSelectAll: notifier.selectAllQueue,
          onClear: () => notifier.clearSelection(inQueue: true),
          selectedCount: state.selectedQueue.length,
          totalCount: state.queue.length,
          actions: [
            TextButton(
              onPressed: state.selectedQueue.isEmpty ? null : notifier.pauseSelected,
              child: const Text('暂停'),
            ),
            TextButton(
              onPressed: state.selectedQueue.isEmpty ? null : notifier.resumeSelected,
              child: const Text('继续'),
            ),
            TextButton(
              onPressed: state.selectedQueue.isEmpty ? null : notifier.cancelSelected,
              child: const Text('取消'),
            ),
          ],
        ),
        Expanded(
          child: ListView.separated(
            itemCount: state.queue.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final item = state.queue[index];
              final selected = state.selectedQueue.contains(item.id);
              return _DownloadTile(
                item: item,
                selected: selected,
                onToggle: () => notifier.toggleSelection(item.id, inQueue: true),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCompleted(BuildContext context, DownloadCenterState state, DownloadCenterNotifier notifier) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null) {
      return _EmptySection(
        title: state.error!,
        action: TextButton(
          onPressed: state.loading ? null : notifier.refreshFromRemote,
          child: const Text('重试'),
        ),
      );
    }
    if (state.completed.isEmpty) {
      return _EmptySection(
        title: '暂无已完成',
        action: TextButton(
          onPressed: () => notifier.clearSelection(inQueue: false),
          child: const Text('刷新列表'),
        ),
      );
    }
    return Column(
      children: [
        _SelectionBar(
          onSelectAll: notifier.selectAllCompleted,
          onClear: () => notifier.clearSelection(inQueue: false),
          selectedCount: state.selectedCompleted.length,
          totalCount: state.completed.length,
          actions: [
            TextButton(
              onPressed: state.selectedCompleted.isEmpty ? null : notifier.deleteCompletedSelected,
              child: const Text('删除'),
            ),
          ],
        ),
        Expanded(
          child: ListView.separated(
            itemCount: state.completed.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final item = state.completed[index];
              final selected = state.selectedCompleted.contains(item.id);
              return _DownloadTile(
                item: item,
                selected: selected,
                onToggle: () => notifier.toggleSelection(item.id, inQueue: false),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SelectionBar extends StatelessWidget {
  const _SelectionBar({
    required this.onSelectAll,
    required this.onClear,
    required this.selectedCount,
    required this.totalCount,
    required this.actions,
  });

  final VoidCallback onSelectAll;
  final VoidCallback onClear;
  final int selectedCount;
  final int totalCount;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          TextButton(
            onPressed: onSelectAll,
            child: const Text('全选'),
          ),
          TextButton(
            onPressed: onClear,
            child: const Text('清空选择'),
          ),
          const Spacer(),
          Text(
            '已选 $selectedCount/$totalCount',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(width: 8),
          ...actions,
        ],
      ),
    );
  }
}

class _DownloadTile extends StatelessWidget {
  const _DownloadTile({
    required this.item,
    required this.selected,
    required this.onToggle,
  });

  final DownloadItem item;
  final bool selected;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final statusText = _statusLabel(item.status);
    return ListTile(
      leading: Checkbox(
        value: selected,
        onChanged: (_) => onToggle(),
      ),
      title: Text('${item.parentTitle} - ${item.title}'),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (item.source != null && item.source!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text('源 ${item.source}'),
            ),
          LinearProgressIndicator(
            value: item.progress,
            backgroundColor: Theme.of(context).colorScheme.surfaceVariant,
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              item.status == DownloadStatus.failed && item.error != null ? '状态 $statusText · ${item.error}' : '状态 $statusText',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
      trailing: _typeIcon(item.type),
      onTap: onToggle,
    );
  }

  String _statusLabel(DownloadStatus status) {
    switch (status) {
      case DownloadStatus.pending:
        return '待开始';
      case DownloadStatus.downloading:
        return '下载中';
      case DownloadStatus.paused:
        return '已暂停';
      case DownloadStatus.failed:
        return '失败';
      case DownloadStatus.completed:
        return '已完成';
    }
  }

  Widget _typeIcon(DownloadType type) {
    switch (type) {
      case DownloadType.video:
        return const Icon(Icons.movie_rounded);
      case DownloadType.comic:
        return const Icon(Icons.menu_book_rounded);
      case DownloadType.ebook:
        return const Icon(Icons.auto_stories_rounded);
    }
  }
}

class _EmptySection extends StatelessWidget {
  const _EmptySection({
    required this.title,
    required this.action,
  });

  final String title;
  final Widget action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          action,
        ],
      ),
    );
  }
}
