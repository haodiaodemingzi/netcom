import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/network/network_providers.dart';
import 'podcast_models.dart';
import 'data/podcast_remote_service.dart';
import 'audio_player_provider.dart';

/// 播客详情页
class PodcastDetailPage extends ConsumerStatefulWidget {
  const PodcastDetailPage({
    super.key,
    required this.podcastId,
    this.source,
  });

  final String podcastId;
  final String? source;

  @override
  ConsumerState<PodcastDetailPage> createState() => _PodcastDetailPageState();
}

class _PodcastDetailPageState extends ConsumerState<PodcastDetailPage> {
  PodcastDetail? _detail;
  List<PodcastEpisode> _episodes = [];
  bool _loading = true;
  String? _error;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    // 使用 ref 获取 apiClient
    final apiClient = ref.read(apiClientProvider);
    final remoteService = PodcastRemoteService(apiClient);

    try {
      // 并行加载详情和单集列表
      final detailFuture = remoteService.fetchDetail(widget.podcastId, widget.source);
      final episodesFuture = remoteService.fetchEpisodes(
        widget.podcastId,
        limit: 100,
        sourceId: widget.source,
      );

      final results = await Future.wait([detailFuture, episodesFuture]);

      if (mounted) {
        setState(() {
          _detail = results[0] as PodcastDetail?;
          final episodesResponse = results[1] as EpisodesResponse;
          _episodes = episodesResponse.episodes;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '加载失败: $e';
          _loading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final audioPlayerState = ref.watch(audioPlayerProvider);

    return Scaffold(
      body: _buildBody(audioPlayerState),
      bottomNavigationBar: audioPlayerState.hasEpisode
          ? MiniPlayer(
              podcastTitle: audioPlayerState.podcastTitle,
              episodeTitle: audioPlayerState.currentEpisode?.title,
              coverUrl: audioPlayerState.podcastCover,
              isPlaying: audioPlayerState.isPlaying,
              progress: audioPlayerState.progress,
              onPlayPause: () => ref.read(audioPlayerProvider.notifier).togglePlay(),
              onTap: () => _openFullPlayer(),
            )
          : null,
    );
  }

  Widget _buildBody(AudioPlayerStateModel audioPlayerState) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
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
              onPressed: _loadData,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_detail == null) {
      return const Center(child: Text('播客信息不存在'));
    }

    return CustomScrollView(
      controller: _scrollController,
      slivers: [
        _buildAppBar(),
        _buildHeader(),
        _buildActionButtons(),
        _buildEpisodeList(),
      ],
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      pinned: true,
      expandedHeight: 200,
      flexibleSpace: FlexibleSpaceBar(
        background: _detail?.cover.isNotEmpty == true
            ? CachedNetworkImage(
                imageUrl: _detail!.cover,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => const SizedBox.shrink(),
              )
            : Container(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: const Icon(
                  Icons.podcasts,
                  size: 64,
                  color: Colors.grey,
                ),
              ),
      ),
    );
  }

  Widget _buildHeader() {
    if (_detail == null) return const SliverToBoxAdapter(child: SizedBox.shrink());

    final detail = _detail!;
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              detail.title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            if (detail.author != null)
              Text(
                detail.author!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                    ),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                if (detail.playCount != null)
                  Tooltip(
                    message: '播放量',
                    child: Row(
                      children: [
                        const Icon(Icons.play_circle_outline, size: 16),
                        const SizedBox(width: 4),
                        Text(detail.playCount!, style: Theme.of(context).textTheme.bodySmall),
                        const SizedBox(width: 16),
                      ],
                    ),
                  ),
                Tooltip(
                  message: '集数',
                  child: Row(
                    children: [
                      const Icon(Icons.list_alt, size: 16),
                      const SizedBox(width: 4),
                      Text('${detail.episodes}集', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (detail.description?.isNotEmpty == true)
              Text(
                detail.description!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    final isCurrentPodcast = ref.read(audioPlayerProvider).podcastId == widget.podcastId;

    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            // 播放按钮
            Expanded(
              child: FilledButton.icon(
                onPressed: _episodes.isNotEmpty ? () => _playEpisode(0) : null,
                icon: const Icon(Icons.play_arrow_rounded),
                label: Text(isCurrentPodcast ? '继续播放' : '播放最新'),
              ),
            ),
            const SizedBox(width: 12),
            // 随机播放
            IconButton.filledTonal(
              onPressed: _episodes.isNotEmpty ? () => _playEpisode(_getRandomIndex()) : null,
              icon: const Icon(Icons.shuffle_rounded),
              tooltip: '随机播放',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEpisodeList() {
    if (_episodes.isEmpty) {
      return const SliverToBoxAdapter(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Text('暂无单集'),
          ),
        ),
      );
    }

    final audioPlayerState = ref.watch(audioPlayerProvider);
    final currentEpisodeId = audioPlayerState.currentEpisode?.id;

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final episode = _episodes[index];
          final isPlaying = currentEpisodeId == episode.id;
          final hasProgress = episode.progress > 0 && episode.progress < episode.duration;

          return ListTile(
            leading: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: isPlaying
                  ? Icon(
                      Icons.graphic_eq,
                      color: Theme.of(context).colorScheme.primary,
                    )
                  : Center(
                      child: Text(
                        '${episode.order}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
            ),
            title: Text(
              episode.title,
              style: TextStyle(
                fontWeight: isPlaying ? FontWeight.bold : FontWeight.normal,
                color: isPlaying ? Theme.of(context).colorScheme.primary : null,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Row(
              children: [
                Text(episode.formattedDuration),
                if (hasProgress) ...[
                  const SizedBox(width: 8),
                  const Icon(Icons.check_circle_outline, size: 12),
                  Text(
                    ' 已听',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
            trailing: IconButton(
              icon: const Icon(Icons.play_circle_outline),
              onPressed: () => _playEpisode(index),
            ),
            onTap: () => _playEpisode(index),
          );
        },
        childCount: _episodes.length,
      ),
    );
  }

  int _getRandomIndex() {
    if (_episodes.isEmpty) return 0;
    return DateTime.now().millisecondsSinceEpoch % _episodes.length;
  }

  Future<void> _playEpisode(int index) async {
    final detail = _detail;

    if (detail == null) return;

    // 先播放，然后跳转到播放器页面
    await ref.read(audioPlayerProvider.notifier).playPodcast(
          podcastId: widget.podcastId,
          podcastTitle: detail.title,
          podcastCover: detail.cover,
          source: widget.source,
          episodeIndex: index,
        );

    // 跳转到播放器页面
    if (!mounted) return;
    context.push(
      '/podcast-player',
      extra: {
        'podcastId': widget.podcastId,
        'podcastTitle': detail.title,
        'podcastCover': detail.cover,
        'episodeIndex': index,
        'source': widget.source,
      },
    );
  }

  void _openFullPlayer() {
    context.push('/podcast-player');
  }
}

/// 迷你播放器组件
class MiniPlayer extends ConsumerWidget {
  const MiniPlayer({
    super.key,
    this.podcastTitle,
    this.episodeTitle,
    this.coverUrl,
    this.isPlaying = false,
    this.progress = 0.0,
    required this.onPlayPause,
    required this.onTap,
  });

  final String? podcastTitle;
  final String? episodeTitle;
  final String? coverUrl;
  final bool isPlaying;
  final double progress;
  final VoidCallback onPlayPause;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 进度条
          LinearProgressIndicator(
            value: progress,
            minHeight: 2,
            backgroundColor: Colors.transparent,
          ),
          SizedBox(
            height: 64,
            child: Row(
              children: [
                // 封面
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      image: coverUrl != null && coverUrl!.isNotEmpty
                          ? DecorationImage(
                              image: CachedNetworkImageProvider(coverUrl!),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: coverUrl == null || coverUrl!.isEmpty
                        ? const Icon(Icons.podcasts, color: Colors.grey)
                        : null,
                  ),
                ),

                // 标题
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        podcastTitle ?? '',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        episodeTitle ?? '',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                // 播放/暂停按钮
                IconButton(
                  icon: Icon(isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded),
                  onPressed: onPlayPause,
                  iconSize: 28,
                ),

                // 关闭按钮
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => ref.read(audioPlayerProvider.notifier).stop(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
