import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/network_providers.dart';
import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';
import '../../core/storage/app_storage.dart';
import 'video_models.dart';
import 'data/video_remote_service.dart';
import 'videos_provider.dart';

class VideoDetailRequest {
  const VideoDetailRequest({required this.videoId, this.source});

  final String videoId;
  final String? source;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) {
      return true;
    }
    return other is VideoDetailRequest && other.videoId == videoId && other.source == source;
  }

  @override
  int get hashCode => Object.hash(videoId, source);
}

final videoDetailProvider = StateNotifierProvider.family<VideoDetailNotifier, VideoDetailState, VideoDetailRequest>((ref, args) {
  final remote = ref.watch(videosRemoteServiceProvider);
  final favoritesRepository = ref.watch(favoritesRepositoryProvider);
  return VideoDetailNotifier(
    videoId: args.videoId,
    sourceId: args.source,
    remoteService: remote,
    favoritesRepository: favoritesRepository,
  );
});

class VideoDetailState {
  const VideoDetailState({
    this.detail,
    this.episodes = const <VideoEpisode>[],
    this.loading = true,
    this.error,
    this.isFavorite = false,
    this.selectedEpisode,
    this.playSource,
    this.loadingPlaySource = false,
  });

  final VideoDetail? detail;
  final List<VideoEpisode> episodes;
  final bool loading;
  final String? error;
  final bool isFavorite;
  final VideoEpisode? selectedEpisode;
  final VideoPlaySource? playSource;
  final bool loadingPlaySource;

  VideoDetailState copyWith({
    VideoDetail? detail,
    List<VideoEpisode>? episodes,
    bool? loading,
    String? error,
    bool? isFavorite,
    VideoEpisode? selectedEpisode,
    VideoPlaySource? playSource,
    bool? loadingPlaySource,
  }) {
    return VideoDetailState(
      detail: detail ?? this.detail,
      episodes: episodes != null ? List.unmodifiable(episodes) : this.episodes,
      loading: loading ?? this.loading,
      error: error,
      isFavorite: isFavorite ?? this.isFavorite,
      selectedEpisode: selectedEpisode ?? this.selectedEpisode,
      playSource: playSource ?? this.playSource,
      loadingPlaySource: loadingPlaySource ?? this.loadingPlaySource,
    );
  }
}

class VideoDetailNotifier extends StateNotifier<VideoDetailState> {
  VideoDetailNotifier({
    required String videoId,
    required String? sourceId,
    required VideoRemoteService remoteService,
    required FavoritesRepository? favoritesRepository,
  })  : _videoId = videoId,
        _sourceId = sourceId,
        _remoteService = remoteService,
        _favoritesRepository = favoritesRepository,
        super(const VideoDetailState()) {
    _init();
  }

  final String _videoId;
  final String? _sourceId;
  final VideoRemoteService _remoteService;
  final FavoritesRepository? _favoritesRepository;

  Future<void> _init() async {
    await _checkFavorite();
    await _loadDetail();
  }

  Future<void> _loadDetail() async {
    if (_videoId.isEmpty) {
      state = state.copyWith(loading: false, error: 'Invalid video ID');
      return;
    }
    state = state.copyWith(loading: true, error: null);
    try {
      final detail = await _remoteService.fetchDetail(_videoId, _sourceId);
      if (detail == null || detail.id.isEmpty) {
        state = state.copyWith(loading: false, error: '视频不存在');
        return;
      }
      final episodes = await _remoteService.fetchEpisodes(_videoId, detail.source.isNotEmpty ? detail.source : _sourceId);
      state = state.copyWith(
        detail: detail,
        episodes: episodes,
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> _checkFavorite() async {
    if (_videoId.isEmpty) {
      return;
    }
    final isFav = await _favoritesRepository?.isFavorite(_videoId) ?? false;
    state = state.copyWith(isFavorite: isFav);
  }

  Future<void> toggleFavorite() async {
    final detail = state.detail;
    if (detail == null || detail.id.isEmpty) {
      return;
    }
    if (state.isFavorite) {
      await _favoritesRepository?.remove(detail.id);
      state = state.copyWith(isFavorite: false);
    } else {
      await _favoritesRepository?.add(FavoriteItem(
        id: detail.id,
        title: detail.title,
        cover: detail.cover,
        type: 'video',
        source: detail.source,
      ));
      state = state.copyWith(isFavorite: true);
    }
  }

  Future<void> selectEpisode(VideoEpisode episode) async {
    if (episode.id.isEmpty) {
      return;
    }
    state = state.copyWith(
      selectedEpisode: episode,
      loadingPlaySource: true,
      playSource: null,
    );
    try {
      final source = await _remoteService.fetchEpisodePlaySource(episode.id, state.detail?.source.isNotEmpty == true ? state.detail?.source : _sourceId);
      if (source == null || source.url.isEmpty) {
        state = state.copyWith(
          loadingPlaySource: false,
          error: '无法获取播放地址',
        );
        return;
      }
      state = state.copyWith(
        playSource: source,
        loadingPlaySource: false,
      );
    } catch (e) {
      state = state.copyWith(
        loadingPlaySource: false,
        error: e.toString(),
      );
    }
  }

  Future<void> refresh() async {
    await _loadDetail();
  }
}
