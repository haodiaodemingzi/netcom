import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import 'video_models.dart';
import 'video_detail_provider.dart';

class VideoPlayerPage extends ConsumerStatefulWidget {
  const VideoPlayerPage({
    super.key,
    required this.videoId,
    required this.episodeId,
    required this.episodes,
    this.source,
    this.coverUrl,
  });

  final String videoId;
  final String episodeId;
  final List<VideoEpisode> episodes;
  final String? source;
  final String? coverUrl;

  @override
  ConsumerState<VideoPlayerPage> createState() => _VideoPlayerPageState();
}

class _VideoPlayerPageState extends ConsumerState<VideoPlayerPage> {
  late Player _player;
  late VideoController _controller;
  bool _showControls = true;
  bool _isFullscreen = false;
  double _playbackSpeed = 1.0;
  String? _currentEpisodeId;

  @override
  void initState() {
    super.initState();
    _currentEpisodeId = widget.episodeId;
    _player = Player();
    _controller = VideoController(_player);
    _loadEpisode(_currentEpisodeId!);
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _loadEpisode(String episodeId) async {
    final episode = widget.episodes.firstWhere((e) => e.id == episodeId, orElse: () => const VideoEpisode(id: '', title: '', index: 0));
    if (episode.id.isEmpty) {
      return;
    }
    final args = VideoDetailRequest(videoId: widget.videoId, source: widget.source);
    await ref.read(videoDetailProvider(args).notifier).selectEpisode(episode);
    final state = ref.read(videoDetailProvider(args));
    if (state.playSource != null && state.playSource!.url.isNotEmpty) {
      await _player.open(Media(state.playSource!.url));
      await _player.play();
    }
  }

  void _toggleFullscreen() {
    setState(() {
      _isFullscreen = !_isFullscreen;
    });
    if (_isFullscreen) {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
    } else {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    }
  }

  void _changeSpeed(double speed) {
    setState(() {
      _playbackSpeed = speed;
    });
    _player.setRate(speed);
  }

  void _playNext() {
    if (_currentEpisodeId == null) {
      return;
    }
    final currentIndex = widget.episodes.indexWhere((e) => e.id == _currentEpisodeId);
    if (currentIndex == -1 || currentIndex >= widget.episodes.length - 1) {
      return;
    }
    final nextEpisode = widget.episodes[currentIndex + 1];
    setState(() {
      _currentEpisodeId = nextEpisode.id;
    });
    _loadEpisode(nextEpisode.id);
  }

  void _playPrevious() {
    if (_currentEpisodeId == null) {
      return;
    }
    final currentIndex = widget.episodes.indexWhere((e) => e.id == _currentEpisodeId);
    if (currentIndex <= 0) {
      return;
    }
    final prevEpisode = widget.episodes[currentIndex - 1];
    setState(() {
      _currentEpisodeId = prevEpisode.id;
    });
    _loadEpisode(prevEpisode.id);
  }

  @override
  Widget build(BuildContext context) {
    final args = VideoDetailRequest(videoId: widget.videoId, source: widget.source);
    final state = ref.watch(videoDetailProvider(args));
    final currentEpisode = widget.episodes.firstWhere(
      (e) => e.id == _currentEpisodeId,
      orElse: () => const VideoEpisode(id: '', title: '', index: 0),
    );

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if ((widget.coverUrl ?? '').isNotEmpty)
                      Image.network(
                        widget.coverUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(color: Colors.black),
                      )
                    else
                      Container(color: Colors.black),
                    if (state.loadingPlaySource)
                      const Center(child: CircularProgressIndicator())
                    else if (state.playSource == null || state.playSource!.url.isEmpty)
                      Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline, color: Colors.white70),
                            const SizedBox(height: 8),
                            const Text('无法获取播放地址', style: TextStyle(color: Colors.white70)),
                            const SizedBox(height: 12),
                            OutlinedButton(
                              onPressed: () => _loadEpisode(_currentEpisodeId ?? widget.episodeId),
                              child: const Text('重试', style: TextStyle(color: Colors.white)),
                            ),
                          ],
                        ),
                      )
                    else
                      Video(
                        controller: _controller,
                        controls: NoVideoControls,
                      ),
                  ],
                ),
              ),
            ),
            if (_showControls)
              Positioned.fill(
                child: GestureDetector(
                  onTap: () {
                    setState(() {
                      _showControls = !_showControls;
                    });
                  },
                  child: Container(
                    color: Colors.black.withOpacity(0.35),
                    child: Column(
                      children: [
                        AppBar(
                          backgroundColor: Colors.transparent,
                          elevation: 0,
                          title: Text(
                            currentEpisode.title,
                            style: const TextStyle(color: Colors.white),
                          ),
                          iconTheme: const IconThemeData(color: Colors.white),
                          actions: [
                            PopupMenuButton<double>(
                              icon: const Icon(Icons.speed, color: Colors.white),
                              onSelected: _changeSpeed,
                              itemBuilder: (ctx) => [
                                const PopupMenuItem(value: 0.5, child: Text('0.5x')),
                                const PopupMenuItem(value: 0.75, child: Text('0.75x')),
                                const PopupMenuItem(value: 1.0, child: Text('1.0x')),
                                const PopupMenuItem(value: 1.25, child: Text('1.25x')),
                                const PopupMenuItem(value: 1.5, child: Text('1.5x')),
                                const PopupMenuItem(value: 2.0, child: Text('2.0x')),
                              ],
                            ),
                            IconButton(
                              icon: Icon(_isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen, color: Colors.white),
                              onPressed: _toggleFullscreen,
                            ),
                          ],
                        ),
                        const Spacer(),
                        StreamBuilder<Duration>(
                          stream: _player.stream.position,
                          builder: (ctx, snapshot) {
                            final position = snapshot.data ?? Duration.zero;
                            final duration = _player.state.duration;
                            return Column(
                              children: [
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  child: Row(
                                    children: [
                                      Text(
                                        _formatDuration(position),
                                        style: const TextStyle(color: Colors.white),
                                      ),
                                      Expanded(
                                        child: Slider(
                                          value: position.inMilliseconds.toDouble(),
                                          max: duration.inMilliseconds.toDouble().clamp(1.0, double.infinity),
                                          onChanged: (value) {
                                            _player.seek(Duration(milliseconds: value.toInt()));
                                          },
                                        ),
                                      ),
                                      Text(
                                        _formatDuration(duration),
                                        style: const TextStyle(color: Colors.white),
                                      ),
                                    ],
                                  ),
                                ),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.skip_previous, color: Colors.white, size: 32),
                                      onPressed: _playPrevious,
                                    ),
                                    const SizedBox(width: 16),
                                    StreamBuilder<bool>(
                                      stream: _player.stream.playing,
                                      builder: (ctx, snapshot) {
                                        final playing = snapshot.data ?? false;
                                        return IconButton(
                                          icon: Icon(
                                            playing ? Icons.pause : Icons.play_arrow,
                                            color: Colors.white,
                                            size: 48,
                                          ),
                                          onPressed: () {
                                            if (playing) {
                                              _player.pause();
                                            } else {
                                              _player.play();
                                            }
                                          },
                                        );
                                      },
                                    ),
                                    const SizedBox(width: 16),
                                    IconButton(
                                      icon: const Icon(Icons.skip_next, color: Colors.white, size: 32),
                                      onPressed: _playNext,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                              ],
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }
}
