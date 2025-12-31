import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/network_providers.dart';
import 'podcast_models.dart';
import 'data/podcast_remote_service.dart';

/// 播放状态
enum AudioPlayerState {
  idle,
  loading,
  playing,
  paused,
  completed,
  error,
}

/// 播放模式
enum PlaybackMode {
  sequence, // 顺序播放
  single, // 单集循环
  shuffle, // 随机播放
}

/// 音频播放器状态
class AudioPlayerStateModel {
  final AudioPlayerState playerState;
  final PodcastEpisode? currentEpisode;
  final String? podcastId;
  final String? podcastTitle;
  final String? podcastCover;
  final String? sourceId;
  final Duration position;
  final Duration duration;
  final PlaybackMode playbackMode;
  final double playbackRate;
  final String? errorMessage;
  final List<PodcastEpisode> playlist;
  final int currentIndex;

  const AudioPlayerStateModel({
    this.playerState = AudioPlayerState.idle,
    this.currentEpisode,
    this.podcastId,
    this.podcastTitle,
    this.podcastCover,
    this.sourceId,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.playbackMode = PlaybackMode.sequence,
    this.playbackRate = 1.0,
    this.errorMessage,
    this.playlist = const [],
    this.currentIndex = -1,
  });

  bool get isPlaying => playerState == AudioPlayerState.playing;
  bool get isLoading => playerState == AudioPlayerState.loading;
  bool get hasEpisode => currentEpisode != null;

  double get progress => duration.inMilliseconds > 0
      ? position.inMilliseconds / duration.inMilliseconds
      : 0.0;

  String get formattedPosition {
    final minutes = position.inMinutes;
    final seconds = position.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  String get formattedDuration {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  AudioPlayerStateModel copyWith({
    AudioPlayerState? playerState,
    PodcastEpisode? currentEpisode,
    String? podcastId,
    String? podcastTitle,
    String? podcastCover,
    String? sourceId,
    Duration? position,
    Duration? duration,
    PlaybackMode? playbackMode,
    double? playbackRate,
    String? errorMessage,
    List<PodcastEpisode>? playlist,
    int? currentIndex,
  }) {
    return AudioPlayerStateModel(
      playerState: playerState ?? this.playerState,
      currentEpisode: currentEpisode ?? this.currentEpisode,
      podcastId: podcastId ?? this.podcastId,
      podcastTitle: podcastTitle ?? this.podcastTitle,
      podcastCover: podcastCover ?? this.podcastCover,
      sourceId: sourceId ?? this.sourceId,
      position: position ?? this.position,
      duration: duration ?? this.duration,
      playbackMode: playbackMode ?? this.playbackMode,
      playbackRate: playbackRate ?? this.playbackRate,
      errorMessage: errorMessage ?? this.errorMessage,
      playlist: playlist ?? this.playlist,
      currentIndex: currentIndex ?? this.currentIndex,
    );
  }
}

/// 音频播放器Notifier
class AudioPlayerNotifier extends StateNotifier<AudioPlayerStateModel> {
  final AudioPlayer _audioPlayer;
  final PodcastRemoteService _remoteService;
  Timer? _positionTimer;

  AudioPlayerNotifier({
    required AudioPlayer audioPlayer,
    required PodcastRemoteService remoteService,
  })  : _audioPlayer = audioPlayer,
        _remoteService = remoteService,
        super(const AudioPlayerStateModel()) {
    _setupAudioPlayer();
  }

  void _setupAudioPlayer() {
    // 监听播放器状态
    _audioPlayer.onPlayerStateChanged.listen((playerState) {
      switch (playerState) {
        case PlayerState.playing:
          state = state.copyWith(playerState: AudioPlayerState.playing);
          break;
        case PlayerState.paused:
          state = state.copyWith(playerState: AudioPlayerState.paused);
          break;
        case PlayerState.stopped:
          state = state.copyWith(playerState: AudioPlayerState.idle);
          break;
        case PlayerState.completed:
          state = state.copyWith(playerState: AudioPlayerState.completed);
          _onComplete();
          break;
        case PlayerState.disposed:
          // 播放器已销毁，不处理
          break;
      }
    });

    // 监听播放进度
    _audioPlayer.onPositionChanged.listen((position) {
      state = state.copyWith(position: position);
    });

    // 监听时长
    _audioPlayer.onDurationChanged.listen((duration) {
      state = state.copyWith(duration: duration);
    });
  }

  /// 播放单集
  Future<void> playEpisode({
    required String episodeId,
    required String podcastId,
    required String podcastTitle,
    String? podcastCover,
    String? source,
    List<PodcastEpisode> playlist = const [],
    int index = 0,
  }) async {
    state = state.copyWith(
      playerState: AudioPlayerState.loading,
      podcastId: podcastId,
      podcastTitle: podcastTitle,
      podcastCover: podcastCover,
      sourceId: source,
      errorMessage: null,
    );

    // 获取单集详情（包含音频地址）
    final episode = await _remoteService.fetchEpisodeDetail(episodeId, source);

    if (episode == null || (episode.audioUrl?.isEmpty ?? true)) {
      state = state.copyWith(
        playerState: AudioPlayerState.error,
        errorMessage: '无法获取音频地址',
      );
      return;
    }

    state = state.copyWith(
      currentEpisode: episode,
      playlist: playlist,
      currentIndex: index,
    );

    // 播放音频
    try {
      final audioUrl = episode.audioUrl ?? '';
      await _audioPlayer.play(UrlSource(audioUrl));
      _startPositionTimer();
    } catch (e) {
      // 尝试备用地址
      if (episode.audioUrlBackup != null && episode.audioUrlBackup!.isNotEmpty) {
        try {
          await _audioPlayer.play(UrlSource(episode.audioUrlBackup!));
          _startPositionTimer();
          return;
        } catch (e2) {
          // ignore
        }
      }
      state = state.copyWith(
        playerState: AudioPlayerState.error,
        errorMessage: '播放失败: $e',
      );
    }
  }

  /// 播放播客（加载单集列表后播放指定集数）
  Future<void> playPodcast({
    required String podcastId,
    required String podcastTitle,
    String? podcastCover,
    String? source,
    int episodeIndex = 0,
  }) async {
    state = state.copyWith(
      playerState: AudioPlayerState.loading,
      podcastId: podcastId,
      podcastTitle: podcastTitle,
      podcastCover: podcastCover,
      sourceId: source,
      errorMessage: null,
    );

    // 获取单集列表
    final episodesResponse = await _remoteService.fetchEpisodes(
      podcastId,
      limit: 100,
      sourceId: source,
    );
    final episodes = episodesResponse.episodes;

    if (episodes.isEmpty) {
      state = state.copyWith(
        playerState: AudioPlayerState.error,
        errorMessage: '暂无单集',
      );
      return;
    }

    final episode = episodes[episodeIndex.clamp(0, episodes.length - 1)];

    state = state.copyWith(
      currentEpisode: episode,
      playlist: episodes,
      currentIndex: episodeIndex.clamp(0, episodes.length - 1),
    );

    // 播放音频
    try {
      final audioUrl = episode.audioUrl ?? '';
      if (audioUrl.isNotEmpty) {
        await _audioPlayer.play(UrlSource(audioUrl));
        _startPositionTimer();
      } else {
        // 需要先获取单集详情
        await playEpisode(
          episodeId: episode.id,
          podcastId: podcastId,
          podcastTitle: podcastTitle,
          podcastCover: podcastCover,
          source: source,
          playlist: episodes,
          index: episodeIndex,
        );
      }
    } catch (e) {
      state = state.copyWith(
        playerState: AudioPlayerState.error,
        errorMessage: '播放失败: $e',
      );
    }
  }

  /// 播放/暂停
  Future<void> togglePlay() async {
    if (state.playerState == AudioPlayerState.loading) return;

    switch (_audioPlayer.state) {
      case PlayerState.playing:
        await _audioPlayer.pause();
        state = state.copyWith(playerState: AudioPlayerState.paused);
        break;
      case PlayerState.paused:
      case PlayerState.stopped:
        await _audioPlayer.resume();
        state = state.copyWith(playerState: AudioPlayerState.playing);
        break;
      default:
        if (state.currentEpisode != null) {
          await _audioPlayer.resume();
          state = state.copyWith(playerState: AudioPlayerState.playing);
        }
        break;
    }
  }

  /// 暂停
  Future<void> pause() async {
    await _audioPlayer.pause();
    state = state.copyWith(playerState: AudioPlayerState.paused);
  }

  /// 停止
  Future<void> stop() async {
    await _audioPlayer.stop();
    _stopPositionTimer();
    state = const AudioPlayerStateModel();
  }

  /// 跳转到指定位置
  Future<void> seek(Duration position) async {
    await _audioPlayer.seek(position);
    state = state.copyWith(position: position);
  }

  /// 跳转到指定进度
  Future<void> seekToProgress(double progress) async {
    if (state.duration.inMilliseconds > 0) {
      final position = Duration(
        milliseconds: (state.duration.inMilliseconds * progress).round(),
      );
      await seek(position);
    }
  }

  /// 播放上一集
  Future<void> playPrevious() async {
    if (state.playlist.isEmpty) return;

    int newIndex = state.currentIndex - 1;
    if (newIndex < 0) {
      newIndex = state.playlist.length - 1;
    }
    await _playAtIndex(newIndex);
  }

  /// 播放下一集
  Future<void> playNext() async {
    if (state.playlist.isEmpty) return;

    int newIndex = state.currentIndex + 1;
    if (newIndex >= state.playlist.length) {
      newIndex = 0;
    }
    await _playAtIndex(newIndex);
  }

  /// 指定位置播放
  Future<void> _playAtIndex(int index) async {
    if (index < 0 || index >= state.playlist.length) return;

    final episode = state.playlist[index];
    state = state.copyWith(currentIndex: index);

    // 获取单集详情（包含音频地址）
    final episodeDetail = await _remoteService.fetchEpisodeDetail(
      episode.id,
      state.sourceId,
    );

    if (episodeDetail == null || (episodeDetail.audioUrl?.isEmpty ?? true)) {
      state = state.copyWith(errorMessage: '无法获取音频');
      return;
    }

    state = state.copyWith(currentEpisode: episodeDetail);

    try {
      final audioUrl = episodeDetail.audioUrl ?? '';
      await _audioPlayer.play(UrlSource(audioUrl));
      _startPositionTimer();
    } catch (e) {
      if (episodeDetail.audioUrlBackup != null && episodeDetail.audioUrlBackup!.isNotEmpty) {
        await _audioPlayer.play(UrlSource(episodeDetail.audioUrlBackup!));
        _startPositionTimer();
      } else {
        state = state.copyWith(
          playerState: AudioPlayerState.error,
          errorMessage: '播放失败: $e',
        );
      }
    }
  }

  /// 单集播放完毕
  void _onComplete() {
    switch (state.playbackMode) {
      case PlaybackMode.single:
        // 单集循环，重新播放
        _audioPlayer.seek(Duration.zero);
        _audioPlayer.resume();
        break;
      case PlaybackMode.sequence:
      case PlaybackMode.shuffle:
        // 播放下一集
        playNext();
        break;
    }
  }

  /// 设置播放速度
  Future<void> setPlaybackRate(double rate) async {
    await _audioPlayer.setPlaybackRate(rate);
    state = state.copyWith(playbackRate: rate);
  }

  /// 设置播放模式
  void setPlaybackMode(PlaybackMode mode) {
    state = state.copyWith(playbackMode: mode);
  }

  /// 开始进度计时器
  void _startPositionTimer() {
    _positionTimer?.cancel();
    _positionTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_audioPlayer.state == PlayerState.playing) {
        // 进度由 onPositionChanged 更新
      }
    });
  }

  /// 停止进度计时器
  void _stopPositionTimer() {
    _positionTimer?.cancel();
    _positionTimer = null;
  }

  @override
  void dispose() {
    _stopPositionTimer();
    _audioPlayer.dispose();
    super.dispose();
  }
}

/// Provider for AudioPlayer instance
final _audioPlayerProvider = Provider<AudioPlayer>((ref) {
  final audioPlayer = AudioPlayer();
  ref.onDispose(() {
    audioPlayer.dispose();
  });
  return audioPlayer;
});

/// Combined provider that creates AudioPlayerNotifier with dependencies
final audioPlayerProvider = StateNotifierProvider<AudioPlayerNotifier, AudioPlayerStateModel>((ref) {
  final audioPlayer = ref.watch(_audioPlayerProvider);
  // Create a remote service wrapper that delegates to the actual service
  final remoteService = _CreatePodcastRemoteService(ref);
  return AudioPlayerNotifier(
    audioPlayer: audioPlayer,
    remoteService: remoteService,
  );
});

/// Helper class to create PodcastRemoteService with access to ref
class _CreatePodcastRemoteService implements PodcastRemoteService {
  final Ref _ref;

  _CreatePodcastRemoteService(this._ref);

  @override
  Future<Map<String, PodcastSourceInfo>> fetchSources() {
    return _getService().fetchSources();
  }

  @override
  Future<List<PodcastCategory>> fetchCategories(String? sourceId) {
    return _getService().fetchCategories(sourceId);
  }

  @override
  Future<PodcastFeed> fetchPrograms({String category = 'all', int page = 1, int limit = 20, String? sourceId}) {
    return _getService().fetchPrograms(category: category, page: page, limit: limit, sourceId: sourceId);
  }

  @override
  Future<PodcastFeed> fetchHot({int page = 1, int limit = 20, String? sourceId}) {
    return _getService().fetchHot(page: page, limit: limit, sourceId: sourceId);
  }

  @override
  Future<PodcastFeed> fetchLatest({int page = 1, int limit = 20, String? sourceId}) {
    return _getService().fetchLatest(page: page, limit: limit, sourceId: sourceId);
  }

  @override
  Future<PodcastFeed> search({required String keyword, String? sourceId, int page = 1, int limit = 20}) {
    return _getService().search(keyword: keyword, sourceId: sourceId, page: page, limit: limit);
  }

  @override
  Future<PodcastDetail?> fetchDetail(String programId, String? sourceId) {
    return _getService().fetchDetail(programId, sourceId);
  }

  @override
  Future<EpisodesResponse> fetchEpisodes(String programId, {int page = 1, int limit = 50, String? sourceId}) {
    return _getService().fetchEpisodes(programId, page: page, limit: limit, sourceId: sourceId);
  }

  @override
  Future<PodcastEpisode?> fetchEpisodeDetail(String episodeId, String? sourceId) {
    return _getService().fetchEpisodeDetail(episodeId, sourceId);
  }

  @override
  Map<String, PodcastSourceInfo> mockSources() {
    return _getService().mockSources();
  }

  @override
  List<PodcastCategory> mockCategories() {
    return _getService().mockCategories();
  }

  @override
  PodcastFeed mockPrograms(String category, int page, int limit) {
    return _getService().mockPrograms(category, page, limit);
  }

  @override
  PodcastFeed mockSearch(String keyword) {
    return _getService().mockSearch(keyword);
  }

  @override
  PodcastDetail? mockDetail(String programId) {
    return _getService().mockDetail(programId);
  }

  @override
  EpisodesResponse mockEpisodes(String programId) {
    return _getService().mockEpisodes(programId);
  }

  @override
  PodcastEpisode? mockEpisodeDetail(String episodeId) {
    return _getService().mockEpisodeDetail(episodeId);
  }

  PodcastRemoteService _getService() {
    // Access the apiClient through ref to avoid circular dependency
    return PodcastRemoteService(_ref.read(apiClientProvider));
  }
}
