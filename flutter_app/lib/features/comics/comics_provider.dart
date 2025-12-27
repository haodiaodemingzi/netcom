import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';
import '../../core/network/network_providers.dart';
import 'comics_models.dart';
import 'data/comics_remote_service.dart';

final comicsRemoteServiceProvider = Provider<ComicsRemoteService>((ref) {
  final api = ref.watch(apiClientProvider);
  return ComicsRemoteService(api);
});

enum ComicsViewMode { grid, list }

class ComicsState {
  const ComicsState({
    this.categories = const <ComicCategory>[],
    this.comics = const <ComicSummary>[],
    this.selectedCategory,
    this.loading = false,
    this.refreshing = false,
    this.loadingMore = false,
    this.hasMore = false,
    this.error,
    this.sources = const <String, ComicSourceInfo>{},
    this.selectedSource,
    this.sourcesLoading = false,
    this.sourceSwitching = false,
    this.searchKeyword = '',
    this.searchResults = const <ComicSummary>[],
    this.searching = false,
    this.searchHistory = const <String>[],
    this.favoriteIds = const <String>{},
    this.viewMode = ComicsViewMode.grid,
  });

  final List<ComicCategory> categories;
  final List<ComicSummary> comics;
  final ComicCategory? selectedCategory;
  final bool loading;
  final bool refreshing;
  final bool loadingMore;
  final bool hasMore;
  final String? error;
  final Map<String, ComicSourceInfo> sources;
  final String? selectedSource;
  final bool sourcesLoading;
  final bool sourceSwitching;
  final String searchKeyword;
  final List<ComicSummary> searchResults;
  final bool searching;
  final List<String> searchHistory;
  final Set<String> favoriteIds;
  final ComicsViewMode viewMode;

  bool get inSearchMode => searchKeyword.trim().isNotEmpty;

  ComicsState copyWith({
    List<ComicCategory>? categories,
    List<ComicSummary>? comics,
    ComicCategory? selectedCategory,
    bool? loading,
    bool? refreshing,
    bool? loadingMore,
    bool? hasMore,
    String? error,
    Map<String, ComicSourceInfo>? sources,
    String? selectedSource,
    bool? sourcesLoading,
    bool? sourceSwitching,
    String? searchKeyword,
    List<ComicSummary>? searchResults,
    bool? searching,
    List<String>? searchHistory,
    Set<String>? favoriteIds,
    ComicsViewMode? viewMode,
  }) {
    return ComicsState(
      categories: categories != null ? List.unmodifiable(categories) : this.categories,
      comics: comics != null ? List.unmodifiable(comics) : this.comics,
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

final comicsProvider = StateNotifierProvider<ComicsNotifier, ComicsState>((ref) {
  final remote = ref.watch(comicsRemoteServiceProvider);
  final sourceRepository = ref.watch(sourceRepositoryProvider);
  final searchHistoryRepository = ref.watch(searchHistoryRepositoryProvider);
  final favoritesRepository = ref.watch(favoritesRepositoryProvider);
  final settingsRepository = ref.watch(settingsRepositoryProvider);
  return ComicsNotifier(
    remoteService: remote,
    sourceRepository: sourceRepository,
    searchHistoryRepository: searchHistoryRepository,
    favoritesRepository: favoritesRepository,
    settingsRepository: settingsRepository,
  );
});

class ComicsNotifier extends StateNotifier<ComicsState> {
  ComicsNotifier({
    required ComicsRemoteService remoteService,
    required SourceRepository? sourceRepository,
    required SearchHistoryRepository? searchHistoryRepository,
    required FavoritesRepository? favoritesRepository,
    required SettingsRepository? settingsRepository,
  })  : _remoteService = remoteService,
        _sourceRepository = sourceRepository,
        _searchHistoryRepository = searchHistoryRepository,
        _favoritesRepository = favoritesRepository,
        _settingsRepository = settingsRepository,
        super(const ComicsState()) {
    _init();
  }

  static const int _pageSize = 20;
  static const List<ComicCategory> _baseCategories = <ComicCategory>[
    ComicCategory(id: 'hot', name: '热门'),
    ComicCategory(id: 'latest', name: '最新'),
  ];
  static const Set<String> _reservedCategoryIds = <String>{'hot', 'latest'};

  final ComicsRemoteService _remoteService;
  final SourceRepository? _sourceRepository;
  final SearchHistoryRepository? _searchHistoryRepository;
  final FavoritesRepository? _favoritesRepository;
  final SettingsRepository? _settingsRepository;

  int _nextPage = 1;
  int _searchToken = 0;
  bool _initializing = false;
  DateTime? _lastFeedAt;

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

  Future<void> ensureWarm() async {
    if (!mounted) return;
    if (state.loading || state.refreshing || state.searching) {
      return;
    }
    if (state.categories.isEmpty) {
      await _loadSources();
      if (!mounted) return;
    }
    if (state.selectedCategory == null && state.categories.isNotEmpty) {
      state = state.copyWith(selectedCategory: state.categories.first);
    }
    final now = DateTime.now();
    if (_lastFeedAt != null && now.difference(_lastFeedAt!).inMinutes < 1 && state.comics.isNotEmpty) {
      return;
    }
    if (state.comics.isEmpty) {
      await _loadFeed(reset: true);
      return;
    }
    await _loadFeed(reset: true);
  }

  Future<void> loadMore() async {
    if (state.inSearchMode) {
      return;
    }
    await _loadFeed(reset: false);
  }

  Future<void> selectCategory(ComicCategory category) async {
    if (category.id == state.selectedCategory?.id) {
      return;
    }
    state = state.copyWith(selectedCategory: category);
    await _loadFeed(reset: true);
  }

  Future<void> changeSource(String sourceId) async {
    if (!mounted) return;
    if (sourceId.isEmpty || sourceId == state.selectedSource) {
      return;
    }
    state = state.copyWith(
      selectedSource: sourceId,
      sourceSwitching: true,
      comics: <ComicSummary>[],
      categories: <ComicCategory>[],
      selectedCategory: null,
      error: null,
    );
    await _sourceRepository?.setCurrentSource(sourceId);
    if (!mounted) return;
    await _loadCategories(sourceId);
    if (!mounted) return;
    await _loadFeed(reset: true);
    if (!mounted) return;
    state = state.copyWith(sourceSwitching: false);
  }

  Future<void> search(String keyword) async {
    final trimmed = keyword.trim();
    if (trimmed.isEmpty) {
      clearSearch();
      return;
    }
    final token = ++_searchToken;
    state = state.copyWith(
      searchKeyword: trimmed,
      searching: true,
      error: null,
    );
    try {
      final results = await _remoteService.search(
        keyword: trimmed,
        sourceId: state.selectedSource,
      );
      if (!mounted || token != _searchToken) {
        return;
      }
      await _searchHistoryRepository?.add(trimmed);
      if (!mounted || token != _searchToken) {
        return;
      }
      _hydrateSearchHistory();
      if (!mounted || token != _searchToken) {
        return;
      }
      state = state.copyWith(
        searchResults: results,
        searching: false,
      );
    } catch (e) {
      if (!mounted || token != _searchToken) {
        return;
      }
      state = state.copyWith(
        searching: false,
        error: '搜索失败 ${e.toString()}',
      );
    }
  }

  void clearSearch() {
    _searchToken++;
    state = state.copyWith(
      searchKeyword: '',
      searchResults: const <ComicSummary>[],
      searching: false,
    );
  }

  Future<void> clearSearchHistory() async {
    await _searchHistoryRepository?.clear();
    _hydrateSearchHistory();
  }

  Future<void> toggleFavorite(ComicSummary comic) async {
    if (comic.id.isEmpty) {
      return;
    }
    final repo = _favoritesRepository;
    if (repo == null) {
      return;
    }
    final favorites = Set<String>.from(state.favoriteIds);
    if (favorites.contains(comic.id)) {
      favorites.remove(comic.id);
      await repo.remove(comic.id);
    } else {
      favorites.add(comic.id);
      await repo.add(
        FavoriteItem(
          id: comic.id,
          title: comic.title,
          cover: comic.cover,
          type: 'comic',
          source: comic.source,
        ),
      );
    }
    state = state.copyWith(favoriteIds: favorites);
  }

  Future<void> toggleViewMode() async {
    final next = state.viewMode == ComicsViewMode.grid ? ComicsViewMode.list : ComicsViewMode.grid;
    state = state.copyWith(viewMode: next);
    await _settingsRepository?.update({'viewMode': next == ComicsViewMode.list ? 'list' : 'card'});
  }

  Future<void> _loadSources() async {
    state = state.copyWith(sourcesLoading: true, error: null);
    try {
      final remoteSources = await _remoteService.fetchSources();
      final installedComicSources = _sourceRepository?.listInstalled()['comic'] ?? <String>[];
      Map<String, ComicSourceInfo> available = remoteSources;
      if (installedComicSources.isNotEmpty) {
        available = Map<String, ComicSourceInfo>.fromEntries(
          remoteSources.entries.where((entry) => installedComicSources.contains(entry.key)),
        );
      }
      String? selectedSource = state.selectedSource ?? _sourceRepository?.currentSource();
      if ((selectedSource == null || (available.isNotEmpty && !available.containsKey(selectedSource))) && available.isNotEmpty) {
        selectedSource = available.keys.first;
        await _sourceRepository?.setCurrentSource(selectedSource);
      }
      if (!mounted) {
        return;
      }
      state = state.copyWith(
        sources: available,
        selectedSource: selectedSource,
        sourcesLoading: false,
      );
      await _loadCategories(selectedSource);
      await _loadFeed(reset: true);
    } catch (e) {
      if (!mounted) {
        return;
      }
      state = state.copyWith(
        sourcesLoading: false,
        error: '加载数据源失败 ${e.toString()}',
      );
    }
  }

  Future<void> _loadCategories(String? sourceId) async {
    try {
      final remoteCategories = await _remoteService.fetchCategories(sourceId);
      if (!mounted) {
        return;
      }
      final merged = <ComicCategory>[
        ..._baseCategories,
        ...remoteCategories.where(
          (category) => category.id.isNotEmpty && !_reservedCategoryIds.contains(category.id),
        ),
      ];
      final selected = _resolveSelectedCategory(merged, state.selectedCategory);
      state = state.copyWith(
        categories: merged,
        selectedCategory: selected,
      );
    } catch (e) {
      if (!mounted) {
        return;
      }
      state = state.copyWith(
        categories: _baseCategories,
        selectedCategory: state.selectedCategory ?? _baseCategories.first,
        error: '加载分类失败 ${e.toString()}',
      );
    }
  }

  Future<void> _loadFeed({required bool reset}) async {
    if (!mounted) return;
    if (state.selectedCategory == null) {
      return;
    }
    if (state.loading || state.loadingMore) {
      return;
    }
    if (!reset && !state.hasMore) {
      return;
    }
    final category = state.selectedCategory!;
    final nextPage = reset ? 1 : _nextPage;
    if (reset) {
      state = state.copyWith(loading: true, error: null);
    } else {
      state = state.copyWith(loadingMore: true);
    }
    try {
      final feed = await _remoteService.fetchFeed(
        categoryId: category.id,
        page: nextPage,
        limit: _pageSize,
        sourceId: state.selectedSource,
      );
      if (!mounted) return;
      final items = reset ? feed.items : <ComicSummary>[...state.comics, ...feed.items];
      _nextPage = nextPage + 1;
      state = state.copyWith(
        comics: items,
        loading: false,
        refreshing: false,
        loadingMore: false,
        hasMore: feed.hasMore,
      );
      _lastFeedAt = DateTime.now();
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        refreshing: false,
        loadingMore: false,
        error: '加载失败 ${e.toString()}',
      );
    }
  }

  void _hydrateFavorites() {
    final repo = _favoritesRepository;
    if (repo == null) {
      return;
    }
    final ids = repo
        .list()
        .where((item) => item.type == 'comic')
        .map((item) => item.id)
        .where((id) => id.isNotEmpty)
        .toSet();
    state = state.copyWith(favoriteIds: ids);
  }

  void _hydrateSearchHistory() {
    final history = _searchHistoryRepository?.list() ?? <String>[];
    state = state.copyWith(searchHistory: history);
  }

  void _hydrateViewMode() {
    final settings = _settingsRepository?.load();
    if (settings == null) {
      return;
    }
    final mode = settings.viewMode == 'list' ? ComicsViewMode.list : ComicsViewMode.grid;
    state = state.copyWith(viewMode: mode);
  }

  ComicCategory _resolveSelectedCategory(List<ComicCategory> categories, ComicCategory? current) {
    if (current == null) {
      return categories.first;
    }
    final match = categories.where((category) => category.id == current.id);
    if (match.isNotEmpty) {
      return match.first;
    }
    return categories.first;
  }
}
