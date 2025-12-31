import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';
import '../../core/storage/app_storage.dart';
import '../../core/network/network_providers.dart';
import 'podcast_models.dart';
import 'data/podcast_remote_service.dart';

/// 播客远程服务 Provider
final podcastRemoteServiceProvider = Provider<PodcastRemoteService>((ref) {
  final api = ref.watch(apiClientProvider);
  return PodcastRemoteService(api);
});

/// 视图模式
enum PodcastsViewMode { grid, list }

/// 播客状态
class PodcastsState {
  const PodcastsState({
    this.categories = const <PodcastCategory>[],
    this.programs = const <PodcastSummary>[],
    this.selectedCategory,
    this.loading = false,
    this.refreshing = false,
    this.loadingMore = false,
    this.hasMore = false,
    this.error,
    this.sources = const <String, PodcastSourceInfo>{},
    this.selectedSource,
    this.sourcesLoading = false,
    this.sourceSwitching = false,
    this.searchKeyword = '',
    this.searchResults = const <PodcastSummary>[],
    this.searching = false,
    this.searchHistory = const <String>[],
    this.favoriteIds = const <String>{},
    this.viewMode = PodcastsViewMode.grid,
  });

  final List<PodcastCategory> categories;
  final List<PodcastSummary> programs;
  final PodcastCategory? selectedCategory;
  final bool loading;
  final bool refreshing;
  final bool loadingMore;
  final bool hasMore;
  final String? error;
  final Map<String, PodcastSourceInfo> sources;
  final String? selectedSource;
  final bool sourcesLoading;
  final bool sourceSwitching;
  final String searchKeyword;
  final List<PodcastSummary> searchResults;
  final bool searching;
  final List<String> searchHistory;
  final Set<String> favoriteIds;
  final PodcastsViewMode viewMode;

  bool get inSearchMode => searchKeyword.trim().isNotEmpty;

  PodcastsState copyWith({
    List<PodcastCategory>? categories,
    List<PodcastSummary>? programs,
    PodcastCategory? selectedCategory,
    bool? loading,
    bool? refreshing,
    bool? loadingMore,
    bool? hasMore,
    String? error,
    Map<String, PodcastSourceInfo>? sources,
    String? selectedSource,
    bool? sourcesLoading,
    bool? sourceSwitching,
    String? searchKeyword,
    List<PodcastSummary>? searchResults,
    bool? searching,
    List<String>? searchHistory,
    Set<String>? favoriteIds,
    PodcastsViewMode? viewMode,
  }) {
    return PodcastsState(
      categories: categories != null ? List.unmodifiable(categories) : this.categories,
      programs: programs != null ? List.unmodifiable(programs) : this.programs,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      loading: loading ?? this.loading,
      refreshing: refreshing ?? this.refreshing,
      loadingMore: loadingMore ?? this.loadingMore,
      hasMore: hasMore ?? this.hasMore,
      error: error,
      sources: sources != null ? Map.unmodifiable(sources) : this.sources,
      selectedSource: selectedSource ?? this.selectedSource,
      sourcesLoading: sourcesLoading ?? this.sourcesLoading,
      sourceSwitching: sourceSwitching ?? this.sourceSwitching,
      searchKeyword: searchKeyword ?? this.searchKeyword,
      searchResults: searchResults != null ? List.unmodifiable(searchResults) : this.searchResults,
      searching: searching ?? this.searching,
      searchHistory: searchHistory != null ? List.unmodifiable(searchHistory) : this.searchHistory,
      favoriteIds: favoriteIds != null ? Set.unmodifiable(favoriteIds) : this.favoriteIds,
      viewMode: viewMode ?? this.viewMode,
    );
  }
}

/// 播客 Provider
final podcastsProvider = StateNotifierProvider<PodcastsNotifier, PodcastsState>((ref) {
  final remote = ref.watch(podcastRemoteServiceProvider);
  final sourceRepository = ref.watch(sourceRepositoryProvider);
  final searchHistoryRepository = ref.watch(searchHistoryRepositoryProvider);
  final favoritesRepository = ref.watch(favoritesRepositoryProvider);
  final settingsRepository = ref.watch(settingsRepositoryProvider);
  return PodcastsNotifier(
    remoteService: remote,
    sourceRepository: sourceRepository,
    searchHistoryRepository: searchHistoryRepository,
    favoritesRepository: favoritesRepository,
    settingsRepository: settingsRepository,
  );
});

class PodcastsNotifier extends StateNotifier<PodcastsState> {
  PodcastsNotifier({
    required PodcastRemoteService remoteService,
    required SourceRepository? sourceRepository,
    required SearchHistoryRepository? searchHistoryRepository,
    required FavoritesRepository? favoritesRepository,
    required SettingsRepository? settingsRepository,
  })  : _remoteService = remoteService,
        _sourceRepository = sourceRepository,
        _searchHistoryRepository = searchHistoryRepository,
        _favoritesRepository = favoritesRepository,
        _settingsRepository = settingsRepository,
        super(const PodcastsState()) {
    _init();
  }

  static const int _pageSize = 20;
  static const String _defaultSource = 'ximalaya';

  final PodcastRemoteService _remoteService;
  final SourceRepository? _sourceRepository;
  final SearchHistoryRepository? _searchHistoryRepository;
  final FavoritesRepository? _favoritesRepository;
  final SettingsRepository? _settingsRepository;

  int _nextPage = 1;
  int _searchToken = 0;
  bool _initializing = false;
  DateTime? _lastFeedAt;
  bool mounted = true;

  void _safeSetState(PodcastsState Function(PodcastsState) updater) {
    if (!mounted) return;
    state = updater(state);
  }

  Future<void> _init() async {
    if (_initializing) return;
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

  Future<void> ensureWarm() async {
    if (!mounted) return;
    if (state.loading || state.refreshing || state.searching) return;
    if (state.categories.isEmpty) {
      await _loadSources();
      if (!mounted) return;
    }
    if (state.selectedCategory == null && state.categories.isNotEmpty) {
      _safeSetState((s) => s.copyWith(selectedCategory: state.categories.first));
    }
    final now = DateTime.now();
    if (_lastFeedAt != null && now.difference(_lastFeedAt!).inMinutes < 1 && state.programs.isNotEmpty) {
      return;
    }
    if (state.programs.isEmpty) {
      await _loadFeed(reset: true);
      return;
    }
    await _loadFeed(reset: true);
  }

  Future<void> loadMore() async {
    if (state.inSearchMode) return;
    await _loadFeed(reset: false);
  }

  Future<void> selectCategory(PodcastCategory category) async {
    if (!mounted) return;
    if (category.id == state.selectedCategory?.id) return;
    _safeSetState((s) => s.copyWith(selectedCategory: category));
    await _loadFeed(reset: true);
  }

  Future<void> changeSource(String sourceId) async {
    if (!mounted) return;
    if (sourceId.isEmpty || sourceId == state.selectedSource) return;
    _safeSetState((s) => s.copyWith(
      selectedSource: sourceId,
      sourceSwitching: true,
      programs: <PodcastSummary>[],
      categories: <PodcastCategory>[],
      selectedCategory: null,
      error: null,
    ));
    await _sourceRepository?.setCurrentSource(sourceId);
    if (!mounted) return;
    await _loadCategories(sourceId);
    if (!mounted) return;
    await _loadFeed(reset: true);
    if (!mounted) return;
    _safeSetState((s) => s.copyWith(sourceSwitching: false));
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
      if (token != _searchToken || !mounted) return;
      _safeSetState((s) => s.copyWith(
        searchResults: result.programs,
        searching: false,
      ));
    } catch (e) {
      if (token != _searchToken || !mounted) return;
      _safeSetState((s) => s.copyWith(
        searching: false,
        error: e.toString(),
      ));
    }
  }

  void clearSearch() {
    _safeSetState((s) => s.copyWith(
      searchKeyword: '',
      searchResults: <PodcastSummary>[],
      searching: false,
    ));
  }

  Future<void> toggleFavorite(String programId) async {
    if (programId.isEmpty || !mounted) return;
    final isFav = state.favoriteIds.contains(programId);
    if (isFav) {
      await _favoritesRepository?.remove(programId);
      if (!mounted) return;
      final updated = Set<String>.from(state.favoriteIds)..remove(programId);
      _safeSetState((s) => s.copyWith(favoriteIds: updated));
    } else {
      final emptySummary = PodcastSummary(id: '', title: '', cover: '', source: '');
      final program = state.programs.firstWhere(
        (p) => p.id == programId,
        orElse: () => state.searchResults.firstWhere(
          (p) => p.id == programId,
          orElse: () => emptySummary,
        ),
      );
      if (program.id.isEmpty) return;
      await _favoritesRepository?.add(FavoriteItem(
        id: program.id,
        title: program.title,
        cover: program.cover,
        type: 'podcast',
        source: program.source,
      ));
      if (!mounted) return;
      final updated = Set<String>.from(state.favoriteIds)..add(programId);
      _safeSetState((s) => s.copyWith(favoriteIds: updated));
    }
  }

  Future<void> _loadSources() async {
    _safeSetState((s) => s.copyWith(sourcesLoading: true, error: null));
    try {
      final sources = await _remoteService.fetchSources();
      if (!mounted) return;
      final currentSource = _sourceRepository?.currentSource() ?? _defaultSource;
      final resolvedSource = sources.containsKey(currentSource)
          ? currentSource
          : (sources.keys.isNotEmpty ? sources.keys.first : _defaultSource);
      _safeSetState((s) => s.copyWith(
        sources: sources,
        selectedSource: resolvedSource,
        sourcesLoading: false,
      ));
      await _sourceRepository?.setCurrentSource(resolvedSource);
      if (!mounted) return;
      await _loadCategories(resolvedSource);
      if (!mounted) return;
      await _loadFeed(reset: true);
    } catch (e) {
      _safeSetState((s) => s.copyWith(
        sourcesLoading: false,
        error: e.toString(),
      ));
    }
  }

  Future<void> _loadCategories(String sourceId) async {
    if (sourceId.isEmpty) return;
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
    if (state.selectedCategory == null) return;
    if (state.loading || state.loadingMore) return;
    if (!reset && !state.hasMore) return;

    final category = state.selectedCategory!;
    final nextPage = reset ? 1 : _nextPage;

    if (reset) {
      _safeSetState((s) => s.copyWith(loading: true, error: null));
    } else {
      _safeSetState((s) => s.copyWith(loadingMore: true));
    }

    try {
      final feed = await _remoteService.fetchPrograms(
        category: category.id,
        page: nextPage,
        limit: _pageSize,
        sourceId: state.selectedSource,
      );
      if (!mounted) return;

      final items = reset ? feed.programs : [...state.programs, ...feed.programs];
      _nextPage = nextPage + 1;

      _safeSetState((s) => s.copyWith(
        programs: items,
        loading: false,
        refreshing: false,
        loadingMore: false,
        hasMore: feed.hasMore,
      ));
      _lastFeedAt = DateTime.now();
    } catch (e) {
      _safeSetState((s) => s.copyWith(
        loading: false,
        refreshing: false,
        loadingMore: false,
        error: '加载失败 ${e.toString()}',
      ));
    }
  }

  void _hydrateViewMode() {
    final settings = _settingsRepository?.load();
    if (settings == null) return;
    final mode = settings.viewMode;
    if (mode == 'list') {
      _safeSetState((s) => s.copyWith(viewMode: PodcastsViewMode.list));
    } else {
      _safeSetState((s) => s.copyWith(viewMode: PodcastsViewMode.grid));
    }
  }

  void _hydrateFavorites() {
    final List<FavoriteItem> favorites = _favoritesRepository?.list() ?? <FavoriteItem>[];
    final podcastFavorites = favorites.where((f) => f.type == 'podcast').map((f) => f.id).toSet();
    _safeSetState((s) => s.copyWith(favoriteIds: podcastFavorites));
  }

  void _hydrateSearchHistory() {
    final history = _searchHistoryRepository?.list() ?? <String>[];
    _safeSetState((s) => s.copyWith(searchHistory: history));
  }

  Future<void> toggleViewMode() async {
    if (!mounted) return;
    final next = state.viewMode == PodcastsViewMode.grid ? PodcastsViewMode.list : PodcastsViewMode.grid;
    _safeSetState((s) => s.copyWith(viewMode: next));
    await _settingsRepository?.update({'viewMode': next == PodcastsViewMode.list ? 'list' : 'card'});
  }

  void dispose() {
    mounted = false;
    super.dispose();
  }
}
