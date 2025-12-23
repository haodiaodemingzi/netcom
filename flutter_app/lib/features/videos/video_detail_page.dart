import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'video_models.dart';
import 'video_detail_provider.dart';
import '../downloads/download_center_provider.dart';
import '../downloads/download_models.dart';

class VideoDetailPage extends ConsumerStatefulWidget {
  const VideoDetailPage({
    super.key,
    required this.videoId,
    this.source,
  });

  final String videoId;
  final String? source;

  @override
  ConsumerState<VideoDetailPage> createState() => _VideoDetailPageState();
}

class _VideoDetailPageState extends ConsumerState<VideoDetailPage> {
  bool _episodesReversed = false;
  bool _descExpanded = false;
  int _groupIndex = 0;
  final Set<String> _selectedEpisodeIds = <String>{};
  bool _isBulkMode = false;

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    super.dispose();
  }


  void _toggleEpisodeOrder() {
    setState(() {
      _episodesReversed = !_episodesReversed;
    });
  }

  Future<void> _playEpisode(VideoEpisode episode) async {
    final args = VideoDetailRequest(videoId: widget.videoId, source: widget.source);
    final notifier = ref.read(videoDetailProvider(args).notifier);
    await notifier.selectEpisode(episode);
    final state = ref.read(videoDetailProvider(args));
    
    if (!mounted) return;
    
    context.push(
      '/video-player',
      extra: {
        'videoId': widget.videoId,
        'source': widget.source,
        'episodeId': episode.id,
        'episodes': state.episodes,
        'localPaths': _buildLocalPathMap(),
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

  @override
  Widget build(BuildContext context) {
    final args = VideoDetailRequest(videoId: widget.videoId, source: widget.source);
    final state = ref.watch(videoDetailProvider(args));
    final notifier = ref.read(videoDetailProvider(args).notifier);
    final downloadState = ref.watch(downloadCenterProvider);
    final downloadNotifier = ref.read(downloadCenterProvider.notifier);
    final colorScheme = Theme.of(context).colorScheme;

    if (state.loading) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (state.error != null) {
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
        body: const Center(child: Text('视频不存在')),
      );
    }

    final episodes = _episodesReversed ? state.episodes.reversed.toList() : state.episodes;
    final grouped = _groupEpisodes(episodes, size: 50);
    final currentGroup = grouped.isEmpty ? <VideoEpisode>[] : grouped[_groupIndex.clamp(0, grouped.length - 1)];

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: SizedBox(
              height: 220,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: detail.cover.isNotEmpty
                        ? Image.network(
                            detail.cover,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(color: Colors.black),
                          )
                        : Container(color: Colors.black),
                  ),
                  Positioned.fill(
                    child: Container(
                      color: Colors.black.withOpacity(0.3),
                      child: Center(
                        child: IconButton(
                          icon: const Icon(Icons.play_circle_filled, size: 64, color: Colors.white),
                          onPressed: () {
                            if (episodes.isNotEmpty) {
                              _playEpisode(episodes.first);
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      onPressed: () => context.pop(),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton(
                      icon: Icon(
                        state.isFavorite ? Icons.favorite : Icons.favorite_border,
                        color: Colors.white,
                      ),
                      onPressed: notifier.toggleFavorite,
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail.title,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  if (detail.rating != null)
                    Row(
                      children: [
                        const Icon(Icons.star, color: Colors.amber, size: 20),
                        const SizedBox(width: 4),
                        Text(
                          detail.rating!.toStringAsFixed(1),
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  const SizedBox(height: 8),
                  if (detail.status != null && detail.status!.isNotEmpty)
                    Text(
                      detail.status!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colorScheme.primary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  const SizedBox(height: 8),
                  if (detail.area != null || detail.year != null)
                    Text(
                      [detail.area, detail.year].where((e) => e != null && e.isNotEmpty).join(' · '),
                      style: Theme.of(context).textTheme.bodyMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  const SizedBox(height: 12),
                  if (detail.tags.isNotEmpty)
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: detail.tags.map((tag) {
                        final colorScheme = Theme.of(context).colorScheme;
                        return Chip(
                          label: Text(
                            tag,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: colorScheme.onSurface,
                            ),
                          ),
                          backgroundColor: Colors.white,
                          side: BorderSide(color: colorScheme.primary.withOpacity(0.2)),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        );
                      }).toList(),
                    ),
                  const SizedBox(height: 12),
                  if (detail.actors.isNotEmpty) ...[
                    Text('主演', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(detail.actors.join(', '), style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 12),
                  ],
                  ..._buildDescriptionSection(detail.description),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        '剧集 (${state.episodes.length})',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const Spacer(),
                      if (_isBulkMode && _selectedEpisodeIds.isNotEmpty) ...[
                        TextButton(
                          onPressed: () => _downloadSelected(detail, currentGroup, downloadNotifier),
                          child: Text('下载 ${_selectedEpisodeIds.length}'),
                        ),
                        TextButton(
                          onPressed: () => _pauseSelected(currentGroup, downloadNotifier),
                          child: const Text('暂停已选'),
                        ),
                        TextButton(
                          onPressed: () => _cancelSelected(currentGroup, downloadNotifier),
                          child: const Text('取消已选'),
                        ),
                      ] else if (_isBulkMode) ...[
                        TextButton(
                          onPressed: _exitBulkMode,
                          child: const Text('退出批量'),
                        ),
                      ] else
                        TextButton(
                          onPressed: _enterBulkMode,
                          child: const Text('批量选择'),
                        ),
                      TextButton(
                        onPressed: _toggleEpisodeOrder,
                        child: Text(_episodesReversed ? '倒序' : '正序'),
                      ),
                    ],
                  ),
                  if (grouped.length > 1)
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: List.generate(grouped.length, (index) {
                          final start = index * 50 + 1;
                          final end = (index + 1) * 50 > state.episodes.length ? state.episodes.length : (index + 1) * 50;
                          final selected = _groupIndex == index;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text('$start-$end'),
                              selected: selected,
                              onSelected: (_) {
                                setState(() {
                                  _groupIndex = index;
                                });
                              },
                              visualDensity: VisualDensity.compact,
                            ),
                          );
                        }),
                      ),
                    ),
                  if (currentGroup.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _selectedEpisodeIds.addAll(currentGroup.map((e) => e.id));
                              });
                            },
                            child: const Text('全选本组'),
                          ),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _selectedEpisodeIds.removeWhere((id) => currentGroup.any((e) => e.id == id));
                              });
                            },
                            child: const Text('清空本组'),
                          ),
                          if (_selectedEpisodeIds.isNotEmpty)
                            TextButton(
                              onPressed: () {
                                setState(() {
                                  _selectedEpisodeIds.clear();
                                });
                              },
                              child: const Text('清空所有'),
                            ),
                          const Spacer(),
                          if (_selectedEpisodeIds.isNotEmpty)
                            Text(
                              '已选 ${_selectedEpisodeIds.length}',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colorScheme.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (episodes.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: Text('暂无剧集')),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, index) {
                    final episode = currentGroup[index];
                    final selected = _selectedEpisodeIds.contains(episode.id);
                    final status = _resolveDownloadStatus(episode, downloadState);
                    final localPath = _resolveLocalPath(episode, downloadState);
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(
                        side: BorderSide(color: selected ? colorScheme.primary : colorScheme.outlineVariant),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => _playEpisode(episode),
                        onLongPress: () {
                          setState(() {
                            if (selected) {
                              _selectedEpisodeIds.remove(episode.id);
                            } else {
                              _selectedEpisodeIds.add(episode.id);
                            }
                          });
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          child: Row(
                            children: [
                              if (_isBulkMode)
                                Checkbox(
                                  value: selected,
                                  onChanged: (_) {
                                    setState(() {
                                      if (selected) {
                                        _selectedEpisodeIds.remove(episode.id);
                                      } else {
                                        _selectedEpisodeIds.add(episode.id);
                                      }
                                    });
                                  },
                                )
                              else
                                const SizedBox(width: 0),
                              IconButton(
                                icon: const Icon(Icons.play_circle_fill),
                                color: colorScheme.primary,
                                onPressed: () => _playEpisode(episode),
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      episode.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: selected ? colorScheme.primary : null,
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
                                        if (localPath != null && localPath.isNotEmpty) ...[
                                          const SizedBox(width: 8),
                                          const Icon(Icons.offline_pin, size: 14, color: Colors.green),
                                          const SizedBox(width: 2),
                                          const Text(
                                            '离线',
                                            style: TextStyle(fontSize: 12, color: Colors.green),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              if (!selected)
                                IconButton(
                                  icon: const Icon(Icons.download_rounded),
                                  color: colorScheme.primary,
                                  onPressed: () => _downloadSingle(detail, episode, downloadNotifier),
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                  childCount: currentGroup.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  List<List<VideoEpisode>> _groupEpisodes(List<VideoEpisode> list, {required int size}) {
    if (list.isEmpty || size <= 0) {
      return <List<VideoEpisode>>[];
    }
    final grouped = <List<VideoEpisode>>[];
    for (var i = 0; i < list.length; i += size) {
      final end = (i + size) > list.length ? list.length : (i + size);
      grouped.add(list.sublist(i, end));
    }
    return grouped;
  }

  void _downloadSelected(
    VideoDetail detail,
    List<VideoEpisode> currentGroup,
    DownloadCenterNotifier notifier,
  ) {
    if (_selectedEpisodeIds.isEmpty) {
      return;
    }
    final episodes = currentGroup.where((e) => _selectedEpisodeIds.contains(e.id)).toList();
    if (episodes.isEmpty) {
      return;
    }
    notifier.enqueueVideoEpisodes(detail: detail, episodes: episodes);
    setState(() {
      _selectedEpisodeIds.clear();
      _isBulkMode = false;
    });
  }

  void _downloadAll(
    VideoDetail detail,
    List<VideoEpisode> allEpisodes,
    DownloadCenterNotifier notifier,
  ) {
    if (allEpisodes.isEmpty) {
      return;
    }
    notifier.enqueueVideoEpisodes(detail: detail, episodes: allEpisodes);
  }

  void _downloadSingle(
    VideoDetail detail,
    VideoEpisode episode,
    DownloadCenterNotifier notifier,
  ) {
    if (episode.id.isEmpty) {
      return;
    }
    notifier.enqueueVideoEpisodes(detail: detail, episodes: [episode]);
  }

  void _pauseSelected(
    List<VideoEpisode> currentGroup,
    DownloadCenterNotifier notifier,
  ) {
    if (_selectedEpisodeIds.isEmpty) {
      return;
    }
    final ids = currentGroup.where((e) => _selectedEpisodeIds.contains(e.id)).map((e) => e.id).toSet();
    if (ids.isEmpty) {
      return;
    }
    notifier.pauseVideosByResourceIds(ids);
  }

  void _cancelSelected(
    List<VideoEpisode> currentGroup,
    DownloadCenterNotifier notifier,
  ) {
    if (_selectedEpisodeIds.isEmpty) {
      return;
    }
    final ids = currentGroup.where((e) => _selectedEpisodeIds.contains(e.id)).map((e) => e.id).toSet();
    if (ids.isEmpty) {
      return;
    }
    notifier.cancelVideosByResourceIds(ids);
    setState(() {
      _selectedEpisodeIds.removeWhere(ids.contains);
    });
  }

  void _enterBulkMode() {
    setState(() {
      _isBulkMode = true;
      _selectedEpisodeIds.clear();
    });
  }

  void _exitBulkMode() {
    setState(() {
      _isBulkMode = false;
      _selectedEpisodeIds.clear();
    });
  }

  String _resolveDownloadStatus(VideoEpisode episode, DownloadCenterState downloadState) {
    final queueItem = downloadState.queue.firstWhere(
      (e) => e.type == DownloadType.video && e.resourceId == episode.id,
      orElse: () => DownloadItem(
        id: '',
        type: DownloadType.video,
        kind: 'task',
        title: '',
        parentTitle: '',
        status: DownloadStatus.pending,
      ),
    );
    if (queueItem.id.isNotEmpty) {
      switch (queueItem.status) {
        case DownloadStatus.pending:
          return '待下载';
        case DownloadStatus.downloading:
          final percent = (queueItem.progress * 100).toInt();
          return '下载中 $percent%';
        case DownloadStatus.paused:
          return '已暂停';
        case DownloadStatus.failed:
          return '失败';
        case DownloadStatus.completed:
          return '已完成';
      }
    }
    final done = downloadState.completed.firstWhere(
      (e) => e.type == DownloadType.video && e.resourceId == episode.id,
      orElse: () => DownloadItem(
        id: '',
        type: DownloadType.video,
        kind: 'downloaded',
        title: '',
        parentTitle: '',
        status: DownloadStatus.completed,
      ),
    );
    return done.id.isNotEmpty ? '已完成' : '';
  }

  String? _resolveLocalPath(VideoEpisode episode, DownloadCenterState downloadState) {
    final completed = downloadState.completed.firstWhere(
      (e) => e.type == DownloadType.video && e.resourceId == episode.id,
      orElse: () => DownloadItem(
        id: '',
        type: DownloadType.video,
        kind: 'downloaded',
        title: '',
        parentTitle: '',
        status: DownloadStatus.completed,
      ),
    );
    final path = completed.metadata?['localPath'] as String?;
    if (path != null && path.isNotEmpty) {
      return path;
    }
    return null;
  }

  Map<String, String> _buildLocalPathMap() {
    final downloadState = ref.read(downloadCenterProvider);
    final map = <String, String>{};
    for (final item in downloadState.completed) {
      if (item.type != DownloadType.video) {
        continue;
      }
      final path = item.metadata?['localPath'] as String?;
      if (item.resourceId != null && item.resourceId!.isNotEmpty && path != null && path.isNotEmpty) {
        map[item.resourceId!] = path;
      }
    }
    return map;
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
}
