import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../comics/comics_models.dart';
import '../comics/comics_provider.dart';
import '../comics/data/comics_remote_service.dart';
import '../videos/video_models.dart';
import '../videos/data/video_remote_service.dart';
import '../videos/video_detail_provider.dart';
import '../videos/videos_provider.dart' show videosRemoteServiceProvider;
import 'video_downloader.dart';
import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';
import 'comic_downloader.dart';
import 'download_models.dart';

class DownloadCenterState {
  DownloadCenterState({
    required this.queue,
    required this.completed,
    required this.selectedQueue,
    required this.selectedCompleted,
    this.loading = false,
    this.error,
  });

  final List<DownloadItem> queue;
  final List<DownloadItem> completed;
  final Set<String> selectedQueue;
  final Set<String> selectedCompleted;
  final bool loading;
  final String? error;

  DownloadCenterState copyWith({
    List<DownloadItem>? queue,
    List<DownloadItem>? completed,
    Set<String>? selectedQueue,
    Set<String>? selectedCompleted,
    bool? loading,
    String? error,
  }) {
    return DownloadCenterState(
      queue: queue ?? this.queue,
      completed: completed ?? this.completed,
      selectedQueue: selectedQueue ?? this.selectedQueue,
      selectedCompleted: selectedCompleted ?? this.selectedCompleted,
      loading: loading ?? this.loading,
      error: error,
    );
  }
}

final downloadCenterProvider = StateNotifierProvider<DownloadCenterNotifier, DownloadCenterState>((ref) {
  final comicsRemote = ref.watch(comicsRemoteServiceProvider);
  final videosRemote = ref.watch(videosRemoteServiceProvider);
  final comicDownloader = ref.watch(comicDownloaderProvider);
  final videoDownloader = ref.watch(videoDownloaderProvider);
  final storage = ref.watch(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
  final settingsRepo = ref.watch(settingsRepositoryProvider);
  return DownloadCenterNotifier(
    comicsRemote,
    videosRemote,
    comicDownloader,
    videoDownloader,
    storage,
    settingsRepo,
  );
});

class DownloadCenterNotifier extends StateNotifier<DownloadCenterState> {
  DownloadCenterNotifier(
    this._comicsRemote,
    this._videosRemote,
    this._comicDownloader,
    this._videoDownloader,
    this._storage,
    this._settingsRepo,
  )
      : super(
          DownloadCenterState(
            queue: const <DownloadItem>[],
            completed: const <DownloadItem>[],
            selectedQueue: <String>{},
            selectedCompleted: <String>{},
          ),
        ) {
    _restoreFromStorage();
  }

  void clearQueue() {
    if (state.queue.isEmpty) {
      return;
    }
    for (final item in state.queue) {
      _cancelTask(item.id, reason: 'clear_all_queue');
    }
    state = state.copyWith(queue: <DownloadItem>[], selectedQueue: <String>{});
    _persistQueues();
  }

  void clearCompleted() {
    if (state.completed.isEmpty) {
      return;
    }
    state = state.copyWith(completed: <DownloadItem>[], selectedCompleted: <String>{});
    _persistQueues();
  }

  final ComicsRemoteService _comicsRemote;
  final VideoRemoteService _videosRemote;
  final ComicDownloader _comicDownloader;
  final VideoDownloader _videoDownloader;
  final AppStorage? _storage;
  final SettingsRepository? _settingsRepo;
  final Map<String, CancelToken> _taskTokens = <String, CancelToken>{};
  late int _maxConcurrent = _resolveInitialConcurrent();

  int _resolveInitialConcurrent() {
    final repo = _settingsRepo;
    if (repo == null) {
      return 5;
    }
    final value = repo.load().maxConcurrentDownloads;
    return value < 1 ? 1 : value;
  }

  void updateMaxConcurrent(int value) {
    final safeValue = value < 1 ? 1 : value;
    _maxConcurrent = safeValue;
    _processQueue();
  }

  void enqueueComicChapters({
    required ComicDetail detail,
    required List<ComicChapter> chapters,
  }) {
    if (chapters.isEmpty || detail.id.isEmpty) {
      return;
    }
    final exists = <String>{
      ...state.queue.map((e) => e.resourceId).whereType<String>(),
      ...state.completed.map((e) => e.resourceId).whereType<String>(),
    };
    final now = DateTime.now().microsecondsSinceEpoch;
    final newItems = <DownloadItem>[];
    var offset = 0;
    for (final chapter in chapters) {
      if (chapter.id.isEmpty || exists.contains(chapter.id)) {
        continue;
      }
      newItems.add(
        DownloadItem(
          id: 'dl-${detail.id}-${chapter.id}-${now + offset}',
          type: DownloadType.comic,
          kind: 'task',
          title: chapter.title,
          parentTitle: detail.title,
          status: DownloadStatus.pending,
          progress: 0,
          source: detail.source,
          parentId: detail.id,
          resourceId: chapter.id,
          metadata: <String, dynamic>{
            'chapterIndex': chapter.index,
            'chapterTitle': chapter.title,
          },
        ),
      );
      offset += 1;
    }
    if (newItems.isEmpty) {
      return;
    }
    state = state.copyWith(queue: [...state.queue, ...newItems]);
    _processQueue(detail: detail, chapters: chapters);
    _persistQueues();
  }

  void enqueueVideoEpisodes({
    required VideoDetail detail,
    required List<VideoEpisode> episodes,
  }) {
    if (episodes.isEmpty || detail.id.isEmpty) {
      return;
    }
    final exists = <String>{
      ...state.queue.map((e) => e.resourceId).whereType<String>(),
      ...state.completed.map((e) => e.resourceId).whereType<String>(),
    };
    final now = DateTime.now().microsecondsSinceEpoch;
    final newItems = <DownloadItem>[];
    var offset = 0;
    for (final episode in episodes) {
      if (episode.id.isEmpty || exists.contains(episode.id)) {
        continue;
      }
      newItems.add(
        DownloadItem(
          id: 'dl-${detail.id}-${episode.id}-${now + offset}',
          type: DownloadType.video,
          kind: 'task',
          title: episode.title,
          parentTitle: detail.title,
          status: DownloadStatus.pending,
          progress: 0,
          source: detail.source,
          parentId: detail.id,
          resourceId: episode.id,
          metadata: <String, dynamic>{
            'episodeIndex': episode.index,
            'episodeTitle': episode.title,
          },
        ),
      );
      offset += 1;
    }
    if (newItems.isEmpty) {
      return;
    }
    state = state.copyWith(queue: [...state.queue, ...newItems]);
    _processQueue(detail: null, chapters: const <ComicChapter>[], videoDetail: detail, videoEpisodes: episodes);
    _persistQueues();
  }

  Future<void> refreshFromRemote() async {
    state = state.copyWith(loading: true, error: null);
    _restoreFromStorage(resetSelection: true);
    state = state.copyWith(loading: false, error: null);
  }

  void toggleSelection(String id, {required bool inQueue}) {
    if (id.isEmpty) {
      return;
    }
    if (inQueue) {
      final next = Set<String>.from(state.selectedQueue);
      if (next.contains(id)) {
        next.remove(id);
      } else {
        next.add(id);
      }
      state = state.copyWith(selectedQueue: next);
      return;
    }
    final next = Set<String>.from(state.selectedCompleted);
    if (next.contains(id)) {
      next.remove(id);
    } else {
      next.add(id);
    }
    state = state.copyWith(selectedCompleted: next);
  }

  void selectAllQueue() {
    final ids = state.queue.map((e) => e.id).where((e) => e.isNotEmpty).toSet();
    state = state.copyWith(selectedQueue: ids);
  }

  void selectAllCompleted() {
    final ids = state.completed.map((e) => e.id).where((e) => e.isNotEmpty).toSet();
    state = state.copyWith(selectedCompleted: ids);
  }

  void clearSelection({required bool inQueue}) {
    if (inQueue) {
      state = state.copyWith(selectedQueue: <String>{});
      return;
    }
    state = state.copyWith(selectedCompleted: <String>{});
  }

  void pauseSelected() {
    if (state.selectedQueue.isEmpty) {
      return;
    }
    final updated = <DownloadItem>[];
    for (final item in state.queue) {
      if (!state.selectedQueue.contains(item.id)) {
        updated.add(item);
        continue;
      }
      if (item.status == DownloadStatus.completed || item.status == DownloadStatus.paused) {
        updated.add(item);
        continue;
      }
      _cancelTask(item.id, reason: 'paused');
      updated.add(item.copyWith(status: DownloadStatus.paused));
    }
    state = state.copyWith(queue: updated);
    _processQueue();
    _persistQueues();
  }

  void resumeSelected() {
    if (state.selectedQueue.isEmpty) {
      return;
    }
    final updated = <DownloadItem>[];
    for (final item in state.queue) {
      if (!state.selectedQueue.contains(item.id)) {
        updated.add(item);
        continue;
      }
      if (item.status == DownloadStatus.completed) {
        updated.add(item);
        continue;
      }
      updated.add(item.copyWith(status: DownloadStatus.pending, error: null));
    }
    state = state.copyWith(queue: updated);
    _processQueue();
    _persistQueues();
  }

  void cancelSelected() {
    if (state.selectedQueue.isEmpty) {
      return;
    }
    final remaining = <DownloadItem>[];
    for (final item in state.queue) {
      if (!state.selectedQueue.contains(item.id)) {
        remaining.add(item);
        continue;
      }
      _cancelTask(item.id, reason: 'cancelled');
    }
    state = state.copyWith(queue: remaining, selectedQueue: <String>{});
    _processQueue();
    _persistQueues();
  }

  void retrySelected() {
    if (state.selectedQueue.isEmpty) {
      return;
    }
    final updated = <DownloadItem>[];
    for (final item in state.queue) {
      if (!state.selectedQueue.contains(item.id)) {
        updated.add(item);
        continue;
      }
      if (item.status != DownloadStatus.failed) {
        updated.add(item);
        continue;
      }
      updated.add(item.copyWith(status: DownloadStatus.pending, progress: 0, error: null));
    }
    state = state.copyWith(queue: updated);
    _processQueue();
    _persistQueues();
  }

  void deleteCompletedSelected() {
    if (state.selectedCompleted.isEmpty) {
      return;
    }
    final remaining = state.completed.where((item) => !state.selectedCompleted.contains(item.id)).toList();
    state = state.copyWith(completed: remaining, selectedCompleted: <String>{});
    _persistQueues();
  }

  Future<void> _runComicDownload(DownloadItem item, ComicDetail detail, ComicChapter chapter) async {
    try {
      final token = CancelToken();
      _taskTokens[item.id] = token;
      _updateQueueItem(item.id, status: DownloadStatus.downloading, progress: 0, error: null);
      
      final info = await _comicsRemote.fetchChapterDownloadInfo(
        chapterId: chapter.id,
        sourceId: detail.source,
        cancelToken: token,
      );
      
      if (info.images.isEmpty) {
        _updateQueueItem(item.id, status: DownloadStatus.failed, error: '无可下载图片');
        _taskTokens.remove(item.id);
        _processQueue();
        return;
      }
      
      await _comicDownloader.downloadChapter(
        detail: detail,
        chapter: chapter,
        downloadInfo: info,
        onProgress: (completed, total) {
          if (total <= 0) {
            return;
          }
          final progress = (completed / total).clamp(0.0, 1.0);
          _updateQueueItem(
            item.id,
            status: DownloadStatus.downloading,
            progress: progress,
          );
        },
        cancelToken: token,
      );
      
      _markAsCompleted(item.id);
      _taskTokens.remove(item.id);
    } catch (e, stack) {
      _taskTokens.remove(item.id);
      _updateQueueItem(item.id, status: DownloadStatus.failed, error: e.toString());
    }
    _processQueue();
  }

  Future<void> _runVideoDownload(DownloadItem item, VideoDetail detail, VideoEpisode episode) async {
    try {
      final token = CancelToken();
      _taskTokens[item.id] = token;
      _updateQueueItem(item.id, status: DownloadStatus.downloading, progress: 0, error: null);

      final playSource = await _videosRemote.fetchEpisodePlaySource(
        episode.id,
        detail.source.isNotEmpty ? detail.source : item.source,
      );
      if (playSource == null || playSource.url.isEmpty) {
        _updateQueueItem(item.id, status: DownloadStatus.failed, error: '无法获取播放地址');
        _taskTokens.remove(item.id);
        _processQueue();
        return;
      }

      var lastProgress = 0.0;
      final path = await _videoDownloader.downloadEpisode(
        detail: detail,
        episode: episode,
        source: playSource,
        cancelToken: token,
        onProgress: (received, total) {
          if (total <= 0) {
            return;
          }
          final progress = (received / total).clamp(0.0, 1.0);
          if ((progress - lastProgress).abs() < 0.01) {
            return;
          }
          lastProgress = progress;
          _updateQueueItem(
            item.id,
            status: DownloadStatus.downloading,
            progress: progress,
          );
        },
      );

      _markAsCompleted(
        item.id,
        extraMetadata: {
          ...(item.metadata ?? <String, dynamic>{}),
          'localPath': path,
          'episodeIndex': episode.index,
          'episodeTitle': episode.title,
        },
      );
      _taskTokens.remove(item.id);
    } catch (e) {
      _taskTokens.remove(item.id);
      _updateQueueItem(item.id, status: DownloadStatus.failed, error: e.toString());
    }
    _processQueue();
  }

  void _updateQueueItem(
    String id, {
    DownloadStatus? status,
    double? progress,
    String? error,
  }) {
    final updated = state.queue.map((item) {
      if (item.id != id) {
        return item;
      }
      return item.copyWith(
        status: status,
        progress: progress,
        error: error,
      );
    }).toList();
    state = state.copyWith(queue: updated);
  }

  void _markAsCompleted(String id, {Map<String, dynamic>? extraMetadata}) {
    DownloadItem? target;
    final remaining = <DownloadItem>[];
    for (final item in state.queue) {
      if (item.id == id) {
        target = item;
      } else {
        remaining.add(item);
      }
    }
    if (target == null) {
      return;
    }
    final completedItem = target.copyWith(
      status: DownloadStatus.completed,
      progress: 1,
      downloadedAt: DateTime.now(),
      error: null,
      metadata: extraMetadata ?? target.metadata,
    );
    state = state.copyWith(
      queue: remaining,
      completed: [...state.completed, completedItem],
    );
    _persistQueues();
  }

  void _processQueue({
    ComicDetail? detail,
    List<ComicChapter> chapters = const <ComicChapter>[],
    VideoDetail? videoDetail,
    List<VideoEpisode> videoEpisodes = const <VideoEpisode>[],
  }) {
    final runningCount = state.queue.where((item) => item.status == DownloadStatus.downloading).length;
    if (runningCount >= _maxConcurrent) {
      return;
    }
    final pending = state.queue.where((item) => item.status == DownloadStatus.pending).toList();
    if (pending.isEmpty) {
      return;
    }
    var available = _maxConcurrent - runningCount;
    for (final item in pending) {
      if (available <= 0) {
        return;
      }
      if (item.type == DownloadType.comic) {
        final resolvedDetail = _resolveDetail(item, detail);
        final resolvedChapter = _resolveChapter(item, chapters);
        if (resolvedDetail == null || resolvedChapter == null) {
          _updateQueueItem(item.id, status: DownloadStatus.failed, error: '缺少下载参数');
          continue;
        }
        available -= 1;
        _runComicDownload(item, resolvedDetail, resolvedChapter);
        continue;
      }
      if (item.type == DownloadType.video) {
        final resolvedDetail = _resolveVideoDetail(item, videoDetail);
        final resolvedEpisode = _resolveVideoEpisode(item, videoEpisodes);
        if (resolvedDetail == null || resolvedEpisode == null) {
          _updateQueueItem(item.id, status: DownloadStatus.failed, error: '缺少下载参数');
          continue;
        }
        available -= 1;
        _runVideoDownload(item, resolvedDetail, resolvedEpisode);
        continue;
      }
    }
  }

  VideoDetail? _resolveVideoDetail(DownloadItem item, VideoDetail? prefer) {
    if (prefer != null && prefer.id.isNotEmpty && prefer.title.isNotEmpty) {
      return prefer;
    }
    if (item.parentId == null || item.parentId!.isEmpty || item.parentTitle.isEmpty || (item.source ?? '').isEmpty) {
      return null;
    }
    return VideoDetail(
      id: item.parentId!,
      title: item.parentTitle,
      cover: '',
      source: item.source ?? '',
    );
  }

  VideoEpisode? _resolveVideoEpisode(DownloadItem item, List<VideoEpisode> episodes) {
    if (item.resourceId == null || item.resourceId!.isEmpty) {
      return null;
    }
    final matched = episodes.firstWhere(
      (e) => e.id == item.resourceId,
      orElse: () => const VideoEpisode(id: '', title: '', index: 0),
    );
    if (matched.id.isNotEmpty) {
      return matched;
    }
    final meta = item.metadata ?? <String, dynamic>{};
    final index = (meta['episodeIndex'] as num?)?.toInt() ?? 0;
    final title = (meta['episodeTitle'] as String?) ?? item.title;
    return VideoEpisode(
      id: item.resourceId ?? '',
      title: title,
      index: index,
    );
  }

  void _cancelTask(String id, {required String reason}) {
    final token = _taskTokens[id];
    if (token == null) {
      return;
    }
    if (!token.isCancelled) {
      token.cancel(reason);
    }
    _taskTokens.remove(id);
  }

  void pauseAll() {
    final updated = <DownloadItem>[];
    for (final item in state.queue) {
      if (item.status == DownloadStatus.completed || item.status == DownloadStatus.paused) {
        updated.add(item);
        continue;
      }
      _cancelTask(item.id, reason: 'paused_all');
      updated.add(item.copyWith(status: DownloadStatus.paused));
    }
    state = state.copyWith(queue: updated, selectedQueue: <String>{});
    _persistQueues();
  }

  void resumeAll() {
    final updated = <DownloadItem>[];
    for (final item in state.queue) {
      if (item.status == DownloadStatus.completed) {
        updated.add(item);
        continue;
      }
      if (item.status == DownloadStatus.paused || item.status == DownloadStatus.pending || item.status == DownloadStatus.failed) {
        updated.add(item.copyWith(status: DownloadStatus.pending, error: null));
        continue;
      }
      updated.add(item);
    }
    state = state.copyWith(queue: updated, selectedQueue: <String>{});
    _processQueue();
    _persistQueues();
  }

  /// 按资源ID暂停视频下载
  void pauseVideosByResourceIds(Set<String> resourceIds) {
    if (resourceIds.isEmpty) {
      return;
    }
    final updated = <DownloadItem>[];
    for (final item in state.queue) {
      final shouldHandle = resourceIds.contains(item.resourceId) && item.type == DownloadType.video;
      if (!shouldHandle) {
        updated.add(item);
        continue;
      }
      if (item.status == DownloadStatus.completed || item.status == DownloadStatus.paused) {
        updated.add(item);
        continue;
      }
      _cancelTask(item.id, reason: 'paused_by_resource');
      updated.add(item.copyWith(status: DownloadStatus.paused));
    }
    state = state.copyWith(queue: updated);
    _persistQueues();
  }

  /// 按资源ID取消视频下载
  void cancelVideosByResourceIds(Set<String> resourceIds) {
    if (resourceIds.isEmpty) {
      return;
    }
    final remaining = <DownloadItem>[];
    for (final item in state.queue) {
      final shouldHandle = resourceIds.contains(item.resourceId) && item.type == DownloadType.video;
      if (!shouldHandle) {
        remaining.add(item);
        continue;
      }
      _cancelTask(item.id, reason: 'cancelled_by_resource');
    }
    state = state.copyWith(queue: remaining);
    _persistQueues();
  }

  void retryAllFailed() {
    final updated = <DownloadItem>[];
    for (final item in state.queue) {
      if (item.status != DownloadStatus.failed) {
        updated.add(item);
        continue;
      }
      updated.add(item.copyWith(status: DownloadStatus.pending, progress: 0, error: null));
    }
    state = state.copyWith(queue: updated, selectedQueue: <String>{});
    _processQueue();
    _persistQueues();
  }

  ComicDetail? _resolveDetail(DownloadItem item, ComicDetail? prefer) {
    if (prefer != null && prefer.id.isNotEmpty && prefer.title.isNotEmpty && (prefer.source.isNotEmpty)) {
      return prefer;
    }
    if (item.parentId == null || item.parentId!.isEmpty || item.parentTitle.isEmpty || item.source == null || item.source!.isEmpty) {
      return null;
    }
    return ComicDetail(
      id: item.parentId!,
      title: item.parentTitle,
      cover: '',
      author: '',
      description: '',
      status: '',
      source: item.source ?? '',
    );
  }

  ComicChapter? _resolveChapter(DownloadItem item, List<ComicChapter> chapters) {
    if (item.resourceId == null || item.resourceId!.isEmpty) {
      return null;
    }
    final matched = chapters.firstWhere(
      (c) => c.id == item.resourceId,
      orElse: () => const ComicChapter(id: '', title: '', index: 0),
    );
    if (matched.id.isNotEmpty) {
      return matched;
    }
    final meta = item.metadata ?? <String, dynamic>{};
    final index = (meta['chapterIndex'] as num?)?.toInt() ?? 0;
    return ComicChapter(
      id: item.resourceId ?? '',
      title: item.title,
      index: index,
    );
  }

  void _restoreFromStorage({bool resetSelection = false}) {
    if (_storage == null) {
      return;
    }
    final cachedQueue = _storage!.getDownloadQueueRaw().map(DownloadItem.fromJson).where((e) => e.id.isNotEmpty).toList();
    final cachedCompleted = _storage!.getDownloadCompletedRaw().map(DownloadItem.fromJson).where((e) => e.id.isNotEmpty).toList();
    if (cachedQueue.isEmpty && cachedCompleted.isEmpty) {
      return;
    }
    state = state.copyWith(
      queue: cachedQueue,
      completed: cachedCompleted,
      selectedQueue: resetSelection ? <String>{} : state.selectedQueue,
      selectedCompleted: resetSelection ? <String>{} : state.selectedCompleted,
    );
  }

  Future<void> _persistQueues() async {
    if (_storage == null) {
      return;
    }
    final queueData = state.queue.map((e) => e.toJson()).toList();
    final completedData = state.completed.map((e) => e.toJson()).toList();
    await _storage!.saveDownloadQueueRaw(queueData);
    await _storage!.saveDownloadCompletedRaw(completedData);
  }
}
