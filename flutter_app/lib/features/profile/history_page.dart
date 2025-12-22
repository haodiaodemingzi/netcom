import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';
import '../comics/comic_reader_page.dart';
import '../comics/comics_models.dart';
import '../comics/comics_provider.dart';

class HistoryPage extends ConsumerStatefulWidget {
  const HistoryPage({super.key});

  @override
  ConsumerState<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends ConsumerState<HistoryPage> {
  int _version = 0;
  String? _loadingComicId;

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(historyRepositoryProvider);
    if (repo == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final items = [...repo.list()]..sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return Scaffold(
      appBar: AppBar(
        title: const Text('阅读历史'),
        actions: [
          if (items.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_rounded),
              tooltip: '清空历史',
              onPressed: () async {
                final ok = await _showConfirm(context);
                if (!ok) {
                  return;
                }
                await repo.clear();
                setState(() {
                  _version++;
                });
              },
            ),
        ],
      ),
      body: items.isEmpty
          ? const _EmptyView()
          : ListView.separated(
              key: ValueKey(_version),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final item = items[index];
                if (item.id.isEmpty) {
                  return const SizedBox.shrink();
                }
                final progressText = _progressText(item);
                final loading = _loadingComicId == item.id;
                return ListTile(
                  leading: _cover(item.cover),
                  title: Text(item.title?.isNotEmpty == true ? item.title! : '未命名'),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_typeText(item)),
                      if (progressText != null) Text(progressText),
                    ],
                  ),
                  trailing: loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.chevron_right),
                  onTap: loading ? null : () => _navigate(context, item),
                );
              },
            ),
    );
  }

  Future<void> _openComic(BuildContext context, HistoryItem item) async {
    final remote = ref.read(comicsRemoteServiceProvider);
    final sourceRepo = ref.read(sourceRepositoryProvider);
    final sourceId = item.source?.isNotEmpty == true ? item.source : sourceRepo?.currentSource();
    setState(() {
      _loadingComicId = item.id;
    });
    try {
      final detailData = await remote.fetchDetail(comicId: item.id, sourceId: sourceId);
      final chapters = detailData.chapters;
      if (chapters.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('未获取到章节')),
          );
        }
        return;
      }
      final targetChapterId = item.lastChapterId?.isNotEmpty == true ? item.lastChapterId! : chapters.first.id;
      final args = ComicReaderArgs(
        chapters: chapters,
        currentChapterId: targetChapterId,
        comicTitle: detailData.detail.title,
        sourceId: sourceId ?? detailData.detail.source,
      );
      if (!mounted) {
        return;
      }
      context.push('/comic/${item.id}/read', extra: args);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('跳转失败: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingComicId = null;
        });
      }
    }
  }

  static Future<bool> _showConfirm(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('确认清空历史?'),
          content: const Text('该操作不可恢复'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('取消'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('清空'),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  String _typeText(HistoryItem item) {
    switch (item.type) {
      case 'video':
        return '视频';
      case 'ebook':
        return '电子书';
      case 'novel':
        return '小说';
      default:
        return '漫画';
    }
  }

  String? _progressText(HistoryItem item) {
    switch (item.type) {
      case 'video':
        final ep = item.lastEpisodeId;
        final pos = item.lastPositionSeconds;
        final dur = item.lastDurationSeconds;
        if ((ep == null || ep.isEmpty) && (pos == null || dur == null)) {
          return null;
        }
        if (pos != null && dur != null) {
          return '上次观看: ${ep?.isNotEmpty == true ? ep : '未知剧集'} $pos/$dur 秒';
        }
        return '上次观看: ${ep?.isNotEmpty == true ? ep : '未知剧集'}';
      case 'novel':
        final ch = item.lastChapterId;
        final offset = item.scrollOffset;
        if ((ch == null || ch.isEmpty) && offset == null) {
          return null;
        }
        if (offset != null) {
          return '上次阅读: ${ch?.isNotEmpty == true ? ch : '未知章节'} 位置 ${offset.toStringAsFixed(0)}';
        }
        return '上次阅读: ${ch?.isNotEmpty == true ? ch : '未知章节'}';
      case 'ebook':
        final ch = item.lastChapterId;
        final page = item.lastPage;
        if ((ch == null || ch.isEmpty) && page == null) {
          return null;
        }
        if (page != null) {
          return '上次阅读: ${ch?.isNotEmpty == true ? ch : '未知章节'} 第 $page 页';
        }
        return '上次阅读: ${ch?.isNotEmpty == true ? ch : '未知章节'}';
      default:
        final ch = item.lastChapterId;
        final page = item.lastPage;
        if ((ch == null || ch.isEmpty) && page == null) {
          return null;
        }
        if (page != null) {
          return '上次阅读: 章节 ${ch?.isNotEmpty == true ? ch : '未知'} 第 $page 页';
        }
        return '上次阅读: 章节 ${ch?.isNotEmpty == true ? ch : '未知'}';
    }
  }

  Future<void> _navigate(BuildContext context, HistoryItem item) async {
    if (item.id.isEmpty) {
      return;
    }
    if (item.type == 'comic') {
      await _openComic(context, item);
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('该类型跳转待实现')),
    );
  }

  Widget _cover(String? url) {
    if (url == null || url.trim().isEmpty) {
      return const Icon(Icons.menu_book_outlined, size: 40);
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        url,
        width: 40,
        height: 56,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Icon(Icons.menu_book_outlined, size: 40),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.history, size: 64, color: Colors.grey),
          const SizedBox(height: 12),
          Text(
            '暂无阅读历史',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
