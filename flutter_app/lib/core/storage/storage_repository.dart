import 'app_storage.dart';

class SettingsRepository {
  SettingsRepository(this._storage);

  final AppStorage _storage;

  SettingsModel load() {
    return _storage.getSettings();
  }

  Future<bool> save(SettingsModel settings) {
    return _storage.saveSettings(settings);
  }

  Future<bool> update(Map<String, dynamic> patch) {
    final current = load();
    final next = SettingsModel(
      readingMode: patch['readingMode'] as String? ?? current.readingMode,
      readingDirection: patch['readingDirection'] as String? ?? current.readingDirection,
      scrollMode: patch['scrollMode'] as String? ?? current.scrollMode,
      imageFitMode: patch['imageFitMode'] as String? ?? current.imageFitMode,
      backgroundColor: patch['backgroundColor'] as String? ?? current.backgroundColor,
      brightness: (patch['brightness'] as num?)?.toDouble() ?? current.brightness,
      keepScreenOn: patch['keepScreenOn'] as bool? ?? current.keepScreenOn,
      darkMode: patch['darkMode'] as bool? ?? current.darkMode,
      autoLoadHD: patch['autoLoadHD'] as bool? ?? current.autoLoadHD,
      maxConcurrentDownloads: patch['maxConcurrentDownloads'] as int? ?? current.maxConcurrentDownloads,
      viewMode: patch['viewMode'] as String? ?? current.viewMode,
      showFavoriteTab: patch['showFavoriteTab'] as bool? ?? current.showFavoriteTab,
      videoOrientationMode: patch['videoOrientationMode'] as String? ?? current.videoOrientationMode,
    );
    return save(next);
  }
}

class FavoritesRepository {
  FavoritesRepository(this._storage);

  final AppStorage _storage;

  List<FavoriteItem> list() {
    return _storage.getFavorites();
  }

  Future<bool> add(FavoriteItem item) async {
    if (item.id.isEmpty) {
      return false;
    }
    final items = list();
    final exists = items.any((e) => e.id == item.id);
    if (!exists) {
      items.insert(0, item);
      return _storage.saveFavorites(items);
    }
    return true;
  }

  Future<bool> remove(String id) async {
    if (id.isEmpty) {
      return false;
    }
    final items = list().where((e) => e.id != id).toList();
    return _storage.saveFavorites(items);
  }

  bool isFavorite(String id) {
    if (id.isEmpty) {
      return false;
    }
    return list().any((e) => e.id == id);
  }
}

class HistoryRepository {
  HistoryRepository(this._storage);

  static const _maxHistory = 100;

  final AppStorage _storage;

  List<HistoryItem> list() {
    return _storage.getHistory();
  }

  Future<bool> addComic({
    required String id,
    required String title,
    required String chapterId,
    required int page,
    String? cover,
    String? source,
  }) async {
    if (id.isEmpty || chapterId.isEmpty) {
      return false;
    }
    final item = HistoryItem(
      id: id,
      type: 'comic',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      title: title,
      cover: cover,
      source: source,
      lastChapterId: chapterId,
      lastPage: page,
    );
    return _saveItem(item);
  }

  Future<bool> addEbook({
    required String id,
    required String title,
    required String chapterId,
    required int page,
    String? cover,
    String? source,
  }) async {
    if (id.isEmpty || chapterId.isEmpty) {
      return false;
    }
    final item = HistoryItem(
      id: id,
      type: 'ebook',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      title: title,
      cover: cover,
      source: source,
      lastChapterId: chapterId,
      lastPage: page,
    );
    return _saveItem(item);
  }

  Future<bool> addVideo({
    required String id,
    required String title,
    required String episodeId,
    required int positionSeconds,
    required int durationSeconds,
    String? cover,
    String? source,
  }) async {
    if (id.isEmpty || episodeId.isEmpty) {
      return false;
    }
    final item = HistoryItem(
      id: id,
      type: 'video',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      title: title,
      cover: cover,
      source: source,
      lastEpisodeId: episodeId,
      lastPositionSeconds: positionSeconds,
      lastDurationSeconds: durationSeconds,
    );
    return _saveItem(item);
  }

  Future<bool> addNovel({
    required String id,
    required String title,
    required String chapterId,
    required double scrollOffset,
    String? cover,
    String? source,
  }) async {
    if (id.isEmpty || chapterId.isEmpty) {
      return false;
    }
    final item = HistoryItem(
      id: id,
      type: 'novel',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      title: title,
      cover: cover,
      source: source,
      lastChapterId: chapterId,
      scrollOffset: scrollOffset,
    );
    return _saveItem(item);
  }

  Future<bool> clear() {
    return _storage.clearHistory();
  }

  Future<bool> _saveItem(HistoryItem item) async {
    final list = _storage.getHistory();
    final filtered = list.where((e) => e.id != item.id || e.type != item.type).toList();
    filtered.insert(0, item);
    if (filtered.length > _maxHistory) {
      filtered.removeRange(_maxHistory, filtered.length);
    }
    return _storage.saveHistory(filtered);
  }
}

class SearchHistoryRepository {
  SearchHistoryRepository(this._storage);

  static const _maxRecords = 20;

  final AppStorage _storage;

  List<String> list() {
    return _storage.getSearchHistory();
  }

  Future<bool> add(String keyword) {
    if (keyword.trim().isEmpty) {
      return Future.value(false);
    }
    final list = _storage.getSearchHistory();
    list.removeWhere((e) => e == keyword);
    list.insert(0, keyword);
    if (list.length > _maxRecords) {
      list.removeRange(_maxRecords, list.length);
    }
    return _storage.saveSearchHistory(list);
  }

  Future<bool> clear() {
    return _storage.saveSearchHistory(<String>[]);
  }
}

class SourceRepository {
  SourceRepository(this._storage);

  final AppStorage _storage;

  Map<String, List<String>> listInstalled() {
    return _storage.getInstalledSources();
  }

  Future<bool> install(String sourceId, String category) {
    if (sourceId.isEmpty || category.isEmpty) {
      return Future.value(false);
    }
    return _storage.installSource(sourceId, category);
  }

  Future<bool> uninstall(String sourceId) {
    if (sourceId.isEmpty) {
      return Future.value(false);
    }
    return _storage.uninstallSource(sourceId);
  }

  String? currentSource() {
    return _storage.getCurrentSource();
  }

  Future<bool> setCurrentSource(String? sourceId) {
    return _storage.setCurrentSource(sourceId);
  }
}

class VideoSourceRepository {
  VideoSourceRepository(this._storage);

  final AppStorage _storage;

  String? currentSource() {
    return _storage.getCurrentVideoSource();
  }

  Future<bool> setCurrentSource(String? sourceId) {
    return _storage.setCurrentVideoSource(sourceId);
  }
}

class ActivationRepository {
  ActivationRepository(this._storage);

  final AppStorage _storage;

  String loadToken() {
    return _storage.getActivationToken();
  }

  Future<bool> saveToken(String? token) {
    return _storage.saveActivationToken(token);
  }
}
