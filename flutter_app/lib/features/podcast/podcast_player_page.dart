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

                // 播放列表
                if (state.playlist.isNotEmpty)
                  _buildPlaylist(state),

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

          // 错误提示
          if (state.errorMessage != null)
            Positioned(
              top: 80,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  state.errorMessage!,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
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
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 封面旋转
          RotationTransition(
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
                        errorBuilder: (_, _, _) => _buildPlaceholder(),
                      )
                    : _buildPlaceholder(),
              ),
            ),
          ),

          // 加载动画叠加层
          if (state.isLoading)
            Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: Colors.black.withValues(alpha: 0.5),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(
                    width: 50,
                    height: 50,
                    child: CircularProgressIndicator(
                      strokeWidth: 3,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    '加载中...',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
        ],
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
              // 上一集
              _buildTextButton(
                '上一集',
                state.playlist.length > 1,
                onPressed: () => ref.read(audioPlayerProvider.notifier).playPrevious(),
              ),

              // 播放/暂停
              SizedBox(
                width: 90,
                height: 56,
                child: ElevatedButton(
                  onPressed: () => ref.read(audioPlayerProvider.notifier).togglePlay(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Colors.white,
                    textStyle: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28),
                    ),
                  ),
                  child: Text(state.isPlaying ? '暂停' : '播放'),
                ),
              ),

              // 下一集
              _buildTextButton(
                '下一集',
                state.playlist.length > 1,
                onPressed: () => ref.read(audioPlayerProvider.notifier).playNext(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTextButton(String text, bool enabled, {required VoidCallback onPressed}) {
    return TextButton(
      onPressed: enabled ? onPressed : null,
      style: TextButton.styleFrom(
        foregroundColor: Colors.white,
        textStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      child: Text(text),
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

  /// 构建播放列表
  Widget _buildPlaylist(AudioPlayerStateModel state) {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.5),
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      child: Column(
        children: [
          // 列表标题
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Text(
                  '播放列表 (${state.playlist.length})',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                Text(
                  '当前第 ${state.currentIndex + 1} 集',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),

          // 列表内容
          Expanded(
            child: ListView.builder(
              itemCount: state.playlist.length,
              itemBuilder: (context, index) {
                final episode = state.playlist[index];
                final isCurrent = index == state.currentIndex;

                return ListTile(
                  dense: true,
                  leading: isCurrent
                      ? Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.play_arrow,
                            color: Colors.white,
                            size: 16,
                          ),
                        )
                      : Text(
                          '${index + 1}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.5),
                            fontSize: 14,
                          ),
                        ),
                  title: Text(
                    episode.title,
                    style: TextStyle(
                      color: isCurrent ? Theme.of(context).colorScheme.primary : Colors.white,
                      fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    episode.formattedDuration,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.5),
                      fontSize: 11,
                    ),
                  ),
                  onTap: () {
                    if (index != state.currentIndex) {
                      ref.read(audioPlayerProvider.notifier).playAtIndex(index);
                    }
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
