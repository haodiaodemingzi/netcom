import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';
import '../../core/network/network_providers.dart';
import 'video_models.dart';
import 'data/video_remote_service.dart';

final videosRemoteServiceProvider = Provider<VideoRemoteService>((ref) {
  final api = ref.watch(apiClientProvider);
  return VideoRemoteService(api);
});

enum VideosViewMode { grid, list }

class VideosState {
  const VideosState({
    this.categories = const <VideoCategory>[],
    this.videos = const <VideoSummary>[],
    this.selectedCategory,
    this.loading = false,
    this.refreshing = false,
    this.loadingMore = false,
    this.hasMore = false,
    this.error,
    this.sources = const <String, VideoSourceInfo>{},
    this.selectedSource,
    this.sourcesLoading = false,
    this.searchKeyword = '',
    this.searchResults = const <VideoSummary>[],
    this.searching = false,
    this.searchHistory = const <String>[],
    this.favoriteIds = const <String>{},
    this.viewMode = VideosViewMode.grid,
  });

  final List<VideoCategory> categories;
  final List<VideoSummary> videos;
  final VideoCategory? selectedCategory;
  final bool loading;
  final bool refreshing;
  final bool loadingMore;
  final bool hasMore;
  final String? error;
  final Map<String, VideoSourceInfo> sources;
  final String? selectedSource;
  final bool sourcesLoading;
  final String searchKeyword;
  final List<VideoSummary> searchResults;
  final bool searching;
  final List<String> searchHistory;
  final Set<String> favoriteIds;
  final VideosViewMode viewMode;

  bool get inSearchMode => searchKeyword.trim().isNotEmpty;

  VideosState copyWith({
    List<VideoCategory>? categories,
    List<VideoSummary>? videos,
    VideoCategory? selectedCategory,
    bool? loading,
    bool? refreshing,
    bool? loadingMore,
    bool? hasMore,
    String? error,
    Map<String, VideoSourceInfo>? sources,
    String? selectedSource,
    bool? sourcesLoading,
    String? searchKeyword,
    List<VideoSummary>? searchResults,
    bool? searching,
    List<String>? searchHistory,
    Set<String>? favoriteIds,
    VideosViewMode? viewMode,
  }) {
    return VideosState(
      categories: categories != null ? List.unmodifiable(categories) : this.categories,
      videos: videos != null ? List.unmodifiable(videos) : this.videos,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      loading: loading ?? this.loading,
      refreshing: refreshing ?? this.refreshing,
      loadingMore: loadingMore ?? this.loadingMore,
      hasMore: hasMore ?? this.hasMore,
      error: error,
      sources: sources != null ? Map.unmodifiable(sources) : this.sources,
      selectedSource: selectedSource ?? this.selectedSource,
      sourcesLoading: sourcesLoading ?? this.sourcesLoading,
      searchKeyword: searchKeyword ?? this.searchKeyword,
      searchResults: searchResults != null ? List.unmodifiable(searchResults) : this.searchResults,
      searching: searching ?? this.searching,
      searchHistory: searchHistory != null ? List.unmodifiable(searchHistory) : this.searchHistory,
      favoriteIds: favoriteIds != null ? Set.unmodifiable(favoriteIds) : this.favoriteIds,
      viewMode: viewMode ?? this.viewMode,
    );
  }
}

final videosProvider = StateNotifierProvider<VideosNotifier, VideosState>((ref) {
  final remote = ref.watch(videosRemoteServiceProvider);
  final sourceRepository = ref.watch(videoSourceRepositoryProvider);
  final searchHistoryRepository = ref.watch(searchHistoryRepositoryProvider);
  final favoritesRepository = ref.watch(favoritesRepositoryProvider);
  final settingsRepository = ref.watch(settingsRepositoryProvider);
  return VideosNotifier(
    remoteService: remote,
    sourceRepository: sourceRepository,
    searchHistoryRepository: searchHistoryRepository,
    favoritesRepository: favoritesRepository,
    settingsRepository: settingsRepository,
  );
});

class VideosNotifier extends StateNotifier<VideosState> {
  VideosNotifier({
    required VideoRemoteService remoteService,
    required VideoSourceRepository? sourceRepository,
    required SearchHistoryRepository? searchHistoryRepository,
    required FavoritesRepository? favoritesRepository,
    required SettingsRepository? settingsRepository,
  })  : _remoteService = remoteService,
        _sourceRepository = sourceRepository,
        _searchHistoryRepository = searchHistoryRepository,
        _favoritesRepository = favoritesRepository,
        _settingsRepository = settingsRepository,
        super(const VideosState()) {
    _init();
  }

  static const int _pageSize = 20;
  static const String _defaultSource = 'mjwu';

  final VideoRemoteService _remoteService;
  final VideoSourceRepository? _sourceRepository;
  final SearchHistoryRepository? _searchHistoryRepository;
  final FavoritesRepository? _favoritesRepository;
  final SettingsRepository? _settingsRepository;

  int _nextPage = 1;
  int _searchToken = 0;
  bool _initializing = false;

  void _safeSetState(VideosState Function(VideosState) updater) {
    if (!mounted) return;
    state = updater(state);
  }

  Future<void> _init() async {
    if (_initializing) {
      return;
    }
    _initializing = true;
    _hydrateViewMode();
    _hydrateFavorites();
    _hydrateSearchHistory();
    await _loadSources();
    _initializing = false;
  }

  Future<void> refresh() async {
    await _loadFeed(reset: true);
  }

  Future<void> loadMore() async {
    if (state.inSearchMode) {
      return;
    }
    await _loadFeed(reset: false);
  }

  Future<void> selectCategory(VideoCategory category) async {
    if (!mounted) return;
    if (category.id == state.selectedCategory?.id) {
      return;
    }
    _safeSetState((s) => s.copyWith(selectedCategory: category));
    await _loadFeed(reset: true);
  }

  Future<void> changeSource(String sourceId) async {
    if (!mounted) return;
    if (sourceId.isEmpty || sourceId == state.selectedSource) {
      return;
    }
    _safeSetState((s) => s.copyWith(selectedSource: sourceId));
    await _sourceRepository?.setCurrentSource(sourceId);
    if (!mounted) return;
    await _loadCategories(sourceId);
    if (!mounted) return;
    await _loadFeed(reset: true);
  }

  Future<void> search(String keyword) async {
    final trimmed = keyword.trim();
    if (trimmed.isEmpty) {
      clearSearch();
      return;
    }
    final token = ++_searchToken;
    _safeSetState((s) => s.copyWith(
      searchKeyword: trimmed,
      searching: true,
      error: null,
    ));
    await _searchHistoryRepository?.add(trimmed);
    try {
      final result = await _remoteService.search(
        keyword: trimmed,
        sourceId: state.selectedSource,
        page: 1,
        limit: 50,
      );
      if (token != _searchToken || !mounted) {
        return;
      }
      _safeSetState((s) => s.copyWith(
        searchResults: result.items,
        searching: false,
      ));
    } catch (e) {
      if (token != _searchToken || !mounted) {
        return;
      }
      _safeSetState((s) => s.copyWith(
        searching: false,
        error: e.toString(),
      ));
    }
  }

  void clearSearch() {
    _safeSetState((s) => s.copyWith(
      searchKeyword: '',
      searchResults: <VideoSummary>[],
      searching: false,
    ));
  }

  Future<void> toggleFavorite(String videoId) async {
    if (videoId.isEmpty || !mounted) {
      return;
    }
    final isFav = state.favoriteIds.contains(videoId);
    if (isFav) {
      await _favoritesRepository?.remove(videoId);
      if (!mounted) return;
      final updated = Set<String>.from(state.favoriteIds)..remove(videoId);
      _safeSetState((s) => s.copyWith(favoriteIds: updated));
    } else {
      final video = state.videos.firstWhere((v) => v.id == videoId, orElse: () => state.searchResults.firstWhere((v) => v.id == videoId, orElse: () => const VideoSummary(id: '', title: '', cover: '', source: '')));
      if (video.id.isEmpty) {
        return;
      }
      await _favoritesRepository?.add(FavoriteItem(
        id: video.id,
        title: video.title,
        cover: video.cover,
        type: 'video',
        source: video.source,
      ));
      if (!mounted) return;
      final updated = Set<String>.from(state.favoriteIds)..add(videoId);
      _safeSetState((s) => s.copyWith(favoriteIds: updated));
    }
  }

  Future<void> _loadSources() async {
    _safeSetState((s) => s.copyWith(sourcesLoading: true));
    try {
      final sources = await _remoteService.fetchSources();
      if (!mounted) return;
      final currentSource = _sourceRepository?.currentSource() ?? _defaultSource;
      final resolvedSource = sources.containsKey(currentSource) ? currentSource : (sources.keys.isNotEmpty ? sources.keys.first : _defaultSource);
      _safeSetState((s) => s.copyWith(
        sources: sources,
        selectedSource: resolvedSource,
        sourcesLoading: false,
      ));
      await _sourceRepository?.setCurrentSource(resolvedSource);
      if (!mounted) return;
      await _loadCategories(resolvedSource);
    } catch (e) {
      _safeSetState((s) => s.copyWith(
        sourcesLoading: false,
        error: e.toString(),
      ));
    }
  }

  Future<void> _loadCategories(String sourceId) async {
    if (sourceId.isEmpty) {
      return;
    }
    try {
      final categories = await _remoteService.fetchCategories(sourceId);
      if (!mounted) return;
      final firstCategory = categories.isNotEmpty ? categories.first : null;
      _safeSetState((s) => s.copyWith(
        categories: categories,
        selectedCategory: firstCategory,
      ));
    } catch (e) {
      _safeSetState((s) => s.copyWith(error: e.toString()));
    }
  }

  Future<void> _loadFeed({required bool reset}) async {
    if (!mounted) return;
    if (state.loading || state.loadingMore) {
      return;
    }
    if (!reset && !state.hasMore) {
      return;
    }
    final category = state.selectedCategory;
    if (category == null) {
      return;
    }
    if (reset) {
      _nextPage = 1;
      _safeSetState((s) => s.copyWith(loading: true, error: null));
    } else {
      _safeSetState((s) => s.copyWith(loadingMore: true));
    }
    try {
      final result = await _remoteService.fetchFeed(
        categoryId: category.id,
        page: _nextPage,
        limit: _pageSize,
        sourceId: state.selectedSource,
      );
      if (!mounted) return;
      final updated = reset ? result.items : [...state.videos, ...result.items];
      _nextPage++;
      _safeSetState((s) => s.copyWith(
        videos: updated,
        hasMore: result.hasMore,
        loading: false,
        loadingMore: false,
        refreshing: false,
      ));
    } catch (e) {
      _safeSetState((s) => s.copyWith(
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: e.toString(),
      ));
    }
  }

  void _hydrateViewMode() {
    final settings = _settingsRepository?.load();
    if (settings == null) {
      return;
    }
    final mode = settings.viewMode;
    if (mode == 'list') {
        _safeSetState((s) => s.copyWith(viewMode: VideosViewMode.list));
    } else {
      _safeSetState((s) => s.copyWith(viewMode: VideosViewMode.grid));
    }
  }

  void _hydrateFavorites() {
    final favorites = _favoritesRepository?.list() ?? <FavoriteItem>[];
    final videoFavorites = favorites.where((f) => f.type == 'video').map((f) => f.id).toSet();
    _safeSetState((s) => s.copyWith(favoriteIds: videoFavorites));
  }

  void _hydrateSearchHistory() {
    final history = _searchHistoryRepository?.list() ?? <String>[];
    _safeSetState((s) => s.copyWith(searchHistory: history));
  }

  Future<void> toggleViewMode() async {
    if (!mounted) return;
    final next = state.viewMode == VideosViewMode.grid ? VideosViewMode.list : VideosViewMode.grid;
    _safeSetState((s) => s.copyWith(viewMode: next));
    await _settingsRepository?.update({'viewMode': next == VideosViewMode.list ? 'list' : 'card'});
  }
}
