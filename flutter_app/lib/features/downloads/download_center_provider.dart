import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../comics/comics_models.dart';
import '../comics/comics_provider.dart';
import '../comics/data/comics_remote_service.dart';
import 'comic_downloader.dart';
import 'download_models.dart';
import 'download_remote_service.dart';

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
  final remote = ref.watch(downloadRemoteServiceProvider);
  final comicsRemote = ref.watch(comicsRemoteServiceProvider);
  final downloader = ref.watch(comicDownloaderProvider);
  return DownloadCenterNotifier(remote, comicsRemote, downloader);
});

class DownloadCenterNotifier extends StateNotifier<DownloadCenterState> {
  DownloadCenterNotifier(this._remote, this._comicsRemote, this._downloader)
      : super(
          DownloadCenterState(
            queue: const <DownloadItem>[],
            completed: const <DownloadItem>[],
            selectedQueue: <String>{},
            selectedCompleted: <String>{},
          ),
        );

  final DownloadRemoteService _remote;
  final ComicsRemoteService _comicsRemote;
  final ComicDownloader _downloader;

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
    for (var i = 0; i < newItems.length; i++) {
      final item = newItems[i];
      final chapter = chapters.firstWhere((c) => c.id == item.resourceId, orElse: () => const ComicChapter(id: '', title: '', index: 0));
      if (chapter.id.isEmpty) {
        continue;
      }
      _runComicDownload(item, detail, chapter);
    }
  }

  Future<void> refreshFromRemote() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final result = await _remote.fetchAll();
      state = state.copyWith(
        queue: result.queue,
        completed: result.completed,
        selectedQueue: <String>{},
        selectedCompleted: <String>{},
        loading: false,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: '拉取失败 ${e.toString()}');
    }
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
    final updated = state.queue.map((item) {
      if (!state.selectedQueue.contains(item.id)) {
        return item;
      }
      if (item.status == DownloadStatus.completed || item.status == DownloadStatus.paused) {
        return item;
      }
      return item.copyWith(status: DownloadStatus.paused);
    }).toList();
    state = state.copyWith(queue: updated);
  }

  void resumeSelected() {
    if (state.selectedQueue.isEmpty) {
      return;
    }
    final updated = state.queue.map((item) {
      if (!state.selectedQueue.contains(item.id)) {
        return item;
      }
      if (item.status == DownloadStatus.completed) {
        return item;
      }
      return item.copyWith(status: DownloadStatus.downloading, error: null);
    }).toList();
    state = state.copyWith(queue: updated);
  }

  void cancelSelected() {
    if (state.selectedQueue.isEmpty) {
      return;
    }
    final remaining = state.queue.where((item) => !state.selectedQueue.contains(item.id)).toList();
    state = state.copyWith(queue: remaining, selectedQueue: <String>{});
  }

  void retrySelected() {
    if (state.selectedQueue.isEmpty) {
      return;
    }
    final updated = state.queue.map((item) {
      if (!state.selectedQueue.contains(item.id)) {
        return item;
      }
      if (item.status != DownloadStatus.failed) {
        return item;
      }
      return item.copyWith(status: DownloadStatus.pending, progress: 0, error: null);
    }).toList();
    state = state.copyWith(queue: updated);
  }

  void deleteCompletedSelected() {
    if (state.selectedCompleted.isEmpty) {
      return;
    }
    final remaining = state.completed.where((item) => !state.selectedCompleted.contains(item.id)).toList();
    state = state.copyWith(completed: remaining, selectedCompleted: <String>{});
  }

  Future<void> _runComicDownload(DownloadItem item, ComicDetail detail, ComicChapter chapter) async {
    try {
      _updateQueueItem(item.id, status: DownloadStatus.downloading, progress: 0);
      
      final info = await _comicsRemote.fetchChapterDownloadInfo(
        chapterId: chapter.id,
        sourceId: detail.source,
      );
      
      if (info.images.isEmpty) {
        _updateQueueItem(item.id, status: DownloadStatus.failed, error: '无可下载图片');
        return;
      }
      
      await _downloader.downloadChapter(
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
      );
      
      _markAsCompleted(item.id);
    } catch (e, stack) {
      _updateQueueItem(item.id, status: DownloadStatus.failed, error: e.toString());
    }
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

  void _markAsCompleted(String id) {
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
    );
    state = state.copyWith(
      queue: remaining,
      completed: [...state.completed, completedItem],
    );
  }
}
