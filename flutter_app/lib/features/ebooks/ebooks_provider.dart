import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_app/features/ebooks/data/ebooks_remote_service.dart';
import 'package:flutter_app/features/ebooks/ebooks_models.dart';

/// 电子书远程服务提供者
final ebooksRemoteServiceProvider = Provider<EbooksRemoteService>((ref) {
  return EbooksRemoteService();
});

/// 电子书状态
class EbooksState {
  final List<EbookCategory> categories;
  final List<EbookSummary> books;
  final EbookSourceInfo? selectedSource;
  final EbookCategory? selectedCategory;
  final String searchQuery;
  final bool isLoading;
  final bool hasMore;
  final int currentPage;
  final bool isSearching;
  final String? error;

  const EbooksState({
    this.categories = const [],
    this.books = const [],
    this.selectedSource,
    this.selectedCategory,
    this.searchQuery = '',
    this.isLoading = false,
    this.hasMore = true,
    this.currentPage = 1,
    this.isSearching = false,
    this.error,
  });

  EbooksState copyWith({
    List<EbookCategory>? categories,
    List<EbookSummary>? books,
    EbookSourceInfo? selectedSource,
    EbookCategory? selectedCategory,
    String? searchQuery,
    bool? isLoading,
    bool? hasMore,
    int? currentPage,
    bool? isSearching,
    String? error,
  }) {
    return EbooksState(
      categories: categories ?? this.categories,
      books: books ?? this.books,
      selectedSource: selectedSource ?? this.selectedSource,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      searchQuery: searchQuery ?? this.searchQuery,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      currentPage: currentPage ?? this.currentPage,
      isSearching: isSearching ?? this.isSearching,
      error: error ?? this.error,
    );
  }
}

/// 电子书状态通知器
class EbooksNotifier extends StateNotifier<EbooksState> {
  final EbooksRemoteService _remoteService;

  EbooksNotifier(this._remoteService) : super(const EbooksState()) {
    _initialize();
  }

  /// 初始化
  Future<void> _initialize() async {
    try {
      // 获取数据源列表
      final sources = await _remoteService.fetchSources();
      if (sources.isNotEmpty) {
        state = state.copyWith(selectedSource: sources.first);
        await _loadCategories(sources.first.id);
      }
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  /// 加载分类
  Future<void> _loadCategories(String sourceId) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      final categories = await _remoteService.fetchCategories(sourceId);
      state = state.copyWith(
        categories: categories,
        isLoading: false,
      );
      
      // 自动选择第一个分类
      if (categories.isNotEmpty) {
        await changeCategory(categories.first);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// 切换数据源
  Future<void> changeSource(EbookSourceInfo source) async {
    if (state.selectedSource?.id == source.id) return;
    
    state = state.copyWith(selectedSource: source, books: []);
    await _loadCategories(source.id);
  }

  /// 切换分类
  Future<void> changeCategory(EbookCategory category) async {
    if (state.selectedCategory?.id == category.id) return;
    
    state = state.copyWith(
      selectedCategory: category,
      books: [],
      currentPage: 1,
      hasMore: true,
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
      isSearching: true,
      books: [],
      currentPage: 1,
      hasMore: true,
    );

    try {
      final sourceId = state.selectedSource?.id ?? 'kanunu8';
      final books = await _remoteService.searchBooks(
        keyword: keyword,
        source: sourceId,
        page: 1,
      );
      state = state.copyWith(
        books: books,
        isSearching: false,
        hasMore: books.length == 20, // 假设每页20条
      );
    } catch (e) {
      state = state.copyWith(isSearching: false, error: e.toString());
    }
  }

  /// 清除搜索
  void clearSearch() {
    if (state.searchQuery.isNotEmpty) {
      state = state.copyWith(
        searchQuery: '',
        isSearching: false,
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
    if (state.isLoading) return;
    
    final sourceId = state.selectedSource?.id ?? 'kanunu8';
    final categoryId = state.selectedCategory?.id;
    
    if (categoryId == null) return;

    try {
      state = state.copyWith(isLoading: true, error: null);
      
      final page = reset ? 1 : state.currentPage;
      final books = await _remoteService.fetchBooksByCategory(
        categoryId: categoryId,
        source: sourceId,
        page: page,
      );

      final allBooks = reset ? books : [...state.books, ...books];
      final hasMore = books.length == 20; // 假设每页20条

      state = state.copyWith(
        books: allBooks,
        isLoading: false,
        currentPage: page + 1,
        hasMore: hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// 刷新
  Future<void> refresh() async {
    if (state.isSearching) {
      await searchBooks(state.searchQuery);
    } else {
      await loadBooks(reset: true);
    }
  }

  /// 清除错误
  void clearError() {
    state = state.copyWith(error: null);
  }
}

/// 电子书提供者
final ebooksProvider = StateNotifierProvider<EbooksNotifier, EbooksState>((ref) {
  final remoteService = ref.watch(ebooksRemoteServiceProvider);
  return EbooksNotifier(remoteService);
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
