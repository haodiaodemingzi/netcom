import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';

import '../../components/video_card.dart';
import 'video_models.dart';
import 'videos_provider.dart';

class VideosPage extends ConsumerStatefulWidget {
  const VideosPage({super.key});

  @override
  ConsumerState<VideosPage> createState() => _VideosPageState();
}

class _VideosPageState extends ConsumerState<VideosPage> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _categoriesExpanded = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) {
      return;
    }
    final maxScroll = _scrollController.position.maxScrollExtent;
    final current = _scrollController.position.pixels;
    if (current + 200 >= maxScroll) {
      ref.read(videosProvider.notifier).loadMore();
    }
  }

  void _onSearchSubmitted(String keyword) {
    ref.read(videosProvider.notifier).search(keyword);
  }

  void _clearSearch() {
    ref.read(videosProvider.notifier).clearSearch();
  }

  void _openSearchSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        final viewInsets = MediaQuery.of(ctx).viewInsets.bottom;
        return Padding(
          padding: EdgeInsets.only(left: 16, right: 16, top: 24, bottom: viewInsets + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('搜索视频', style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 12),
              _SearchBar(
                controller: _searchController,
                onSubmitted: (value) {
                  _onSearchSubmitted(value);
                  Navigator.of(ctx).pop();
                },
                onClear: () {
                  _clearSearch();
                  Navigator.of(ctx).pop();
                },
                searching: ref.watch(videosProvider).searching,
              ),
            ],
          ),
        );
      },
    );
  }

  void _toggleCategories() {
    setState(() {
      _categoriesExpanded = !_categoriesExpanded;
    });
  }

  void _openDownloads() {
    context.push('/downloads');
  }

  void _openSourceSelector(Map<String, VideoSourceInfo> sources, String? selectedSource) {
    if (sources.isEmpty) {
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: sources.entries.map((entry) {
              final selected = entry.key == selectedSource;
              return ListTile(
                title: Text(entry.value.name),
                trailing: selected ? const Icon(Icons.check_rounded) : null,
                onTap: () {
                  ref.read(videosProvider.notifier).changeSource(entry.key);
                  Navigator.of(ctx).pop();
                },
              );
            }).toList(),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(videosProvider);
    final notifier = ref.read(videosProvider.notifier);
    if (_searchController.text != state.searchKeyword) {
      _searchController.text = state.searchKeyword;
      _searchController.selection = TextSelection.fromPosition(
        TextPosition(offset: _searchController.text.length),
      );
    }
    final items = state.inSearchMode ? state.searchResults : state.videos;
    final padding = MediaQuery.of(context).padding;
    final titleText = state.selectedCategory?.name.isNotEmpty == true ? state.selectedCategory!.name : '视频';
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: notifier.refresh,
        child: CustomScrollView(
          controller: _scrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              floating: true,
              snap: true,
              title: Text(titleText, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(0),
                child: Container(),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.search_rounded),
                  onPressed: _openSearchSheet,
                ),
                IconButton(
                  icon: const Icon(Icons.swap_horiz_rounded),
                  onPressed: () => _openSourceSelector(state.sources, state.selectedSource),
                ),
                IconButton(
                  icon: Icon(state.viewMode == VideosViewMode.grid ? Icons.view_list_rounded : Icons.grid_view_rounded),
                  onPressed: notifier.toggleViewMode,
                ),
                IconButton(
                  icon: const Icon(Icons.download_rounded),
                  onPressed: _openDownloads,
                ),
                IconButton(
                  icon: const Icon(Icons.refresh_rounded),
                  onPressed: state.loading ? null : notifier.refresh,
                ),
              ],
            ),
            if (state.inSearchMode)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '搜索: ${state.searchKeyword}',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                      TextButton(
                        onPressed: _clearSearch,
                        child: const Text('清除'),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverToBoxAdapter(
                child: _CategoryBar(
                  categories: state.categories,
                  selectedCategory: state.selectedCategory,
                  expanded: _categoriesExpanded,
                  onToggle: _toggleCategories,
                  onSelect: (category) {
                    ref.read(videosProvider.notifier).selectCategory(category);
                  },
                ),
              ),
            if (state.loading && items.isNotEmpty)
              const SliverToBoxAdapter(
                child: LinearProgressIndicator(minHeight: 2),
              ),
            if (state.loading && items.isEmpty)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (items.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Text(
                    state.inSearchMode ? '未找到相关视频' : '暂无视频',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
              )
            else
              SliverPadding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, padding.bottom + 16),
                sliver: state.viewMode == VideosViewMode.grid
                    ? SliverGrid(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          mainAxisSpacing: 16,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.58,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (ctx, index) {
                            final video = items[index];
                            return VideoCard(
                              title: video.title,
                              coverUrl: video.cover,
                              subtitle: video.status ?? '',
                              source: video.source,
                              rating: video.rating,
                              extra: video.episodes != null && video.episodes! > 0 ? '${video.episodes} 集' : null,
                              onTap: () {
                                context.push('/videos/${video.id}', extra: {'source': video.source});
                              },
                            );
                          },
                          childCount: items.length,
                        ),
                      )
                    : SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, index) {
                            final video = items[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: VideoCard(
                                title: video.title,
                                coverUrl: video.cover,
                                subtitle: video.status ?? '',
                                source: video.source,
                                rating: video.rating,
                                compact: true,
                                onTap: () {
                                  context.push('/videos/${video.id}', extra: {'source': video.source});
                                },
                              ),
                            );
                          },
                          childCount: items.length,
                        ),
                      ),
              ),
            if (state.loadingMore)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CategoryBar extends StatelessWidget {
  const _CategoryBar({
    required this.categories,
    required this.selectedCategory,
    required this.expanded,
    required this.onToggle,
    required this.onSelect,
  });

  final List<VideoCategory> categories;
  final VideoCategory? selectedCategory;
  final bool expanded;
  final VoidCallback onToggle;
  final ValueChanged<VideoCategory> onSelect;

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) {
      return const SizedBox.shrink();
    }
    final colorScheme = Theme.of(context).colorScheme;
    
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 20),
              itemBuilder: (context, index) {
                final category = categories[index];
                final selected = category.id == selectedCategory?.id;
                return InkWell(
                  onTap: () => onSelect(category),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    decoration: BoxDecoration(
                      border: selected
                          ? Border(
                              bottom: BorderSide(
                                color: colorScheme.primary,
                                width: 2,
                              ),
                            )
                          : null,
                    ),
                    child: Text(
                      category.name,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? colorScheme.primary : colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.only(left: 8, right: 16),
            child: InkWell(
              onTap: onToggle,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '更多',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: colorScheme.primary,
                    ),
                  ),
                  Icon(
                    expanded ? Icons.expand_less : Icons.chevron_right,
                    size: 18,
                    color: colorScheme.primary,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.onSubmitted,
    required this.onClear,
    required this.searching,
  });

  final TextEditingController controller;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onClear;
  final bool searching;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      autofocus: true,
      decoration: InputDecoration(
        hintText: '搜索视频',
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: searching
            ? const SizedBox(
                width: 20,
                height: 20,
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : controller.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear_rounded),
                    onPressed: () {
                      controller.clear();
                      onClear();
                    },
                  )
                : null,
        border: const OutlineInputBorder(),
      ),
      onSubmitted: onSubmitted,
    );
  }
}
