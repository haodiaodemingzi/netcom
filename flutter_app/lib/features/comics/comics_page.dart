import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/comic_card.dart';
import 'comics_models.dart';
import 'comics_provider.dart';

class ComicsPage extends ConsumerStatefulWidget {
  const ComicsPage({super.key});

  @override
  ConsumerState<ComicsPage> createState() => _ComicsPageState();
}

class _ComicsPageState extends ConsumerState<ComicsPage> {
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
      ref.read(comicsProvider.notifier).loadMore();
    }
  }

  void _onSearchSubmitted(String keyword) {
    ref.read(comicsProvider.notifier).search(keyword);
  }

  void _clearSearch() {
    ref.read(comicsProvider.notifier).clearSearch();
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
              Text('搜索漫画', style: Theme.of(ctx).textTheme.titleMedium),
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
                searching: ref.watch(comicsProvider).searching,
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

  void _openSourceSelector(Map<String, ComicSourceInfo> sources, String? selectedSource) {
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
                  ref.read(comicsProvider.notifier).changeSource(entry.key);
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
    final state = ref.watch(comicsProvider);
    final notifier = ref.read(comicsProvider.notifier);
    if (_searchController.text != state.searchKeyword) {
      _searchController.text = state.searchKeyword;
      _searchController.selection = TextSelection.fromPosition(
        TextPosition(offset: _searchController.text.length),
      );
    }
    final items = state.inSearchMode ? state.searchResults : state.comics;
    final padding = MediaQuery.of(context).padding;
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
              title: const Text('漫画'),
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(0),
                child: const SizedBox.shrink(),
              ),
              actions: [
            IconButton(
              icon: const Icon(Icons.search_rounded),
              onPressed: _openSearchSheet,
              tooltip: '搜索漫画',
            ),
            IconButton(
              icon: const Icon(Icons.swap_horiz_rounded),
              onPressed: () => _openSourceSelector(state.sources, state.selectedSource),
              tooltip: '切换数据源',
            ),
            IconButton(
              icon: Icon(state.viewMode == ComicsViewMode.grid ? Icons.view_list_rounded : Icons.grid_view_rounded),
              onPressed: notifier.toggleViewMode,
              tooltip: '切换视图',
            ),
            IconButton(
              icon: const Icon(Icons.download_rounded),
              onPressed: _openDownloads,
              tooltip: '下载',
            ),
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: state.loading ? null : notifier.refresh,
            ),
          ],
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 12 + padding.top * 0.2, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!state.inSearchMode && state.searchHistory.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _SearchHistory(
                        history: state.searchHistory,
                        onSelect: _onSearchSubmitted,
                        onClear: notifier.clearSearchHistory,
                      ),
                    ],
                    const SizedBox(height: 12),
                    _CategoryBar(
                      expanded: _categoriesExpanded,
                      onToggle: _toggleCategories,
                    ),
                    if (state.error != null && state.error!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Colors.redAccent, size: 16),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                state.error ?? '',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.redAccent),
                              ),
                            ),
                            IconButton(
                              onPressed: notifier.refresh,
                              icon: const Icon(Icons.refresh_rounded),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (state.loading && items.isEmpty)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (items.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Text(
                    state.inSearchMode ? '无搜索结果' : '暂无漫画',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              )
            else
              _buildComicSliver(context, state, items),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.only(bottom: 16 + padding.bottom),
                child: Center(
                  child: state.loadingMore
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const SizedBox.shrink(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComicSliver(
    BuildContext context,
    ComicsState state,
    List<ComicSummary> items,
  ) {
    final padding = MediaQuery.of(context).padding;
    if (state.viewMode == ComicsViewMode.list) {
      return SliverPadding(
        padding: EdgeInsets.only(bottom: 8 + padding.bottom),
        sliver: SliverList.separated(
          itemCount: items.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, index) {
            final comic = items[index];
            return ListTile(
              onTap: () => _openComicDetail(comic.id),
              leading: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: AspectRatio(
                  aspectRatio: 3 / 4,
                  child: Image.network(
                    comic.cover,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: Theme.of(context).colorScheme.surfaceVariant,
                      alignment: Alignment.center,
                      child: const Icon(Icons.broken_image_outlined),
                    ),
                  ),
                ),
              ),
              title: Text(comic.title),
              subtitle: Text(comic.latestChapter),
              trailing: Wrap(
                spacing: 4,
                children: [
                  IconButton(
                    icon: Icon(
                      state.favoriteIds.contains(comic.id) ? Icons.favorite : Icons.favorite_border,
                    ),
                    onPressed: () => ref.read(comicsProvider.notifier).toggleFavorite(comic),
                  ),
                  IconButton(
                    icon: const Icon(Icons.download_rounded),
                    onPressed: () => _openDownloads(),
                  ),
                ],
              ),
            );
          },
        ),
      );
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
      sliver: SliverGrid(
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final comic = items[index];
            return ComicCard(
              title: comic.title,
              coverUrl: comic.cover,
              subtitle: comic.latestChapter,
              source: comic.source,
              isFavorite: state.favoriteIds.contains(comic.id),
              onTap: () => _openComicDetail(comic.id),
              onFavoriteTap: () => ref.read(comicsProvider.notifier).toggleFavorite(comic),
              onDownloadTap: _openDownloads,
              compact: true,
            );
          },
          childCount: items.length,
        ),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 0.58,
          crossAxisSpacing: 6,
          mainAxisSpacing: 6,
        ),
      ),
    );
  }

  void _openComicDetail(String comicId) {
    if (comicId.isEmpty) {
      return;
    }
    context.push('/comic/$comicId');
  }
}

class _CategoryBar extends ConsumerWidget {
  const _CategoryBar({
    required this.expanded,
    required this.onToggle,
  });

  final bool expanded;
  final VoidCallback onToggle;

  static const double _chipHeight = 32;
  static const double _rowSpacing = 8;
  static const double _collapsedRows = 2;
  static const double _collapsedHeight =
      _chipHeight * _collapsedRows + _rowSpacing * (_collapsedRows - 1) + 4;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(comicsProvider);
    final notifier = ref.read(comicsProvider.notifier);
    final double maxHeight = expanded ? MediaQuery.of(context).size.height * 0.8 : _collapsedHeight;
    final categories = state.categories;
    final chips = categories.map((category) {
      final selected = category.id == state.selectedCategory?.id;
      return ChoiceChip(
        label: Text(category.name),
        selected: selected,
        onSelected: (_) => notifier.selectCategory(category),
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
      );
    }).toList();
    final showToggle = categories.length > 9;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          constraints: BoxConstraints(maxHeight: maxHeight),
          child: ClipRect(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: chips,
            ),
          ),
        ),
        if (showToggle)
          TextButton.icon(
            onPressed: onToggle,
            icon: Icon(expanded ? Icons.expand_less : Icons.expand_more),
            label: Text(expanded ? '收起分类' : '展开更多'),
          ),
      ],
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
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search),
        suffixIcon: searching
            ? const Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : controller.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () {
                      controller.clear();
                      onClear();
                    },
                  )
                : null,
        hintText: '搜索漫画',
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}

class _SourceSelector extends StatelessWidget {
  const _SourceSelector({
    required this.sources,
    required this.selectedSource,
    required this.sourcesLoading,
    required this.onTap,
    this.maxWidth,
  });

  final Map<String, ComicSourceInfo> sources;
  final String? selectedSource;
  final bool sourcesLoading;
  final VoidCallback onTap;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    final name = selectedSource != null ? sources[selectedSource]?.name ?? selectedSource! : '请选择数据源';
    final button = OutlinedButton.icon(
      onPressed: sourcesLoading ? null : onTap,
      icon: const Icon(Icons.swap_horiz_rounded),
      label: Flexible(
        child: Text(
          name,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        visualDensity: VisualDensity.compact,
        alignment: Alignment.centerLeft,
      ),
    );
    if (maxWidth != null) {
      return ConstrainedBox(
        constraints: BoxConstraints.tightFor(width: maxWidth!, height: 36),
        child: button,
      );
    }
    return SizedBox(
      width: double.infinity,
      child: button,
    );
  }
}

class _SearchHistory extends StatelessWidget {
  const _SearchHistory({
    required this.history,
    required this.onSelect,
    required this.onClear,
  });

  final List<String> history;
  final ValueChanged<String> onSelect;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '搜索记录',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            TextButton(
              onPressed: onClear,
              child: const Text('清空'),
            ),
          ],
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: history
              .map(
                (keyword) => ActionChip(
                  label: Text(keyword),
                  onPressed: () => onSelect(keyword),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}
