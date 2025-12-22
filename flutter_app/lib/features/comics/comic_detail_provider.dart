import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';
import '../../core/storage/app_storage.dart';
import 'comics_models.dart';
import 'comics_provider.dart';
import 'data/comics_remote_service.dart';

class ComicDetailRequest {
  const ComicDetailRequest({
    required this.id,
    this.sourceId,
  });

  final String id;
  final String? sourceId;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) {
      return true;
    }
    return other is ComicDetailRequest && other.id == id && other.sourceId == sourceId;
  }

  @override
  int get hashCode => Object.hash(id, sourceId);
}

class ComicDetailState {
  const ComicDetailState({
    this.detail,
    this.chapters = const <ComicChapter>[],
    this.loading = false,
    this.error,
    this.descending = true,
    this.selectedChapterIds = const <String>{},
    this.selectionMode = false,
    this.isFavorite = false,
    this.segments = const <ChapterSegment>[],
    this.currentSegmentIndex = 0,
    this.segmentSize = 50,
  });

  final ComicDetail? detail;
  final List<ComicChapter> chapters;
  final bool loading;
  final String? error;
  final bool descending;
  final Set<String> selectedChapterIds;
  final bool selectionMode;
  final bool isFavorite;
   final List<ChapterSegment> segments;
  final int currentSegmentIndex;
  final int segmentSize;

  ComicDetailState copyWith({
    ComicDetail? detail,
    List<ComicChapter>? chapters,
    bool? loading,
    String? error,
    bool? descending,
    Set<String>? selectedChapterIds,
    bool? selectionMode,
    bool? isFavorite,
    List<ChapterSegment>? segments,
    int? currentSegmentIndex,
    int? segmentSize,
  }) {
    return ComicDetailState(
      detail: detail ?? this.detail,
      chapters: chapters ?? this.chapters,
      loading: loading ?? this.loading,
      error: error,
      descending: descending ?? this.descending,
      selectedChapterIds: selectedChapterIds != null
          ? Set<String>.unmodifiable(selectedChapterIds)
          : this.selectedChapterIds,
      selectionMode: selectionMode ?? this.selectionMode,
      isFavorite: isFavorite ?? this.isFavorite,
      segments: segments ?? this.segments,
      currentSegmentIndex: currentSegmentIndex ?? this.currentSegmentIndex,
      segmentSize: segmentSize ?? this.segmentSize,
    );
  }
}

class ChapterSegment {
  const ChapterSegment({required this.start, required this.end});

  final int start;
  final int end;

  String label() => '$start-$end';

  bool contains(int value) {
    if (value < start) {
      return false;
    }
    if (value > end) {
      return false;
    }
    return true;
  }
}

final comicDetailProvider = AutoDisposeStateNotifierProviderFamily<ComicDetailNotifier, ComicDetailState, ComicDetailRequest>(
  (ref, request) {
    final remote = ref.watch(comicsRemoteServiceProvider);
    final sourceRepository = ref.watch(sourceRepositoryProvider);
    final favoritesRepository = ref.watch(favoritesRepositoryProvider);
    return ComicDetailNotifier(
      request: request,
      remoteService: remote,
      sourceRepository: sourceRepository,
      favoritesRepository: favoritesRepository,
    );
  },
);

class ComicDetailNotifier extends StateNotifier<ComicDetailState> {
  ComicDetailNotifier({
    required ComicDetailRequest request,
    required ComicsRemoteService remoteService,
    required SourceRepository? sourceRepository,
    required FavoritesRepository? favoritesRepository,
  })  : _request = request,
        _remoteService = remoteService,
        _sourceRepository = sourceRepository,
        _favoritesRepository = favoritesRepository,
        super(const ComicDetailState(loading: true)) {
    refresh();
  }

  final ComicDetailRequest _request;
  final ComicsRemoteService _remoteService;
  final SourceRepository? _sourceRepository;
  final FavoritesRepository? _favoritesRepository;

  Future<void> refresh() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final sourceId = _request.sourceId?.isNotEmpty == true ? _request.sourceId : _sourceRepository?.currentSource();
      final data = await _remoteService.fetchDetail(comicId: _request.id, sourceId: sourceId);
      final sorted = _sortChapters(data.chapters, descending: state.descending);
      final segments = _buildSegments(sorted, size: state.segmentSize);
      final defaultSegmentIndex = _pickDefaultSegmentIndex(segments, descending: state.descending);
      final isFavorite = _favoritesRepository?.isFavorite(_request.id) ?? false;
      state = state.copyWith(
        detail: data.detail,
        chapters: sorted,
        loading: false,
        error: null,
        isFavorite: isFavorite,
        selectedChapterIds: const <String>{},
        selectionMode: false,
        segments: segments,
        currentSegmentIndex: defaultSegmentIndex,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: '加载失败 ${e.toString()}');
    }
  }

  void toggleSortOrder() {
    final nextDescending = !state.descending;
    final sorted = _sortChapters(state.chapters, descending: nextDescending);
    state = state.copyWith(
      descending: nextDescending,
      chapters: sorted,
    );
  }

  void toggleSelectionMode() {
    final next = !state.selectionMode;
    state = state.copyWith(
      selectionMode: next,
      selectedChapterIds: next ? state.selectedChapterIds : const <String>{},
    );
  }

  void toggleChapterSelection(String chapterId) {
    if (chapterId.isEmpty) {
      return;
    }
    final next = Set<String>.from(state.selectedChapterIds);
    if (next.contains(chapterId)) {
      next.remove(chapterId);
    } else {
      next.add(chapterId);
    }
    final selectionMode = next.isNotEmpty ? true : state.selectionMode;
    state = state.copyWith(
      selectedChapterIds: next,
      selectionMode: selectionMode && next.isNotEmpty,
    );
  }

  void beginSelectionWith(String chapterId) {
    if (chapterId.isEmpty) {
      return;
    }
    final next = Set<String>.from(state.selectedChapterIds)..add(chapterId);
    state = state.copyWith(
      selectionMode: true,
      selectedChapterIds: next,
    );
  }

  void selectAllVisibleChapters() {
    final ids = visibleChapters().map((chapter) => chapter.id).where((id) => id.isNotEmpty).toSet();
    if (ids.isEmpty) {
      return;
    }
    state = state.copyWith(
      selectedChapterIds: ids,
      selectionMode: true,
    );
  }

  void clearSelection() {
    state = state.copyWith(
      selectedChapterIds: const <String>{},
      selectionMode: false,
    );
  }

  List<ComicChapter> selectedChapters() {
    if (state.selectedChapterIds.isEmpty) {
      return const <ComicChapter>[];
    }
    return state.chapters
        .where((chapter) => state.selectedChapterIds.contains(chapter.id))
        .toList(growable: false);
  }

  List<ComicChapter> visibleChapters() {
    if (state.segments.isEmpty) {
      return state.chapters;
    }
    if (state.currentSegmentIndex < 0 || state.currentSegmentIndex >= state.segments.length) {
      return state.chapters;
    }
    final segment = state.segments[state.currentSegmentIndex];
    return state.chapters.where((chapter) => segment.contains(chapter.index)).toList(growable: false);
  }

  void selectSegment(int index) {
    if (state.segments.isEmpty) {
      return;
    }
    if (index < 0 || index >= state.segments.length) {
      return;
    }
    state = state.copyWith(
      currentSegmentIndex: index,
      selectedChapterIds: const <String>{},
      selectionMode: false,
    );
  }

  Future<void> toggleFavorite() async {
    final repo = _favoritesRepository;
    final detail = state.detail;
    if (repo == null || detail == null) {
      return;
    }
    final targetFavorite = !state.isFavorite;
    if (targetFavorite) {
      await repo.add(
        FavoriteItem(
          id: detail.id,
          title: detail.title,
          cover: detail.cover,
          type: 'comic',
          source: detail.source,
        ),
      );
    } else {
      await repo.remove(detail.id);
    }
    state = state.copyWith(isFavorite: targetFavorite);
  }

  List<ComicChapter> _sortChapters(List<ComicChapter> chapters, {required bool descending}) {
    final list = List<ComicChapter>.from(chapters);
    list.sort((a, b) {
      final result = a.index.compareTo(b.index);
      if (result != 0) {
        return result;
      }
      return a.title.compareTo(b.title);
    });
    if (descending) {
      return list.reversed.toList(growable: false);
    }
    return list;
  }

  List<ChapterSegment> _buildSegments(List<ComicChapter> chapters, {required int size}) {
    if (chapters.isEmpty) {
      return const <ChapterSegment>[];
    }
    if (size <= 0) {
      return const <ChapterSegment>[];
    }
    final indices = chapters.map((chapter) => chapter.index).toList(growable: false);
    final minIndex = indices.reduce(min);
    final maxIndex = indices.reduce(max);
    final List<ChapterSegment> result = <ChapterSegment>[];
    var start = minIndex;
    while (start <= maxIndex) {
      final end = start + size - 1;
      result.add(ChapterSegment(start: start, end: end));
      start = end + 1;
    }
    return result;
  }

  int _pickDefaultSegmentIndex(List<ChapterSegment> segments, {required bool descending}) {
    if (segments.isEmpty) {
      return 0;
    }
    if (descending) {
      return segments.length - 1;
    }
    return 0;
  }
}
