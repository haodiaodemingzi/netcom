import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';

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
  late VideoPlayerController _videoPlayerController;
  ChewieController? _chewieController;
  String? _currentEpisodeId;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _currentEpisodeId = widget.episodeId;
    Future.microtask(() => _loadEpisode(_currentEpisodeId!));
  }

  @override
  void dispose() {
    _videoPlayerController.dispose();
    _chewieController?.dispose();
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
      await _videoPlayerController.dispose();
      _chewieController?.dispose();
    }

    _videoPlayerController = VideoPlayerController.networkUrl(
      Uri.parse(url),
      httpHeaders: headers,
    );

    await _videoPlayerController.initialize();

    _chewieController = ChewieController(
      videoPlayerController: _videoPlayerController,
      autoPlay: true,
      looping: false,
      allowFullScreen: true,
      allowPlaybackSpeedChanging: true,
    );

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

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          widget.episodes.firstWhere(
            (e) => e.id == _currentEpisodeId,
            orElse: () => const VideoEpisode(id: '', title: '', index: 0),
          ).title,
          style: const TextStyle(color: Colors.white),
        ),
        actions: [
          if (widget.episodes.indexWhere((e) => e.id == _currentEpisodeId) > 0)
            IconButton(
              icon: const Icon(Icons.skip_previous),
              onPressed: _playPrevious,
            ),
          if (widget.episodes.indexWhere((e) => e.id == _currentEpisodeId) < widget.episodes.length - 1)
            IconButton(
              icon: const Icon(Icons.skip_next),
              onPressed: _playNext,
            ),
        ],
      ),
      body: Center(
        child: state.loadingPlaySource
            ? const CircularProgressIndicator()
            : !_isInitialized || _chewieController == null
                ? const CircularProgressIndicator()
                : Chewie(controller: _chewieController!),
      ),
    );
  }
}
