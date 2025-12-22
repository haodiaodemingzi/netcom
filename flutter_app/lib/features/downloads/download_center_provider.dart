import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../comics/comics_models.dart';
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

final downloadCenterProvider = StateNotifierProvider<DownloadCenterNotifier, DownloadCenterState>(
  (ref) {
    final remote = ref.watch(downloadRemoteServiceProvider);
    return DownloadCenterNotifier(remote);
  },
);

class DownloadCenterNotifier extends StateNotifier<DownloadCenterState> {
  DownloadCenterNotifier(this._remote)
      : super(
          DownloadCenterState(
            queue: _mockQueue(),
            completed: _mockCompleted(),
            selectedQueue: <String>{},
            selectedCompleted: <String>{},
          ),
        );

  final DownloadRemoteService _remote;

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

  static List<DownloadItem> _mockQueue() {
    return <DownloadItem>[
      DownloadItem(
        id: 'q1',
        type: DownloadType.video,
        kind: 'task',
        title: 'S01E01 开场',
        parentTitle: '航海王',
        status: DownloadStatus.downloading,
        progress: 0.36,
        source: '默认源',
        parentId: 'anime-1',
        resourceId: 'anime-1-ep1',
      ),
      DownloadItem(
        id: 'q2',
        type: DownloadType.comic,
        kind: 'task',
        title: '第12话',
        parentTitle: '怪兽8号',
        status: DownloadStatus.paused,
        progress: 0.72,
        source: '源A',
        parentId: 'c1',
        resourceId: 'c1-ch-12',
      ),
      DownloadItem(
        id: 'q3',
        type: DownloadType.ebook,
        kind: 'task',
        title: '第3章 城市夜行',
        parentTitle: '赛博之心',
        status: DownloadStatus.failed,
        progress: 0.14,
        source: '源B',
        error: '网络中断',
        parentId: 'ebook-1',
        resourceId: 'ebook-1-ch3',
      ),
    ];
  }

  static List<DownloadItem> _mockCompleted() {
    return <DownloadItem>[
      DownloadItem(
        id: 'c1',
        type: DownloadType.video,
        kind: 'downloaded',
        title: 'S01E10 团聚',
        parentTitle: '航海王',
        status: DownloadStatus.completed,
        progress: 1,
        source: '默认源',
        downloadedAt: DateTime.now().subtract(const Duration(hours: 3)),
      ),
      DownloadItem(
        id: 'c2',
        type: DownloadType.comic,
        kind: 'downloaded',
        title: '第11话',
        parentTitle: '怪兽8号',
        status: DownloadStatus.completed,
        progress: 1,
        source: '源A',
        downloadedAt: DateTime.now().subtract(const Duration(days: 1, hours: 2)),
      ),
    ];
  }
}
