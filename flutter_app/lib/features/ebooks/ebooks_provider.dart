import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_app/features/ebooks/data/ebooks_remote_service.dart';
import 'package:flutter_app/features/ebooks/ebooks_models.dart';
import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';

/// 电子书远程服务提供者
final ebooksRemoteServiceProvider = Provider<EbooksRemoteService>((ref) {
  return EbooksRemoteService();
});

enum EbooksViewMode { grid, list }

/// 电子书状态
class EbooksState {
  final List<EbookCategory> categories;
  final List<EbookSummary> books;
  final List<EbookSourceInfo> sources;
  final EbookSourceInfo? selectedSource;
  final EbookCategory? selectedCategory;
  final String searchQuery;
  final bool loading;
  final bool loadingMore;
  final bool hasMore;
  final int currentPage;
  final bool searching;
  final bool sourceSwitching;
  final String? error;
  final EbooksViewMode viewMode;

  const EbooksState({
    this.categories = const [],
    this.books = const [],
    this.sources = const [],
    this.selectedSource,
    this.selectedCategory,
    this.searchQuery = '',
    this.loading = false,
    this.loadingMore = false,
    this.hasMore = true,
    this.currentPage = 1,
    this.searching = false,
    this.sourceSwitching = false,
    this.error,
    this.viewMode = EbooksViewMode.grid,
  });

  bool get inSearchMode => searchQuery.trim().isNotEmpty;

  EbooksState copyWith({
    List<EbookCategory>? categories,
    List<EbookSummary>? books,
    List<EbookSourceInfo>? sources,
    EbookSourceInfo? selectedSource,
    EbookCategory? selectedCategory,
    String? searchQuery,
    bool? loading,
    bool? loadingMore,
    bool? hasMore,
    int? currentPage,
    bool? searching,
    bool? sourceSwitching,
    String? error,
    EbooksViewMode? viewMode,
  }) {
    return EbooksState(
      categories: categories ?? this.categories,
      books: books ?? this.books,
      sources: sources ?? this.sources,
      selectedSource: selectedSource ?? this.selectedSource,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      searchQuery: searchQuery ?? this.searchQuery,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      hasMore: hasMore ?? this.hasMore,
      currentPage: currentPage ?? this.currentPage,
      searching: searching ?? this.searching,
      sourceSwitching: sourceSwitching ?? this.sourceSwitching,
      error: error,
      viewMode: viewMode ?? this.viewMode,
    );
  }
}

/// 电子书状态通知器
class EbooksNotifier extends StateNotifier<EbooksState> {
  EbooksNotifier({
    required EbooksRemoteService remoteService,
    required SettingsRepository? settingsRepository,
  })  : _remoteService = remoteService,
        _settingsRepository = settingsRepository,
        super(const EbooksState()) {
    _hydrateViewMode();
  }

  final EbooksRemoteService _remoteService;
  final SettingsRepository? _settingsRepository;
  bool _initialized = false;

  void _hydrateViewMode() {
    final settings = _settingsRepository?.load();
    if (settings == null) {
      return;
    }
    final mode = settings.viewMode == 'list' ? EbooksViewMode.list : EbooksViewMode.grid;
    state = state.copyWith(viewMode: mode);
  }

  Future<void> toggleViewMode() async {
    final next = state.viewMode == EbooksViewMode.grid ? EbooksViewMode.list : EbooksViewMode.grid;
    state = state.copyWith(viewMode: next);
    await _settingsRepository?.update({'viewMode': next == EbooksViewMode.list ? 'list' : 'card'});
  }

  /// 初始化
  Future<void> _initialize() async {
    if (_initialized || !mounted) {
      return;
    }
    
    try {
      state = state.copyWith(loading: true, error: null);
      final sources = await _remoteService.fetchSources();
      
      if (!mounted) return;
      
      if (sources.isEmpty) {
        state = state.copyWith(
          loading: false,
          error: '未找到可用的数据源',
        );
        return;
      }
      
      state = state.copyWith(
        sources: sources,
        selectedSource: sources.first,
      );
      
      await _loadCategories(sources.first.id);
      _initialized = true;
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        error: '加载数据源失败: ${e.toString()}',
      );
    }
  }

  /// 确保初始化完成
  Future<void> ensureWarm() async {
    if (!mounted) return;
    
    if (!_initialized) {
      await _initialize();
      if (!mounted) return;
    }
    
    if (state.selectedCategory == null && state.categories.isNotEmpty) {
      state = state.copyWith(selectedCategory: state.categories.first);
    }
    
    if (state.books.isEmpty && state.selectedCategory != null && !state.loading) {
      await loadBooks(reset: true);
    }
  }

  /// 加载更多
  Future<void> loadMore() async {
    if (state.inSearchMode) {
      return;
    }
    await loadBooks(reset: false);
  }

  /// 加载分类
  Future<void> _loadCategories(String sourceId) async {
    try {
      final categories = await _remoteService.fetchCategories(sourceId);
      if (!mounted) return;
      
      state = state.copyWith(
        categories: categories,
        selectedCategory: categories.isNotEmpty ? categories.first : null,
        loading: false,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        error: '加载分类失败: ${e.toString()}',
      );
    }
  }

  /// 切换数据源
  Future<void> changeSource(EbookSourceInfo source) async {
    if (!mounted) return;
    if (state.selectedSource?.id == source.id) return;
    
    state = state.copyWith(
      selectedSource: source,
      sourceSwitching: true,
      books: [],
      categories: [],
      selectedCategory: null,
      currentPage: 1,
      hasMore: true,
      error: null,
    );
    
    await _loadCategories(source.id);
    if (!mounted) return;
    
    if (state.selectedCategory != null) {
      await loadBooks(reset: true);
    }
    if (!mounted) return;
    state = state.copyWith(sourceSwitching: false);
  }

  /// 切换分类
  Future<void> changeCategory(EbookCategory category) async {
    if (state.selectedCategory?.id == category.id) return;
    
    state = state.copyWith(
      selectedCategory: category,
      books: [],
      currentPage: 1,
      hasMore: true,
      error: null,
    );
    await loadBooks(reset: true);
  }

  /// 搜索书籍
  Future<void> searchBooks(String keyword) async {
    if (keyword.trim().isEmpty) {
      clearSearch();
      return;
    }

    state = state.copyWith(
      searchQuery: keyword,
      searching: true,
      books: [],
      currentPage: 1,
      hasMore: true,
      error: null,
    );

    try {
      final sourceId = state.selectedSource?.id ?? 'kanunu8';
      final books = await _remoteService.searchBooks(
        keyword: keyword,
        source: sourceId,
        page: 1,
      );
      if (!mounted) return;
      state = state.copyWith(
        books: books,
        searching: false,
        hasMore: books.isNotEmpty,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(searching: false, error: e.toString());
    }
  }

  /// 清除搜索
  void clearSearch() {
    if (state.searchQuery.isNotEmpty) {
      state = state.copyWith(
        searchQuery: '',
        searching: false,
        books: [],
        currentPage: 1,
        hasMore: true,
      );
      if (state.selectedCategory != null) {
        loadBooks(reset: true);
      }
    }
  }

  /// 加载书籍
  Future<void> loadBooks({bool reset = false}) async {
    if (!mounted) return;
    if (state.loading || state.loadingMore) return;
    if (!reset && !state.hasMore) return;
    
    final sourceId = state.selectedSource?.id ?? 'kanunu8';
    final categoryId = state.selectedCategory?.id;
    
    if (categoryId == null) return;

    try {
      if (reset) {
        state = state.copyWith(loading: true, error: null);
      } else {
        state = state.copyWith(loadingMore: true);
      }
      
      final page = reset ? 1 : state.currentPage;
      final books = await _remoteService.fetchBooksByCategory(
        categoryId: categoryId,
        source: sourceId,
        page: page,
      );

      if (!mounted) return;
      final allBooks = reset ? books : [...state.books, ...books];
      // 只有当返回空列表时才认为没有更多数据
      final hasMore = books.isNotEmpty;

      state = state.copyWith(
        books: allBooks,
        loading: false,
        loadingMore: false,
        currentPage: page + 1,
        hasMore: hasMore,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        loadingMore: false,
        error: e.toString(),
      );
    }
  }

  /// 刷新
  Future<void> refresh() async {
    if (state.inSearchMode) {
      await searchBooks(state.searchQuery);
    } else {
      await loadBooks(reset: true);
    }
  }
}

/// 电子书提供者
final ebooksProvider = StateNotifierProvider<EbooksNotifier, EbooksState>((ref) {
  final remoteService = ref.watch(ebooksRemoteServiceProvider);
  final settingsRepository = ref.watch(settingsRepositoryProvider);
  return EbooksNotifier(
    remoteService: remoteService,
    settingsRepository: settingsRepository,
  );
});

/// 电子书详情状态
class EbookDetailState {
  final EbookDetail? detail;
  final List<EbookChapter> chapters;
  final bool isLoading;
  final bool isDownloaded;
  final bool isDownloading;
  final double downloadProgress;
  final String? error;

  const EbookDetailState({
    this.detail,
    this.chapters = const [],
    this.isLoading = false,
    this.isDownloaded = false,
    this.isDownloading = false,
    this.downloadProgress = 0.0,
    this.error,
  });

  EbookDetailState copyWith({
    EbookDetail? detail,
    List<EbookChapter>? chapters,
    bool? isLoading,
    bool? isDownloaded,
    bool? isDownloading,
    double? downloadProgress,
    String? error,
  }) {
    return EbookDetailState(
      detail: detail ?? this.detail,
      chapters: chapters ?? this.chapters,
      isLoading: isLoading ?? this.isLoading,
      isDownloaded: isDownloaded ?? this.isDownloaded,
      isDownloading: isDownloading ?? this.isDownloading,
      downloadProgress: downloadProgress ?? this.downloadProgress,
      error: error ?? this.error,
    );
  }
}

/// 电子书详情状态通知器
class EbookDetailNotifier extends StateNotifier<EbookDetailState> {
  final EbooksRemoteService _remoteService;

  EbookDetailNotifier(this._remoteService) : super(const EbookDetailState());

  /// 加载书籍详情
  Future<void> loadDetail(String bookId, String source) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      
      final detail = await _remoteService.fetchBookDetail(
        bookId: bookId,
        source: source,
      );
      
      state = state.copyWith(
        detail: detail,
        chapters: detail.chapters,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// 加载章节列表
  Future<void> loadChapters(String bookId, String source) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      
      final chapters = await _remoteService.fetchChapters(
        bookId: bookId,
        source: source,
      );
      
      state = state.copyWith(
        chapters: chapters,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// 下载书籍
  Future<void> downloadBook() async {
    // TODO: 实现下载逻辑
    state = state.copyWith(isDownloading: true);
    
    // 模拟下载进度
    for (int i = 0; i <= 100; i += 10) {
      await Future.delayed(const Duration(milliseconds: 100));
      state = state.copyWith(downloadProgress: i / 100.0);
    }
    
    state = state.copyWith(
      isDownloading: false,
      isDownloaded: true,
      downloadProgress: 0.0,
    );
  }

  /// 暂停下载
  void pauseDownload() {
    state = state.copyWith(isDownloading: false);
  }

  /// 继续下载
  void resumeDownload() {
    state = state.copyWith(isDownloading: true);
  }

  /// 取消下载
  void cancelDownload() {
    state = state.copyWith(
      isDownloading: false,
      downloadProgress: 0.0,
    );
  }

  /// 删除下载
  Future<void> deleteDownload() async {
    // TODO: 实现删除逻辑
    state = state.copyWith(isDownloaded: false);
  }

  /// 清除错误
  void clearError() {
    state = state.copyWith(error: null);
  }
}

/// 电子书详情提供者
final ebookDetailProvider = StateNotifierProvider.family<EbookDetailNotifier, EbookDetailState, String>((ref, bookId) {
  final remoteService = ref.watch(ebooksRemoteServiceProvider);
  return EbookDetailNotifier(remoteService);
});
