import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/network_providers.dart';
import '../../core/storage/storage_providers.dart';
import 'ebook_models.dart';
import 'data/ebook_remote_service.dart';
import 'ebook_repository.dart';

final ebookRemoteServiceProvider = Provider<EbookRemoteService>((ref) {
  final api = ref.watch(apiClientProvider);
  return EbookRemoteService(api);
});

class EbookListState {
  const EbookListState({
    this.categories = const <EbookCategory>[],
    this.books = const <EbookSummary>[],
    this.selectedCategory,
    this.loading = false,
    this.refreshing = false,
    this.loadingMore = false,
    this.hasMore = false,
    this.error,
    this.sources = const <String, EbookSourceInfo>{},
    this.selectedSource,
    this.sourcesLoading = false,
    this.searchKeyword = '',
    this.searchResults = const <EbookSummary>[],
    this.searching = false,
  });

  final List<EbookCategory> categories;
  final List<EbookSummary> books;
  final EbookCategory? selectedCategory;
  final bool loading;
  final bool refreshing;
  final bool loadingMore;
  final bool hasMore;
  final String? error;
  final Map<String, EbookSourceInfo> sources;
  final String? selectedSource;
  final bool sourcesLoading;
  final String searchKeyword;
  final List<EbookSummary> searchResults;
  final bool searching;

  bool get inSearchMode => searchKeyword.trim().isNotEmpty;

  EbookListState copyWith({
    List<EbookCategory>? categories,
    List<EbookSummary>? books,
    EbookCategory? selectedCategory,
    bool? loading,
    bool? refreshing,
    bool? loadingMore,
    bool? hasMore,
    String? error,
    Map<String, EbookSourceInfo>? sources,
    String? selectedSource,
    bool? sourcesLoading,
    String? searchKeyword,
    List<EbookSummary>? searchResults,
    bool? searching,
  }) {
    return EbookListState(
      categories: categories != null ? List.unmodifiable(categories) : this.categories,
      books: books != null ? List.unmodifiable(books) : this.books,
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
    );
  }
}

final ebookListProvider = StateNotifierProvider<EbookListNotifier, EbookListState>((ref) {
  final remote = ref.watch(ebookRemoteServiceProvider);
  return EbookListNotifier(remoteService: remote);
});

class EbookListNotifier extends StateNotifier<EbookListState> {
  EbookListNotifier({
    required EbookRemoteService remoteService,
  })  : _remoteService = remoteService,
        super(const EbookListState()) {
    _init();
  }

  static const int _pageSize = 20;

  final EbookRemoteService _remoteService;

  int _nextPage = 1;
  int _searchToken = 0;
  bool _initializing = false;
  DateTime? _lastFeedAt;

  Future<void> _init() async {
    if (_initializing) {
      return;
    }
    _initializing = true;
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
    if (_lastFeedAt != null && now.difference(_lastFeedAt!).inMinutes < 1 && state.books.isNotEmpty) {
      return;
    }
    if (state.books.isEmpty) {
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

  Future<void> selectCategory(EbookCategory category) async {
    if (category.id == state.selectedCategory?.id) {
      return;
    }
    state = state.copyWith(selectedCategory: category);
    await _loadFeed(reset: true);
  }

  Future<void> changeSource(String sourceId) async {
    if (sourceId.isEmpty || sourceId == state.selectedSource) {
      return;
    }
    state = state.copyWith(selectedSource: sourceId);
    await _loadCategories(sourceId);
    await _loadFeed(reset: true);
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
      final results = await _remoteService.searchBooks(
        keyword: trimmed,
        sourceId: state.selectedSource,
      );
      if (!mounted || token != _searchToken) {
        return;
      }
      state = state.copyWith(
        searchResults: results.items,
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
      searchResults: const <EbookSummary>[],
      searching: false,
    );
  }

  Future<void> _loadSources() async {
    state = state.copyWith(sourcesLoading: true, error: null);
    try {
      final remoteSources = await _remoteService.fetchSources();
      String? selectedSource = state.selectedSource;
      if ((selectedSource == null || (remoteSources.sources.isNotEmpty && !remoteSources.sources.map((s) => s.id).contains(selectedSource))) && remoteSources.sources.isNotEmpty) {
        selectedSource = remoteSources.sources.first.id;
      }
      if (!mounted) {
        return;
      }
      final sourcesMap = <String, EbookSourceInfo>{};
      for (final source in remoteSources.sources) {
        sourcesMap[source.id] = source;
      }
      state = state.copyWith(
        sources: sourcesMap,
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
      final remoteCategories = await _remoteService.fetchCategories(sourceId: sourceId);
      if (!mounted) {
        return;
      }
      final selected = _resolveSelectedCategory(remoteCategories.categories, state.selectedCategory);
      state = state.copyWith(
        categories: remoteCategories.categories,
        selectedCategory: selected,
      );
    } catch (e) {
      if (!mounted) {
        return;
      }
      state = state.copyWith(
        categories: const <EbookCategory>[],
        selectedCategory: null,
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
      final feed = await _remoteService.fetchBooksByCategory(
        categoryId: category.id,
        page: nextPage,
        limit: _pageSize,
        sourceId: state.selectedSource,
      );
      if (!mounted) return;
      final items = reset ? feed.items : <EbookSummary>[...state.books, ...feed.items];
      _nextPage = nextPage + 1;
      state = state.copyWith(
        books: items,
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

  EbookCategory? _resolveSelectedCategory(List<EbookCategory> categories, EbookCategory? current) {
    if (current == null) {
      return categories.isNotEmpty ? categories.first : null;
    }
    final match = categories.where((category) => category.id == current.id);
    if (match.isNotEmpty) {
      return match.first;
    }
    return categories.isNotEmpty ? categories.first : null;
  }
}

class EbookDetailState {
  const EbookDetailState({
    this.detail,
    this.chapters = const <EbookChapter>[],
    this.loading = false,
    this.error,
  });

  final EbookDetail? detail;
  final List<EbookChapter> chapters;
  final bool loading;
  final String? error;

  EbookDetailState copyWith({
    EbookDetail? detail,
    List<EbookChapter>? chapters,
    bool? loading,
    String? error,
  }) {
    return EbookDetailState(
      detail: detail ?? this.detail,
      chapters: chapters != null ? List.unmodifiable(chapters) : this.chapters,
      loading: loading ?? this.loading,
      error: error,
    );
  }
}

final ebookDetailProvider = StateNotifierProvider.family<EbookDetailNotifier, EbookDetailState, String>((ref, bookId) {
  final remote = ref.watch(ebookRemoteServiceProvider);
  return EbookDetailNotifier(remoteService: remote, bookId: bookId);
});

class EbookDetailNotifier extends StateNotifier<EbookDetailState> {
  EbookDetailNotifier({
    required EbookRemoteService remoteService,
    required String bookId,
  })  : _remoteService = remoteService,
        _bookId = bookId,
        super(const EbookDetailState()) {
    load();
  }

  final EbookRemoteService _remoteService;
  final String _bookId;

  Future<void> load() async {
    if (!mounted) return;
    if (state.loading) {
      return;
    }
    state = state.copyWith(loading: true, error: null);
    try {
      final detailData = await _remoteService.fetchBookDetail(
        bookId: _bookId,
        sourceId: null,
      );
      if (!mounted) return;
      state = state.copyWith(
        detail: detailData.detail,
        chapters: detailData.chapters,
        loading: false,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        error: '加载失败 ${e.toString()}',
      );
    }
  }
}

class EbookChapterContentState {
  const EbookChapterContentState({
    this.content,
    this.loading = false,
    this.error,
  });

  final EbookChapterContent? content;
  final bool loading;
  final String? error;

  EbookChapterContentState copyWith({
    EbookChapterContent? content,
    bool? loading,
    String? error,
  }) {
    return EbookChapterContentState(
      content: content ?? this.content,
      loading: loading ?? this.loading,
      error: error,
    );
  }
}

final chapterContentProvider = StateNotifierProvider.family<EbookChapterContentNotifier, EbookChapterContentState, String>((ref, chapterId) {
  final remote = ref.watch(ebookRemoteServiceProvider);
  return EbookChapterContentNotifier(remoteService: remote, chapterId: chapterId);
});

class EbookChapterContentNotifier extends StateNotifier<EbookChapterContentState> {
  EbookChapterContentNotifier({
    required EbookRemoteService remoteService,
    required String chapterId,
  })  : _remoteService = remoteService,
        _chapterId = chapterId,
        super(const EbookChapterContentState()) {
    load();
  }

  final EbookRemoteService _remoteService;
  final String _chapterId;

  Future<void> load() async {
    if (!mounted) return;
    if (state.loading) {
      return;
    }
    state = state.copyWith(loading: true, error: null);
    try {
      final content = await _remoteService.fetchChapterContent(
        chapterId: _chapterId,
        sourceId: null,
      );
      if (!mounted) return;
      state = state.copyWith(
        content: content,
        loading: false,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        error: '加载失败 ${e.toString()}',
      );
    }
  }
}
