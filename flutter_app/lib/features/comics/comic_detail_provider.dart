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
    this.chapterDisplayType = ChapterDisplayType.all,
    this.segmentMap = const <ChapterDisplayType, List<ChapterSegment>>{},
    this.currentSegment,
    this.sortOrderMap = const <String, bool>{},
    this.allChapters = const <ComicChapter>[],
    this.allVolumes = const <ComicVolume>[],
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
  final ChapterDisplayType chapterDisplayType;
  final Map<ChapterDisplayType, List<ChapterSegment>> segmentMap;
  final ChapterSegment? currentSegment;
  final Map<String, bool> sortOrderMap;
  final List<ComicChapter> allChapters;
  final List<ComicVolume> allVolumes;

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
    ChapterDisplayType? chapterDisplayType,
    Map<ChapterDisplayType, List<ChapterSegment>>? segmentMap,
    ChapterSegment? currentSegment,
    Map<String, bool>? sortOrderMap,
    List<ComicChapter>? allChapters,
    List<ComicVolume>? allVolumes,
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
      chapterDisplayType: chapterDisplayType ?? this.chapterDisplayType,
      segmentMap: segmentMap ?? this.segmentMap,
      currentSegment: currentSegment ?? this.currentSegment,
      sortOrderMap: sortOrderMap ?? this.sortOrderMap,
      allChapters: allChapters ?? this.allChapters,
      allVolumes: allVolumes ?? this.allVolumes,
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
      
      final volumes = _parseVolumesFromChapters(data.chapters);
      final chaptersOnly = _extractChaptersOnly(data.chapters);
      
      final segmentMap = {
        ChapterDisplayType.all: _buildSegmentsFor(data.chapters),
        ChapterDisplayType.volume: _buildSegmentsForVolumes(volumes),
        ChapterDisplayType.chapter: _buildSegmentsFor(chaptersOnly),
      };
      
      final initialSegment = segmentMap[ChapterDisplayType.all]?.first;
      final initialSortOrder = state.descending;
      final initialSortKey = _getCurrentViewKey(ChapterDisplayType.all, initialSegment);
      final initialSortMap = {initialSortKey: initialSortOrder};
      
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
        allChapters: data.chapters,
        allVolumes: volumes,
        segmentMap: segmentMap,
        chapterDisplayType: ChapterDisplayType.all,
        currentSegment: initialSegment,
        sortOrderMap: initialSortMap,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: '加载失败 ${e.toString()}');
    }
  }

  void toggleSortOrder() {
    final key = _getCurrentViewKey(state.chapterDisplayType, state.currentSegment);
    final currentOrder = state.sortOrderMap[key] ?? true;
    final newSortOrderMap = Map<String, bool>.from(state.sortOrderMap);
    newSortOrderMap[key] = !currentOrder;
    state = state.copyWith(sortOrderMap: newSortOrderMap);
  }
  
  void setChapterDisplayType(ChapterDisplayType type) {
    final segments = state.segmentMap[type] ?? [];
    state = state.copyWith(
      chapterDisplayType: type,
      currentSegment: segments.isNotEmpty ? segments.first : null,
      selectedChapterIds: const <String>{},
      selectionMode: false,
    );
  }
  
  void setSegment(ChapterSegment segment) {
    state = state.copyWith(
      currentSegment: segment,
      selectedChapterIds: const <String>{},
      selectionMode: false,
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
    List<ComicChapter> baseList;
    
    if (state.chapterDisplayType == ChapterDisplayType.volume) {
      baseList = _getChaptersFromVolumesInSegment(state.currentSegment);
    } else if (state.chapterDisplayType == ChapterDisplayType.chapter) {
      baseList = _getChaptersInSegment(state.currentSegment, _extractChaptersOnly(state.allChapters));
    } else {
      baseList = _getChaptersInSegment(state.currentSegment, state.allChapters);
    }
    
    final key = _getCurrentViewKey(state.chapterDisplayType, state.currentSegment);
    final descending = state.sortOrderMap[key] ?? true;
    
    return _sortChapters(baseList, descending: descending);
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
      final aNum = _extractNumber(a.title);
      final bNum = _extractNumber(b.title);
      
      if (aNum != null && bNum != null) {
        final result = aNum.compareTo(bNum);
        if (result != 0) {
          return result;
        }
      }
      
      final indexResult = a.index.compareTo(b.index);
      if (indexResult != 0) {
        return indexResult;
      }
      
      return a.title.compareTo(b.title);
    });
    if (descending) {
      return list.reversed.toList(growable: false);
    }
    return list;
  }
  
  int? _extractNumber(String title) {
    final patterns = [
      RegExp(r'第(\d+)卷'),
      RegExp(r'第(\d+)话'),
      RegExp(r'第(\d+)章'),
      RegExp(r'Vol\.(\d+)', caseSensitive: false),
      RegExp(r'Chapter\s*(\d+)', caseSensitive: false),
      RegExp(r'(\d+)'),
    ];
    
    for (final pattern in patterns) {
      final match = pattern.firstMatch(title);
      if (match != null && match.groupCount > 0) {
        return int.tryParse(match.group(1)!);
      }
    }
    return null;
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
  
  String _getCurrentViewKey(ChapterDisplayType type, ChapterSegment? segment) {
    return '${type.name}-${segment?.label() ?? 'all'}';
  }
  
  List<ComicVolume> _parseVolumesFromChapters(List<ComicChapter> allChapters) {
    final Map<String, List<ComicChapter>> volumeMap = {};
    for (final chapter in allChapters) {
      final volMatch = RegExp(r'(第\d+卷|Vol\.\d+)', caseSensitive: false).firstMatch(chapter.title);
      if (volMatch != null) {
        final volumeTitle = volMatch.group(0)!;
        if (volumeMap.containsKey(volumeTitle)) {
          volumeMap[volumeTitle]!.add(chapter);
        } else {
          volumeMap[volumeTitle] = [chapter];
        }
      }
    }
    
    final volumes = volumeMap.entries.map((entry) {
      return ComicVolume(id: entry.key, title: entry.key, chapters: entry.value);
    }).toList();
    
    volumes.sort((a, b) {
      final aNum = _extractNumber(a.title);
      final bNum = _extractNumber(b.title);
      if (aNum != null && bNum != null) {
        return aNum.compareTo(bNum);
      }
      return a.title.compareTo(b.title);
    });
    
    return volumes;
  }
  
  List<ComicChapter> _extractChaptersOnly(List<ComicChapter> allChapters) {
    return allChapters.where((chapter) {
      final hasVolume = RegExp(r'第\d+卷|Vol\.\d+', caseSensitive: false).hasMatch(chapter.title);
      return !hasVolume;
    }).toList();
  }
  
  List<ChapterSegment> _buildSegmentsFor(List<ComicChapter> chapters) {
    if (chapters.isEmpty) {
      return const <ChapterSegment>[];
    }
    
    final sortedChapters = List<ComicChapter>.from(chapters);
    sortedChapters.sort((a, b) {
      final aNum = _extractNumber(a.title);
      final bNum = _extractNumber(b.title);
      if (aNum != null && bNum != null) {
        return aNum.compareTo(bNum);
      }
      return a.index.compareTo(b.index);
    });
    
    final List<ChapterSegment> result = <ChapterSegment>[];
    final size = state.segmentSize;
    
    final firstNum = _extractNumber(sortedChapters.first.title) ?? 1;
    final lastNum = _extractNumber(sortedChapters.last.title) ?? sortedChapters.length;
    
    var currentStart = firstNum;
    while (currentStart <= lastNum) {
      final currentEnd = currentStart + size - 1;
      result.add(ChapterSegment(start: currentStart, end: currentEnd.clamp(currentStart, lastNum)));
      currentStart = currentEnd + 1;
    }
    
    return result;
  }
  
  List<ChapterSegment> _buildSegmentsForVolumes(List<ComicVolume> volumes) {
    if (volumes.isEmpty) {
      return const <ChapterSegment>[];
    }
    final List<ChapterSegment> result = <ChapterSegment>[];
    final size = state.segmentSize;
    for (var i = 0; i < volumes.length; i += size) {
      final end = (i + size - 1).clamp(0, volumes.length - 1);
      result.add(ChapterSegment(start: i, end: end));
    }
    return result;
  }
  
  List<ComicChapter> _getChaptersFromVolumesInSegment(ChapterSegment? segment) {
    if (segment == null || state.allVolumes.isEmpty) {
      return const <ComicChapter>[];
    }
    final List<ComicChapter> result = <ComicChapter>[];
    for (var i = segment.start; i <= segment.end && i < state.allVolumes.length; i++) {
      result.addAll(state.allVolumes[i].chapters);
    }
    return result;
  }
  
  List<ComicChapter> _getChaptersInSegment(ChapterSegment? segment, List<ComicChapter> chapters) {
    if (segment == null || chapters.isEmpty) {
      return chapters;
    }
    
    return chapters.where((chapter) {
      final chapterNum = _extractNumber(chapter.title);
      if (chapterNum == null) {
        return false;
      }
      return chapterNum >= segment.start && chapterNum <= segment.end;
    }).toList();
  }
}
