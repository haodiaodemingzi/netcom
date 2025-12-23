import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'video_models.dart';
import 'video_detail_provider.dart';
import 'video_player_page.dart';

class VideoDetailPage extends ConsumerStatefulWidget {
  const VideoDetailPage({
    super.key,
    required this.videoId,
    this.source,
  });

  final String videoId;
  final String? source;

  @override
  ConsumerState<VideoDetailPage> createState() => _VideoDetailPageState();
}

class _VideoDetailPageState extends ConsumerState<VideoDetailPage> {
  bool _episodesReversed = false;
  bool _descExpanded = false;

  void _toggleEpisodeOrder() {
    setState(() {
      _episodesReversed = !_episodesReversed;
    });
  }

  List<Widget> _buildDescriptionSection(String? description) {
    final raw = description?.trim() ?? '';
    if (raw.isEmpty) {
      return const <Widget>[];
    }
    if (!_descExpanded) {
      return [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () {
              setState(() {
                _descExpanded = true;
              });
            },
            child: const Text('展开简介'),
          ),
        ),
      ];
    }
    final sanitized = raw.replaceAll(RegExp(r'\s+'), ' ').trim();
    return [
      Text('简介', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
      const SizedBox(height: 4),
      Text(
        sanitized,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton(
          onPressed: () {
            setState(() {
              _descExpanded = false;
            });
          },
          child: const Text('收起'),
        ),
      ),
      const SizedBox(height: 8),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final args = VideoDetailRequest(videoId: widget.videoId, source: widget.source);
    final state = ref.watch(videoDetailProvider(args));
    final notifier = ref.read(videoDetailProvider(args).notifier);
    final colorScheme = Theme.of(context).colorScheme;

    if (state.loading) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (state.error != null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(state.error!, style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: notifier.refresh,
                child: const Text('重试'),
              ),
            ],
          ),
        ),
      );
    }

    final detail = state.detail;
    if (detail == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('视频不存在')),
      );
    }

    final episodes = _episodesReversed ? state.episodes.reversed.toList() : state.episodes;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 200,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: detail.cover.isNotEmpty
                  ? Image.network(
                      detail.cover,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(color: colorScheme.surfaceVariant),
                    )
                  : Container(color: colorScheme.surfaceVariant),
            ),
            actions: [
              IconButton(
                icon: Icon(state.isFavorite ? Icons.favorite : Icons.favorite_border),
                onPressed: notifier.toggleFavorite,
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail.title,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  if (detail.rating != null)
                    Row(
                      children: [
                        const Icon(Icons.star, color: Colors.amber, size: 20),
                        const SizedBox(width: 4),
                        Text(
                          detail.rating!.toStringAsFixed(1),
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  const SizedBox(height: 8),
                  if (detail.status != null && detail.status!.isNotEmpty)
                    Text(
                      detail.status!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colorScheme.primary),
                    ),
                  const SizedBox(height: 8),
                  if (detail.area != null || detail.year != null)
                    Text(
                      [detail.area, detail.year].where((e) => e != null && e.isNotEmpty).join(' · '),
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  const SizedBox(height: 12),
                  if (detail.tags.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: detail.tags.map((tag) {
                        return Chip(
                          label: Text(tag, style: const TextStyle(fontSize: 12)),
                          padding: EdgeInsets.zero,
                          visualDensity: VisualDensity.compact,
                        );
                      }).toList(),
                    ),
                  const SizedBox(height: 12),
                  if (detail.actors.isNotEmpty) ...[
                    Text('主演', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(detail.actors.join(', '), style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 12),
                  ],
                  ..._buildDescriptionSection(detail.description),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Text(
                    '剧集 (${state.episodes.length})',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: Icon(_episodesReversed ? Icons.arrow_upward : Icons.arrow_downward),
                    onPressed: _toggleEpisodeOrder,
                  ),
                ],
              ),
            ),
          ),
          if (episodes.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: Text('暂无剧集')),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 2,
                ),
                delegate: SliverChildBuilderDelegate(
                  (ctx, index) {
                    final episode = episodes[index];
                    return OutlinedButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => VideoPlayerPage(
                              videoId: widget.videoId,
                              episodeId: episode.id,
                              episodes: state.episodes,
                              source: detail.source.isNotEmpty ? detail.source : widget.source,
                              coverUrl: detail.cover,
                            ),
                          ),
                        );
                      },
                      child: Text(
                        episode.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12),
                      ),
                    );
                  },
                  childCount: episodes.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
