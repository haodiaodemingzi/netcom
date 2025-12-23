import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import 'video_models.dart';
import 'video_detail_provider.dart';
import 'widgets/custom_video_controls.dart';

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
  VideoPlayerController? _videoPlayerController;
  String? _currentEpisodeId;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _currentEpisodeId = widget.episodeId;
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    Future.microtask(() => _loadEpisode(_currentEpisodeId!));
  }

  @override
  void dispose() {
    _videoPlayerController?.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
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
      await _initializePlayer(state.playSource!.url, state.playSource!.headers);
    }
  }

  Future<void> _initializePlayer(String url, Map<String, String> headers) async {
    if (_isInitialized) {
      await _videoPlayerController?.dispose();
    }

    _videoPlayerController = VideoPlayerController.networkUrl(
      Uri.parse(url),
      httpHeaders: headers,
    );

    await _videoPlayerController!.initialize();
    await _videoPlayerController!.play();

    if (mounted) {
      setState(() {
        _isInitialized = true;
      });
    }
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
    final currentIndex = widget.episodes.indexWhere((e) => e.id == _currentEpisodeId);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: state.loadingPlaySource
            ? const CircularProgressIndicator()
            : !_isInitialized || _videoPlayerController == null
                ? const CircularProgressIndicator()
                : CustomVideoControls(
                    controller: _videoPlayerController!,
                    onNext: currentIndex < widget.episodes.length - 1 ? _playNext : null,
                    onPrevious: currentIndex > 0 ? _playPrevious : null,
                  ),
      ),
    );
  }
}
