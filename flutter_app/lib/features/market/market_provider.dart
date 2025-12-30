import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_app/features/market/market_models.dart';
import 'package:flutter_app/features/market/data/market_remote_service.dart';
import 'package:flutter_app/core/storage/storage_providers.dart';
import 'package:flutter_app/core/storage/storage_repository.dart';
import 'package:flutter_app/core/network/network_providers.dart';

/// 市场远程服务 Provider
final marketRemoteServiceProvider = Provider<MarketRemoteService>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return MarketRemoteService(apiClient);
});

/// 市场状态
class MarketState {
  const MarketState({
    this.sources = const [],
    this.categories = const [],
    this.selectedCategory,
    this.installedSources = const {},
    this.loading = false,
    this.error,
    this.searchKeyword = '',
    this.searchResults = const [],
    this.activating = false,
    this.activationError,
    this.isActivated = false,
  });

  final List<MarketSource> sources;
  final List<MarketCategory> categories;
  final MarketCategory? selectedCategory;
  final Map<String, List<String>> installedSources;
  final bool loading;
  final String? error;
  final String searchKeyword;
  final List<MarketSource> searchResults;
  final bool activating;
  final String? activationError;
  final bool isActivated;

  /// 是否处于搜索模式
  bool get inSearchMode => searchKeyword.trim().isNotEmpty;

  /// 显示的数据源列表
  List<MarketSource> get displaySources {
    if (inSearchMode) {
      return searchResults;
    }
    if (selectedCategory == null || selectedCategory!.id == 'all') {
      return sources;
    }
    return sources.where((s) => s.category == selectedCategory!.id).toList();
  }

  MarketState copyWith({
    List<MarketSource>? sources,
    List<MarketCategory>? categories,
    MarketCategory? selectedCategory,
    Map<String, List<String>>? installedSources,
    bool? loading,
    String? error,
    String? searchKeyword,
    List<MarketSource>? searchResults,
    bool? activating,
    String? activationError,
    bool? isActivated,
  }) {
    return MarketState(
      sources: sources ?? this.sources,
      categories: categories ?? this.categories,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      installedSources: installedSources ?? this.installedSources,
      loading: loading ?? this.loading,
      error: error,
      searchKeyword: searchKeyword ?? this.searchKeyword,
      searchResults: searchResults ?? this.searchResults,
      activating: activating ?? this.activating,
      activationError: activationError,
      isActivated: isActivated ?? this.isActivated,
    );
  }
}

/// 市场 Notifier
class MarketNotifier extends StateNotifier<MarketState> {
  MarketNotifier({
    required MarketRemoteService remoteService,
    required SourceRepository? sourceRepository,
    required ActivationRepository? activationRepository,
  })  : _remoteService = remoteService,
        _sourceRepository = sourceRepository,
        _activationRepository = activationRepository,
        super(const MarketState()) {
    _init();
  }

  final MarketRemoteService _remoteService;
  final SourceRepository? _sourceRepository;
  final ActivationRepository? _activationRepository;

  /// 初始化
  Future<void> _init() async {
    _checkActivationStatus();
    await _loadMarketData();
    _hydrateInstalledSources();
  }

  /// 检查激活状态
  void _checkActivationStatus() {
    final token = _activationRepository?.loadToken() ?? '';
    final isActivated = token.isNotEmpty;
    state = state.copyWith(isActivated: isActivated);
  }

  /// 加载市场数据
  Future<void> _loadMarketData() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final marketData = await _remoteService.fetchMarketData();
      state = state.copyWith(
        sources: marketData.sources,
        categories: marketData.categories,
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: '加载市场数据失败: ${e.toString()}',
      );
    }
  }

  /// 从存储恢复已安装源列表
  void _hydrateInstalledSources() {
    final installed = _sourceRepository?.listInstalled() ?? {};
    state = state.copyWith(installedSources: installed);
  }

  /// 选择分类
  void selectCategory(MarketCategory? category) {
    state = state.copyWith(selectedCategory: category);
  }

  /// 安装数据源
  Future<void> installSource(MarketSource source) async {
    final success = await _sourceRepository?.install(source.id, source.category);
    if (success == true) {
      _hydrateInstalledSources();
    } else {
      state = state.copyWith(error: '安装数据源失败');
    }
  }

  /// 卸载数据源
  Future<void> uninstallSource(String sourceId) async {
    final success = await _sourceRepository?.uninstall(sourceId);
    if (success == true) {
      _hydrateInstalledSources();
    } else {
      state = state.copyWith(error: '卸载数据源失败');
    }
  }

  /// 搜索
  Future<void> search(String keyword) async {
    final trimmed = keyword.trim();
    if (trimmed.isEmpty) {
      clearSearch();
      return;
    }

    final lowerKeyword = trimmed.toLowerCase();
    final results = state.sources.where((s) {
      return s.name.toLowerCase().contains(lowerKeyword) ||
          s.description.toLowerCase().contains(lowerKeyword) ||
          s.tags.any((t) => t.toLowerCase().contains(lowerKeyword));
    }).toList();

    state = state.copyWith(
      searchKeyword: trimmed,
      searchResults: results,
    );
  }

  /// 清除搜索
  void clearSearch() {
    state = state.copyWith(
      searchKeyword: '',
      searchResults: const [],
    );
  }

  /// 刷新数据
  Future<void> refresh() async {
    await _loadMarketData();
  }

  /// 清除错误
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// 验证激活码
  Future<void> activate(String code) async {
    state = state.copyWith(activating: true, activationError: null);
    try {
      final response = await _remoteService.activate(code);
      if (response.success && response.token != null) {
        await _activationRepository?.saveToken(response.token);
        state = state.copyWith(
          activating: false,
          isActivated: true,
        );
        // 重新加载数据（现在可以访问全部数据源）
        await _loadMarketData();
      } else {
        state = state.copyWith(
          activating: false,
          activationError: response.message ?? '激活失败',
        );
      }
    } catch (e) {
      state = state.copyWith(
        activating: false,
        activationError: '激活失败: ${e.toString()}',
      );
    }
  }
}

/// 市场 Provider
final marketProvider =
    StateNotifierProvider<MarketNotifier, MarketState>((ref) {
  final remoteService = ref.watch(marketRemoteServiceProvider);
  final sourceRepository = ref.watch(sourceRepositoryProvider);
  final activationRepository = ref.watch(activationRepositoryProvider);
  return MarketNotifier(
    remoteService: remoteService,
    sourceRepository: sourceRepository,
    activationRepository: activationRepository,
  );
});
