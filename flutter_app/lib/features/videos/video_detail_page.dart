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
                      TextButton.icon(
                        onPressed: () => _downloadSelected(detail, currentGroup, downloadNotifier),
                        icon: const Icon(Icons.download),
                        label: const Text('下载已选'),
                      ),
                      IconButton(
                        icon: Icon(_episodesReversed ? Icons.arrow_upward : Icons.arrow_downward),
                        onPressed: _toggleEpisodeOrder,
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
                          const Spacer(),
                          Text(
                            '已选 ${_selectedEpisodeIds.length}',
                            style: Theme.of(context).textTheme.bodySmall,
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
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 2,
                ),
                delegate: SliverChildBuilderDelegate(
                  (ctx, index) {
                    final episode = currentGroup[index];
                    final selected = _selectedEpisodeIds.contains(episode.id);
                    final status = _resolveDownloadStatus(episode, downloadState);
                    final localPath = _resolveLocalPath(episode, downloadState);
                    return OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: selected ? colorScheme.primary : colorScheme.outlineVariant),
                        backgroundColor: selected ? colorScheme.primary.withOpacity(0.08) : null,
                      ),
                      onPressed: () => _playEpisode(episode),
                      onLongPress: () {
                        setState(() {
                          if (selected) {
                            _selectedEpisodeIds.remove(episode.id);
                          } else {
                            _selectedEpisodeIds.add(episode.id);
                          }
                        });
                      },
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            episode.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12),
                          ),
                          const SizedBox(height: 4),
                          if (status.isNotEmpty)
                            Text(
                              status,
                              style: TextStyle(
                                fontSize: 11,
                                color: _statusColor(status, colorScheme),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          if (localPath != null && localPath.isNotEmpty)
                            const Text(
                              '离线可播',
                              style: TextStyle(fontSize: 11, color: Colors.green),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.download, size: 18),
                                color: colorScheme.primary,
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                onPressed: () => _downloadSingle(detail, episode, downloadNotifier),
                              ),
                            ],
                          ),
                        ],
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
    final ids = _selectedEpisodeIds.isEmpty ? currentGroup.map((e) => e.id).toSet() : _selectedEpisodeIds;
    final episodes = currentGroup.where((e) => ids.contains(e.id)).toList();
    if (episodes.isEmpty) {
      return;
    }
    notifier.enqueueVideoEpisodes(detail: detail, episodes: episodes);
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
