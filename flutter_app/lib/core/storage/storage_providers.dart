import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/ebook_file_cache_service.dart';
import 'app_storage.dart';
import 'storage_repository.dart';

final appStorageProvider = FutureProvider<AppStorage>((ref) async {
  return AppStorage.load();
});

final settingsRepositoryProvider = Provider<SettingsRepository?>((ref) {
  final storage = ref.watch(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
  if (storage == null) {
    return null;
  }
  return SettingsRepository(storage);
});

final favoritesRepositoryProvider = Provider<FavoritesRepository?>((ref) {
  final storage = ref.watch(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
  if (storage == null) {
    return null;
  }
  return FavoritesRepository(storage);
});

final videoSourceRepositoryProvider = Provider<VideoSourceRepository?>((ref) {
  final storage = ref.watch(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
  if (storage == null) {
    return null;
  }
  return VideoSourceRepository(storage);
});

final historyRepositoryProvider = Provider<HistoryRepository?>((ref) {
  final storage = ref.watch(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
  if (storage == null) {
    return null;
  }
  return HistoryRepository(storage);
});

final sourceRepositoryProvider = Provider<SourceRepository?>((ref) {
  final storage = ref.watch(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
  if (storage == null) {
    return null;
  }
  return SourceRepository(storage);
});

final activationRepositoryProvider = Provider<ActivationRepository?>((ref) {
  final storage = ref.watch(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
  if (storage == null) {
    return null;
  }
  return ActivationRepository(storage);
});
final searchHistoryRepositoryProvider = Provider<SearchHistoryRepository?>((ref) {
  final storage = ref.watch(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
  if (storage == null) {
    return null;
  }
  return SearchHistoryRepository(storage);
});

final ebookFileCacheServiceProvider = Provider<EbookFileCacheService>((ref) {
  return EbookFileCacheService();
});
