import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

const _kFavorites = 'favorites';
const _kHistory = 'history';
const _kSettings = 'settings';
const _kSearchHistory = 'search_history';
const _kCurrentSource = 'current_source';
const _kInstalledSources = 'installed_sources';
const _kActivationToken = 'activation_token';
const _kVideoSource = 'video_current_source';
const _kDownloadQueue = 'download_queue';
const _kDownloadCompleted = 'download_completed';

class SettingsModel {
  SettingsModel({
    this.readingMode = 'single',
    this.readingDirection = 'ltr',
    this.scrollMode = 'horizontal',
    this.imageFitMode = 'width',
    this.backgroundColor = 'black',
    this.brightness = 1.0,
    this.keepScreenOn = true,
    this.darkMode = false,
    this.autoLoadHD = false,
    this.maxConcurrentDownloads = 4,
    this.viewMode = 'card',
    this.showFavoriteTab = true,
    this.videoOrientationMode = 'auto',
    this.imageZoomScale = 1.0,
    this.enableRemoveWhiteBorder = false,
  });

  final String readingMode;
  final String readingDirection;
  final String scrollMode;
  final String imageFitMode;
  final String backgroundColor;
  final double brightness;
  final bool keepScreenOn;
  final bool darkMode;
  final bool autoLoadHD;
  final int maxConcurrentDownloads;
  final String viewMode;
  final bool showFavoriteTab;
  final String videoOrientationMode;
  final double imageZoomScale;
  final bool enableRemoveWhiteBorder;

  SettingsModel copyWith({
    String? readingMode,
    String? readingDirection,
    String? scrollMode,
    String? imageFitMode,
    String? backgroundColor,
    double? brightness,
    bool? keepScreenOn,
    bool? darkMode,
    bool? autoLoadHD,
    int? maxConcurrentDownloads,
    String? viewMode,
    bool? showFavoriteTab,
    String? videoOrientationMode,
    double? imageZoomScale,
    bool? enableRemoveWhiteBorder,
  }) {
    return SettingsModel(
      readingMode: readingMode ?? this.readingMode,
      readingDirection: readingDirection ?? this.readingDirection,
      scrollMode: scrollMode ?? this.scrollMode,
      imageFitMode: imageFitMode ?? this.imageFitMode,
      backgroundColor: backgroundColor ?? this.backgroundColor,
      brightness: brightness ?? this.brightness,
      keepScreenOn: keepScreenOn ?? this.keepScreenOn,
      darkMode: darkMode ?? this.darkMode,
      autoLoadHD: autoLoadHD ?? this.autoLoadHD,
      maxConcurrentDownloads: maxConcurrentDownloads ?? this.maxConcurrentDownloads,
      viewMode: viewMode ?? this.viewMode,
      showFavoriteTab: showFavoriteTab ?? this.showFavoriteTab,
      videoOrientationMode: videoOrientationMode ?? this.videoOrientationMode,
      imageZoomScale: imageZoomScale ?? this.imageZoomScale,
      enableRemoveWhiteBorder: enableRemoveWhiteBorder ?? this.enableRemoveWhiteBorder,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'readingMode': readingMode,
      'readingDirection': readingDirection,
      'scrollMode': scrollMode,
      'imageFitMode': imageFitMode,
      'backgroundColor': backgroundColor,
      'brightness': brightness,
      'keepScreenOn': keepScreenOn,
      'darkMode': darkMode,
      'autoLoadHD': autoLoadHD,
      'maxConcurrentDownloads': maxConcurrentDownloads,
      'viewMode': viewMode,
      'showFavoriteTab': showFavoriteTab,
      'videoOrientationMode': videoOrientationMode,
      'imageZoomScale': imageZoomScale,
      'enableRemoveWhiteBorder': enableRemoveWhiteBorder,
    };
  }

  factory SettingsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return SettingsModel();
    }
    return SettingsModel(
      readingMode: json['readingMode'] as String? ?? 'single',
      readingDirection: json['readingDirection'] as String? ?? 'ltr',
      scrollMode: json['scrollMode'] as String? ?? 'horizontal',
      imageFitMode: json['imageFitMode'] as String? ?? 'width',
      backgroundColor: json['backgroundColor'] as String? ?? 'black',
      brightness: (json['brightness'] as num?)?.toDouble() ?? 1.0,
      keepScreenOn: json['keepScreenOn'] as bool? ?? true,
      darkMode: json['darkMode'] as bool? ?? false,
      autoLoadHD: json['autoLoadHD'] as bool? ?? false,
      maxConcurrentDownloads: json['maxConcurrentDownloads'] as int? ?? 4,
      viewMode: json['viewMode'] as String? ?? 'card',
      showFavoriteTab: json['showFavoriteTab'] as bool? ?? true,
      videoOrientationMode: json['videoOrientationMode'] as String? ?? 'auto',
      imageZoomScale: (json['imageZoomScale'] as num?)?.toDouble() ?? 1.0,
      enableRemoveWhiteBorder: json['enableRemoveWhiteBorder'] as bool? ?? false,
    );
  }
}

class FavoriteItem {
  FavoriteItem({
    required this.id,
    required this.title,
    this.cover,
    this.type = 'comic',
    this.source,
  });

  final String id;
  final String title;
  final String? cover;
  final String type;
  final String? source;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'cover': cover,
      'type': type,
      'source': source,
    };
  }

  factory FavoriteItem.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return FavoriteItem(id: '', title: '');
    }
    return FavoriteItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      cover: json['cover'] as String?,
      type: json['type'] as String? ?? 'comic',
      source: json['source'] as String?,
    );
  }
}

class HistoryItem {
  HistoryItem({
    required this.id,
    required this.type,
    required this.timestamp,
    this.title,
    this.cover,
    this.source,
    this.lastChapterId,
    this.lastPage,
    this.lastEpisodeId,
    this.lastPositionSeconds,
    this.lastDurationSeconds,
    this.scrollOffset,
  });

  final String id;
  final String type; // comic video ebook novel
  final int timestamp;
  final String? title;
  final String? cover;
  final String? source;
  final String? lastChapterId;
  final int? lastPage;
  final String? lastEpisodeId;
  final int? lastPositionSeconds;
  final int? lastDurationSeconds;
  final double? scrollOffset;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'timestamp': timestamp,
      'title': title,
      'cover': cover,
      'source': source,
      'lastChapterId': lastChapterId,
      'lastPage': lastPage,
      'lastEpisodeId': lastEpisodeId,
      'lastPositionSeconds': lastPositionSeconds,
      'lastDurationSeconds': lastDurationSeconds,
      'scrollOffset': scrollOffset,
    };
  }

  factory HistoryItem.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return HistoryItem(id: '', type: 'comic', timestamp: 0);
    }
    return HistoryItem(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? 'comic',
      timestamp: json['timestamp'] as int? ?? 0,
      title: json['title'] as String?,
      cover: json['cover'] as String?,
      source: json['source'] as String?,
      lastChapterId: json['lastChapterId'] as String?,
      lastPage: json['lastPage'] as int?,
      lastEpisodeId: json['lastEpisodeId'] as String?,
      lastPositionSeconds: json['lastPositionSeconds'] as int?,
      lastDurationSeconds: json['lastDurationSeconds'] as int?,
      scrollOffset: (json['scrollOffset'] as num?)?.toDouble(),
    );
  }
}

class AppStorage {
  AppStorage(this._prefs);

  final SharedPreferences _prefs;

  static Future<AppStorage> load() async {
    final prefs = await SharedPreferences.getInstance();
    return AppStorage(prefs);
  }

  SettingsModel getSettings() {
    final raw = _prefs.getString(_kSettings);
    if (raw == null || raw.isEmpty) {
      return SettingsModel();
    }
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return SettingsModel.fromJson(map);
    } catch (_) {
      return SettingsModel();
    }
  }

  Future<bool> saveSettings(SettingsModel settings) async {
    final data = jsonEncode(settings.toJson());
    return _prefs.setString(_kSettings, data);
  }

  List<FavoriteItem> getFavorites() {
    final raw = _prefs.getString(_kFavorites);
    if (raw == null || raw.isEmpty) {
      return <FavoriteItem>[];
    }
    try {
      final list = (jsonDecode(raw) as List?)?.whereType<Map<String, dynamic>>().toList() ?? <Map<String, dynamic>>[];
      return list.map(FavoriteItem.fromJson).where((e) => e.id.isNotEmpty).toList();
    } catch (_) {
      return <FavoriteItem>[];
    }
  }

  Future<bool> saveFavorites(List<FavoriteItem> items) async {
    final safe = items.map((e) => e.toJson()).toList();
    return _prefs.setString(_kFavorites, jsonEncode(safe));
  }

  List<HistoryItem> getHistory() {
    final raw = _prefs.getString(_kHistory);
    if (raw == null || raw.isEmpty) {
      return <HistoryItem>[];
    }
    try {
      final list = (jsonDecode(raw) as List?)?.whereType<Map<String, dynamic>>().toList() ?? <Map<String, dynamic>>[];
      return list.map(HistoryItem.fromJson).where((e) => e.id.isNotEmpty).toList();
    } catch (_) {
      return <HistoryItem>[];
    }
  }

  Future<bool> saveHistory(List<HistoryItem> items) async {
    final safe = items.map((e) => e.toJson()).toList();
    return _prefs.setString(_kHistory, jsonEncode(safe));
  }

  List<String> getSearchHistory() {
    final raw = _prefs.getString(_kSearchHistory);
    if (raw == null || raw.isEmpty) {
      return <String>[];
    }
    try {
      final list = (jsonDecode(raw) as List?)?.whereType<String>().toList() ?? <String>[];
      return list;
    } catch (_) {
      return <String>[];
    }
  }

  Future<bool> saveSearchHistory(List<String> items) async {
    return _prefs.setString(_kSearchHistory, jsonEncode(items));
  }

  String? getCurrentSource() {
    final value = _prefs.getString(_kCurrentSource);
    if (value == null || value.isEmpty) {
      return null;
    }
    return value;
  }

  Future<bool> setCurrentSource(String? source) async {
    if (source == null || source.isEmpty) {
      return _prefs.remove(_kCurrentSource);
    }
    return _prefs.setString(_kCurrentSource, source);
  }

  String? getCurrentVideoSource() {
    final value = _prefs.getString(_kVideoSource);
    if (value == null || value.isEmpty) {
      return null;
    }
    return value;
  }

  Future<bool> setCurrentVideoSource(String? source) async {
    if (source == null || source.isEmpty) {
      return _prefs.remove(_kVideoSource);
    }
    return _prefs.setString(_kVideoSource, source);
  }

  Map<String, List<String>> getInstalledSources() {
    final raw = _prefs.getString(_kInstalledSources);
    if (raw == null || raw.isEmpty) {
      return {
        'video': <String>[],
        'comic': <String>[],
        'ebook': <String>[],
        'novel': <String>[],
        'news': <String>[],
      };
    }
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>? ?? <String, dynamic>{};
      final result = <String, List<String>>{};
      for (final entry in map.entries) {
        final value = (entry.value as List?)?.whereType<String>().toList() ?? <String>[];
        result[entry.key] = value;
      }
      return result;
    } catch (_) {
      return {
        'video': <String>[],
        'comic': <String>[],
        'ebook': <String>[],
        'novel': <String>[],
        'news': <String>[],
      };
    }
  }

  Future<bool> saveInstalledSources(Map<String, List<String>> map) async {
    return _prefs.setString(_kInstalledSources, jsonEncode(map));
  }

  Future<bool> installSource(String sourceId, String category) async {
    if (sourceId.isEmpty || category.isEmpty) {
      return false;
    }
    final installed = getInstalledSources();
    final list = installed[category] ?? <String>[];
    if (!list.contains(sourceId)) {
      list.add(sourceId);
      installed[category] = list;
      return saveInstalledSources(installed);
    }
    return true;
  }

  Future<bool> uninstallSource(String sourceId) async {
    if (sourceId.isEmpty) {
      return false;
    }
    final installed = getInstalledSources();
    var changed = false;
    for (final key in installed.keys) {
      final list = installed[key] ?? <String>[];
      if (list.remove(sourceId)) {
        installed[key] = list;
        changed = true;
      }
    }
    if (!changed) {
      return true;
    }
    return saveInstalledSources(installed);
  }

  Future<bool> clearHistory() async {
    return _prefs.remove(_kHistory);
  }

  Future<bool> clearFavorites() async {
    return _prefs.setString(_kFavorites, jsonEncode(<FavoriteItem>[]));
  }

  List<Map<String, dynamic>> getDownloadQueueRaw() {
    final raw = _prefs.getString(_kDownloadQueue);
    if (raw == null || raw.isEmpty) {
      return <Map<String, dynamic>>[];
    }
    try {
      final list = (jsonDecode(raw) as List?)?.whereType<Map<String, dynamic>>().toList() ?? <Map<String, dynamic>>[];
      return list;
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  Future<bool> saveDownloadQueueRaw(List<Map<String, dynamic>> items) async {
    return _prefs.setString(_kDownloadQueue, jsonEncode(items));
  }

  List<Map<String, dynamic>> getDownloadCompletedRaw() {
    final raw = _prefs.getString(_kDownloadCompleted);
    if (raw == null || raw.isEmpty) {
      return <Map<String, dynamic>>[];
    }
    try {
      final list = (jsonDecode(raw) as List?)?.whereType<Map<String, dynamic>>().toList() ?? <Map<String, dynamic>>[];
      return list;
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  Future<bool> saveDownloadCompletedRaw(List<Map<String, dynamic>> items) async {
    return _prefs.setString(_kDownloadCompleted, jsonEncode(items));
  }

  Future<bool> clearAllCache() async {
    await _prefs.setString(_kInstalledSources, jsonEncode({
      'video': <String>[],
      'comic': <String>[],
      'ebook': <String>[],
      'novel': <String>[],
      'news': <String>[],
    }));
    await _prefs.remove(_kCurrentSource);
    await _prefs.remove(_kActivationToken);
    await clearHistory();
    await clearFavorites();
    await _prefs.setString(_kSearchHistory, jsonEncode(<String>[]));
    return true;
  }

  String getActivationToken() {
    return _prefs.getString(_kActivationToken) ?? '';
  }

  Future<bool> saveActivationToken(String? token) async {
    if (token == null || token.isEmpty) {
      return _prefs.remove(_kActivationToken);
    }
    return _prefs.setString(_kActivationToken, token);
  }
}
