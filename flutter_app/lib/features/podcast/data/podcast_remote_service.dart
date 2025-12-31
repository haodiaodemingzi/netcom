import '../../../core/network/api_client.dart';
import '../podcast_models.dart';
import '../../../core/utils/string_utils.dart';

/// 是否使用Mock数据（后端未实现时设为true）
const bool kUseMockData = false;

class PodcastRemoteService {
  PodcastRemoteService(this._api);

  final ApiClient _api;

  /// 获取数据源列表
  Future<Map<String, PodcastSourceInfo>> fetchSources() async {
    if (kUseMockData) {
      return mockSources();
    }
    try {
      final response = await _api.get<dynamic>('/podcast/sources');
      final data = _unwrap(response.data);
      final sourcesRaw = _unwrap(data is Map<String, dynamic> ? data['sources'] : data);
      if (sourcesRaw is! Map<String, dynamic>) {
        return <String, PodcastSourceInfo>{};
      }
      final result = <String, PodcastSourceInfo>{};
      for (final entry in sourcesRaw.entries) {
        result[entry.key] = PodcastSourceInfo.fromJson(entry.value as Map<String, dynamic>? ?? {});
      }
      return result;
    } catch (e) {
      return mockSources();
    }
  }

  /// 获取分类列表
  Future<List<PodcastCategory>> fetchCategories(String? sourceId) async {
    if (kUseMockData) {
      return mockCategories();
    }
    try {
      final params = <String, dynamic>{};
      if (isNotBlank(sourceId)) {
        params['source'] = sourceId!.trim();
      }
      final response = await _api.get<dynamic>('/podcast/categories', query: params);
      final data = _unwrap(response.data);
      if (data is Map<String, dynamic>) {
        final list = data['categories'];
        if (list is List) {
          return list.whereType<Map<String, dynamic>>().map(PodcastCategory.fromJson).where((e) => isNotBlank(e.id)).toList();
        }
      }
      return <PodcastCategory>[];
    } catch (e) {
      return mockCategories();
    }
  }

  /// 获取播客列表（按分类）
  Future<PodcastFeed> fetchPrograms({
    String category = 'all',
    int page = 1,
    int limit = 20,
    String? sourceId,
  }) async {
    if (kUseMockData) {
      return mockPrograms(category, page, limit);
    }
    try {
      final params = <String, dynamic>{
        'category': category,
        'page': page,
        'limit': limit,
      };
      if (isNotBlank(sourceId)) {
        params['source'] = sourceId!.trim();
      }
      final response = await _api.get<dynamic>('/podcast/programs', query: params);
      return _parseFeed(_unwrap(response.data));
    } catch (e) {
      return mockPrograms(category, page, limit);
    }
  }

  /// 获取热门播客
  Future<PodcastFeed> fetchHot({int page = 1, int limit = 20, String? sourceId}) async {
    if (kUseMockData) {
      return mockPrograms('热门', page, limit);
    }
    try {
      final params = <String, dynamic>{'page': page, 'limit': limit};
      if (isNotBlank(sourceId)) params['source'] = sourceId!.trim();
      final response = await _api.get<dynamic>('/podcast/programs/hot', query: params);
      return _parseFeed(_unwrap(response.data));
    } catch (e) {
      return mockPrograms('热门', page, limit);
    }
  }

  /// 获取最新播客
  Future<PodcastFeed> fetchLatest({int page = 1, int limit = 20, String? sourceId}) async {
    if (kUseMockData) {
      return mockPrograms('最新', page, limit);
    }
    try {
      final params = <String, dynamic>{'page': page, 'limit': limit};
      if (isNotBlank(sourceId)) params['source'] = sourceId!.trim();
      final response = await _api.get<dynamic>('/podcast/programs/latest', query: params);
      return _parseFeed(_unwrap(response.data));
    } catch (e) {
      return mockPrograms('最新', page, limit);
    }
  }

  /// 搜索播客
  Future<PodcastFeed> search({required String keyword, String? sourceId, int page = 1, int limit = 20}) async {
    if (kUseMockData) {
      return mockSearch(keyword);
    }
    try {
      final trimmed = keyword.trim();
      if (trimmed.isEmpty) return const PodcastFeed(programs: [], hasMore: false);
      final params = <String, dynamic>{'keyword': trimmed, 'page': page, 'limit': limit};
      if (isNotBlank(sourceId)) params['source'] = sourceId!.trim();
      final response = await _api.get<dynamic>('/podcast/search', query: params);
      return _parseFeed(_unwrap(response.data));
    } catch (e) {
      return mockSearch(keyword);
    }
  }

  /// 获取播客详情
  Future<PodcastDetail?> fetchDetail(String programId, String? sourceId) async {
    if (kUseMockData) {
      return mockDetail(programId);
    }
    if (isBlank(programId)) return null;
    final params = <String, dynamic>{};
    if (isNotBlank(sourceId)) params['source'] = sourceId!.trim();
    final response = await _api.get<dynamic>('/podcast/programs/${programId.trim()}', query: params);
    final data = _unwrap(response.data);
    if (data is Map<String, dynamic>) return PodcastDetail.fromJson(data);
    return null;
  }

  /// 获取节目单集列表
  Future<EpisodesResponse> fetchEpisodes(String programId, {int page = 1, int limit = 50, String? sourceId}) async {
    if (kUseMockData) {
      return mockEpisodes(programId);
    }
    if (isBlank(programId)) return const EpisodesResponse();
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (isNotBlank(sourceId)) params['source'] = sourceId!.trim();
    final response = await _api.get<dynamic>('/podcast/programs/${programId.trim()}/episodes', query: params);
    final data = _unwrap(response.data);
    if (data is Map<String, dynamic>) {
      final episodesJson = data['episodes'] as List?;
      final episodes = episodesJson
              ?.whereType<Map<String, dynamic>>()
              .map(PodcastEpisode.fromJson)
              .where((e) => isNotBlank(e.id))
              .toList() ??
          <PodcastEpisode>[];
      return EpisodesResponse(episodes: episodes, hasMore: data['hasMore'] ?? false, total: data['total'] ?? episodes.length);
    }
    return const EpisodesResponse();
  }

  /// 获取单集详情（含音频地址）
  Future<PodcastEpisode?> fetchEpisodeDetail(String episodeId, String? sourceId) async {
    if (kUseMockData) {
      return mockEpisodeDetail(episodeId);
    }
    if (isBlank(episodeId)) return null;
    final params = <String, dynamic>{};
    if (isNotBlank(sourceId)) params['source'] = sourceId!.trim();
    final response = await _api.get<dynamic>('/podcast/episodes/${episodeId.trim()}', query: params);
    final data = _unwrap(response.data);
    if (data is Map<String, dynamic>) return PodcastEpisode.fromJson(data);
    return null;
  }

  // ========== Mock Data ==========

  Map<String, PodcastSourceInfo> mockSources() {
    return {
      'ximalaya': PodcastSourceInfo(id: 'ximalaya', name: '喜马拉雅', enabled: true),
      'lizhi': PodcastSourceInfo(id: 'lizhi', name: '荔枝FM', enabled: true),
    };
  }

  List<PodcastCategory> mockCategories() {
    return [
      PodcastCategory(id: 'all', name: '全部'),
      PodcastCategory(id: '有声书', name: '有声书'),
      PodcastCategory(id: '相声评书', name: '相声评书'),
      PodcastCategory(id: '音乐', name: '音乐'),
      PodcastCategory(id: '情感', name: '情感'),
      PodcastCategory(id: '知识', name: '知识'),
      PodcastCategory(id: '儿童', name: '儿童'),
      PodcastCategory(id: '历史', name: '历史'),
    ];
  }

  PodcastFeed mockPrograms(String category, int page, int limit) {
    final programs = <PodcastSummary>[];
    final startIndex = (page - 1) * limit;

    for (int i = 0; i < limit; i++) {
      final index = startIndex + i + 1;
      programs.add(PodcastSummary(
        id: 'podcast_$index',
        title: _getMockTitle(category, index),
        cover: 'https://picsum.photos/seed/podcast$index/200/200',
        source: index % 3 == 0 ? 'ximalaya' : 'lizhi',
        author: _getMockAuthor(index),
        episodes: (100 + index * 10),
        description: '这是第$index个播客节目的描述内容，包含丰富的音频内容。',
      ));
    }

    return PodcastFeed(programs: programs, hasMore: page < 5, total: 100);
  }

  PodcastFeed mockSearch(String keyword) {
    final lowerKeyword = keyword.toLowerCase();
    final programs = <PodcastSummary>[];

    for (int i = 1; i <= 5; i++) {
      if (_getMockTitle('', i).toLowerCase().contains(lowerKeyword) || _getMockAuthor(i).toLowerCase().contains(lowerKeyword)) {
        programs.add(PodcastSummary(
          id: 'podcast_$i',
          title: _getMockTitle('', i),
          cover: 'https://picsum.photos/seed/podcast$i/200/200',
          source: i % 2 == 0 ? 'ximalaya' : 'lizhi',
          author: _getMockAuthor(i),
          episodes: 100 + i * 10,
        ));
      }
    }

    return PodcastFeed(programs: programs, hasMore: false, total: programs.length);
  }

  PodcastDetail? mockDetail(String programId) {
    final index = int.tryParse(programId.split('_').last) ?? 1;
    return PodcastDetail(
      id: programId,
      title: _getMockTitle('', index),
      cover: 'https://picsum.photos/seed/$programId/400/400',
      source: index % 3 == 0 ? 'ximalaya' : 'lizhi',
      author: _getMockAuthor(index),
      episodes: 100 + index * 10,
      description: '这是播客节目的详细介绍，包含节目背景、内容概要等信息。节目每周更新，涵盖各种主题。',
      playCount: '${100 + index * 5}万',
      updateTime: '2024-01-${(index % 28 + 1).toString().padLeft(2, '0')}',
    );
  }

  EpisodesResponse mockEpisodes(String programId) {
    final index = int.tryParse(programId.split('_').last) ?? 1;
    final episodes = <PodcastEpisode>[];

    for (int i = 1; i <= 20; i++) {
      episodes.add(PodcastEpisode(
        id: '${programId}_ep_$i',
        title: '第$i集 - ${_getEpisodeTitle(i)}',
        duration: 1800 + i * 60,
        publishTime: '2024-01-${(i % 28 + 1).toString().padLeft(2, '0')}',
        order: i,
        isPlayed: i < 5,
        progress: i < 5 ? 1800 + i * 60 : 0,
      ));
    }

    return EpisodesResponse(episodes: episodes, hasMore: false, total: 100 + index * 10);
  }

  PodcastEpisode? mockEpisodeDetail(String episodeId) {
    final parts = episodeId.split('_');
    if (parts.length < 3) return null;

    final epIndex = int.tryParse(parts.last) ?? 1;
    return PodcastEpisode(
      id: episodeId,
      title: '第$epIndex集 - ${_getEpisodeTitle(epIndex)}',
      duration: 1800 + epIndex * 60,
      publishTime: '2024-01-15',
      order: epIndex,
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      audioUrlBackup: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    );
  }

  String _getMockTitle(String category, int index) {
    final titles = [
      '三国演义',
      '西游记',
      '水浒传',
      '红楼梦',
      '金庸武侠',
      '鬼吹灯',
      '盗墓笔记',
      '明朝那些事儿',
      '资治通鉴',
      '论语心得',
      '庄子心得',
      '道德经',
      '周杰伦经典',
      '五月天音乐',
      '邓丽君金曲',
    ];
    final prefix = category == '有声书' ? '有声书' : category == '音乐' ? '音乐' : '播客';
    return '$prefix-${titles[(index - 1) % titles.length]}';
  }

  String _getMockAuthor(int index) {
    final authors = ['单田芳', '袁阔成', '田连元', '刘兰芳', '马季', '郭德纲', '于谦', '周杰伦', '五月天', '邓丽君'];
    return authors[(index - 1) % authors.length];
  }

  String _getEpisodeTitle(int index) {
    final titles = [
      '桃园三结义',
      '张飞怒打督邮',
      '曹操献刀刺董卓',
      '关羽过五关斩六将',
      '三顾茅庐',
      '赤壁之战',
      '草船借箭',
      '空城计',
      '七擒孟获',
      '六出祁山',
    ];
    return titles[(index - 1) % titles.length];
  }

  // ========== Utilities ==========

  PodcastFeed _parseFeed(dynamic raw) {
    final data = _unwrap(raw);
    List? programsRaw;
    bool hasMore = false;
    if (data is Map<String, dynamic>) {
      programsRaw = data['programs'] as List?;
      hasMore = (data['hasMore'] as bool?) ?? false;
    } else if (data is List) {
      programsRaw = data;
    }
    final programs = programsRaw
            ?.whereType<Map<String, dynamic>>()
            .map(PodcastSummary.fromJson)
            .where((e) => isNotBlank(e.id))
            .toList() ??
        <PodcastSummary>[];
    return PodcastFeed(programs: programs, hasMore: hasMore);
  }

  dynamic _unwrap(dynamic raw) {
    if (raw is Map<String, dynamic>) {
      if (raw.containsKey('data')) return raw['data'];
      if (raw.containsKey('result')) return raw['result'];
    }
    return raw;
  }
}
