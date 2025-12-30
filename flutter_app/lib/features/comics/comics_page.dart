import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/comic_card.dart';
import '../../core/storage/storage_providers.dart';
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(comicsProvider.notifier).ensureWarm();
    });
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
    final titleText = state.selectedCategory?.name.isNotEmpty == true ? state.selectedCategory!.name : '漫画';
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
              bottom: const PreferredSize(
                preferredSize: Size.fromHeight(0),
                child: SizedBox.shrink(),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SourceTabBar(),
                  _CategoryBar(
                    expanded: _categoriesExpanded,
                    onToggle: _toggleCategories,
                  ),
                  if (state.error != null && state.error!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
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
            if ((state.loading || state.sourceSwitching) && items.isNotEmpty)
              const SliverToBoxAdapter(
                child: LinearProgressIndicator(minHeight: 2),
              ),
            if ((state.loading || state.sourceSwitching) && items.isEmpty)
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
    final paddingBottom = padding.bottom + 16;
    if (state.viewMode == ComicsViewMode.list) {
      return SliverPadding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, paddingBottom),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final comic = items[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: ComicCard(
                  title: comic.title,
                  coverUrl: comic.cover,
                  subtitle: comic.latestChapter,
                  source: comic.source,
                  compact: true,
                  extra: comic.author?.isNotEmpty == true ? comic.author : null,
                  onTap: () => _openComicDetail(comic.id),
                ),
              );
            },
            childCount: items.length,
          ),
        ),
      );
    }
    return SliverPadding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, paddingBottom),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 16,
          crossAxisSpacing: 12,
          childAspectRatio: 0.58,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final comic = items[index];
            return ComicCard(
              title: comic.title,
              coverUrl: comic.cover,
              subtitle: comic.latestChapter,
              source: comic.source,
              extra: comic.author?.isNotEmpty == true ? comic.author : null,
              onTap: () => _openComicDetail(comic.id),
            );
          },
          childCount: items.length,
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(comicsProvider);
    final notifier = ref.read(comicsProvider.notifier);
    final categories = state.categories;
    
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
                final selected = category.id == state.selectedCategory?.id;
                return InkWell(
                  onTap: () => notifier.selectCategory(category),
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

/// 源 TabBar - 显示已安装的漫画源
class _SourceTabBar extends ConsumerWidget {
  const _SourceTabBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(comicsProvider);
    final installedSources = ref.watch(sourceRepositoryProvider)?.listInstalled()['comic'] ?? [];

    if (installedSources.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: installedSources.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final sourceId = installedSources[index];
          final selected = sourceId == state.selectedSource;
          final sourceInfo = state.sources[sourceId];

          return InkWell(
            onTap: () => ref.read(comicsProvider.notifier).changeSource(sourceId),
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: selected
                    ? Theme.of(context).colorScheme.primaryContainer
                    : Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                sourceInfo?.name ?? sourceId,
                style: TextStyle(
                  fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                  color: selected
                      ? Theme.of(context).colorScheme.onPrimaryContainer
                      : Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
