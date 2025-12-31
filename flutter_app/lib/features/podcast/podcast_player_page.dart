import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'audio_player_provider.dart';

/// 播客播放器页面
class PodcastPlayerPage extends ConsumerStatefulWidget {
  const PodcastPlayerPage({
    super.key,
    this.podcastId,
    this.podcastTitle,
    this.podcastCover,
    this.episodeIndex = 0,
    this.source,
  });

  final String? podcastId;
  final String? podcastTitle;
  final String? podcastCover;
  final int episodeIndex;
  final String? source;

  @override
  ConsumerState<PodcastPlayerPage> createState() => _PodcastPlayerPageState();
}

class _PodcastPlayerPageState extends ConsumerState<PodcastPlayerPage> with SingleTickerProviderStateMixin {
  late AnimationController _rotateController;
  bool _isDragging = false;
  double _dragValue = 0.0;

  @override
  void initState() {
    super.initState();
    _rotateController = AnimationController(
      duration: const Duration(seconds: 20),
      vsync: this,
    );

    // 自动播放
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _ensurePlaying();
    });
  }

  @override
  void dispose() {
    _rotateController.dispose();
    super.dispose();
  }

  Future<void> _ensurePlaying() async {
    final audioPlayerState = ref.read(audioPlayerProvider);

    // 如果已经在播放当前播客，就不重新加载
    if (audioPlayerState.podcastId == widget.podcastId && audioPlayerState.hasEpisode) {
      return;
    }

    if (widget.podcastId != null && widget.podcastId!.isNotEmpty) {
      await ref.read(audioPlayerProvider.notifier).playPodcast(
            podcastId: widget.podcastId!,
            podcastTitle: widget.podcastTitle ?? '',
            podcastCover: widget.podcastCover,
            source: widget.source,
            episodeIndex: widget.episodeIndex,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(audioPlayerProvider);

    // 监听播放状态，控制封面旋转
    if (state.isPlaying) {
      _rotateController.repeat();
    } else {
      _rotateController.stop();
    }

    return Scaffold(
      body: Stack(
        children: [
          // 背景模糊
          _buildBackground(state.podcastCover),

          // 主内容
          SafeArea(
            child: Column(
              children: [
                // 顶部栏
                _buildTopBar(),

                // 中间内容
                Expanded(
                  child: _buildContent(state),
                ),

                // 底部控制
                _buildControls(state),
              ],
            ),
          ),

          // 加载指示器
          if (state.isLoading)
            Container(
              color: Colors.black54,
              child: const Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }

  Widget _buildBackground(String? coverUrl) {
    return Container(
      decoration: BoxDecoration(
        image: coverUrl != null && coverUrl.isNotEmpty
            ? DecorationImage(
                image: NetworkImage(coverUrl),
                fit: BoxFit.cover,
                colorFilter: ColorFilter.mode(
                  Colors.black.withValues(alpha: 0.6),
                  BlendMode.darken,
                ),
              )
            : null,
      ),
    );
  }

  Widget _buildTopBar() {
    final state = ref.watch(audioPlayerProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 32),
            onPressed: () => context.pop(),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '正在播放',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Colors.white70,
                      ),
                ),
                Text(
                  state.podcastTitle ?? widget.podcastTitle ?? '',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(AudioPlayerStateModel state) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // 封面
        _buildCover(state),

        const SizedBox(height: 32),

        // 标题
        _buildTitle(state),

        const SizedBox(height: 16),

        // 进度条
        _buildProgressBar(state),
      ],
    );
  }

  Widget _buildCover(AudioPlayerStateModel state) {
    final coverUrl = state.podcastCover ?? widget.podcastCover;

    return Center(
      child: RotationTransition(
        turns: Tween(begin: 0.0, end: 1.0).animate(_rotateController),
        child: Container(
          width: 280,
          height: 280,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 20,
                spreadRadius: 5,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: coverUrl != null && coverUrl.isNotEmpty
                ? Image.network(
                    coverUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _buildPlaceholder(),
                  )
                : _buildPlaceholder(),
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: const Icon(
        Icons.podcasts,
        size: 100,
        color: Colors.grey,
      ),
    );
  }

  Widget _buildTitle(AudioPlayerStateModel state) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          Text(
            state.currentEpisode?.title ?? '暂无播放',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (state.currentEpisode != null) ...[
            const SizedBox(height: 8),
            Text(
              state.currentEpisode!.formattedDuration,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white70,
                  ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildProgressBar(AudioPlayerStateModel state) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          // 进度条
          StatefulBuilder(
            builder: (context, setState) {
              return SliderTheme(
                data: SliderThemeData(
                  trackHeight: 4,
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 8,
                  ),
                  overlayShape: const RoundSliderOverlayShape(
                    overlayRadius: 16,
                  ),
                ),
                child: Slider(
                  value: _isDragging ? _dragValue : state.progress,
                  onChangeStart: (_) {
                    setState(() {
                      _isDragging = true;
                    });
                  },
                  onChanged: (value) {
                    setState(() {
                      _dragValue = value;
                    });
                  },
                  onChangeEnd: (value) {
                    ref.read(audioPlayerProvider.notifier).seekToProgress(value);
                    setState(() {
                      _isDragging = false;
                    });
                  },
                  activeColor: Theme.of(context).colorScheme.primary,
                  inactiveColor: Colors.white24,
                ),
              );
            },
          ),

          // 时间显示
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  state.formattedPosition,
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
                Text(
                  state.formattedDuration,
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControls(AudioPlayerStateModel state) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.transparent,
            Colors.black.withValues(alpha: 0.8),
          ],
        ),
      ),
      child: Column(
        children: [
          // 播放模式与速度
          _buildExtraControls(state),

          const SizedBox(height: 16),

          // 主要控制
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // 播放模式
              IconButton(
                icon: Icon(_getModeIcon(state.playbackMode)),
                color: Colors.white,
                onPressed: () {
                  final modes = PlaybackMode.values;
                  final currentIndex = modes.indexOf(state.playbackMode);
                  final nextIndex = (currentIndex + 1) % modes.length;
                  ref.read(audioPlayerProvider.notifier).setPlaybackMode(modes[nextIndex]);
                },
              ),

              // 上一集
              IconButton(
                icon: const Icon(Icons.skip_previous_rounded, size: 36),
                color: Colors.white,
                onPressed: state.playlist.length > 1
                    ? () => ref.read(audioPlayerProvider.notifier).playPrevious()
                    : null,
              ),

              // 播放/暂停
              FloatingActionButton.large(
                onPressed: () => ref.read(audioPlayerProvider.notifier).togglePlay(),
                backgroundColor: Theme.of(context).colorScheme.primary,
                child: Icon(
                  state.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  size: 40,
                ),
              ),

              // 下一集
              IconButton(
                icon: const Icon(Icons.skip_next_rounded, size: 36),
                color: Colors.white,
                onPressed: state.playlist.length > 1
                    ? () => ref.read(audioPlayerProvider.notifier).playNext()
                    : null,
              ),

              // 播放速度
              IconButton(
                icon: Text(
                  '${state.playbackRate}x',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                onPressed: () => _showSpeedSelector(context, ref, state),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildExtraControls(AudioPlayerStateModel state) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // 播放模式指示
        Text(
          _getModeText(state.playbackMode),
          style: const TextStyle(color: Colors.white70, fontSize: 12),
        ),
        const Spacer(),
      ],
    );
  }

  IconData _getModeIcon(PlaybackMode mode) {
    switch (mode) {
      case PlaybackMode.sequence:
        return Icons.repeat;
      case PlaybackMode.single:
        return Icons.repeat_one;
      case PlaybackMode.shuffle:
        return Icons.shuffle;
    }
  }

  String _getModeText(PlaybackMode mode) {
    switch (mode) {
      case PlaybackMode.sequence:
        return '顺序播放';
      case PlaybackMode.single:
        return '单曲循环';
      case PlaybackMode.shuffle:
        return '随机播放';
    }
  }

  void _showSpeedSelector(BuildContext context, WidgetRef ref, AudioPlayerStateModel state) {
    final speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (ctx) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: speeds.map((speed) {
              return ListTile(
                title: Text(
                  '${speed}x',
                  style: TextStyle(
                    fontWeight: speed == state.playbackRate ? FontWeight.bold : FontWeight.normal,
                    color: speed == state.playbackRate ? Theme.of(context).colorScheme.primary : null,
                  ),
                ),
                trailing: speed == state.playbackRate ? const Icon(Icons.check_rounded) : null,
                onTap: () {
                  ref.read(audioPlayerProvider.notifier).setPlaybackRate(speed);
                  Navigator.of(ctx).pop();
                },
              );
            }).toList(),
          ),
        );
      },
    );
  }
}
