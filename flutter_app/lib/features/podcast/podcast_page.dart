import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/podcast_card.dart';
import 'podcast_models.dart';
import 'podcast_provider.dart';

class PodcastsPage extends ConsumerStatefulWidget {
  const PodcastsPage({super.key});

  @override
  ConsumerState<PodcastsPage> createState() => _PodcastsPageState();
}

class _PodcastsPageState extends ConsumerState<PodcastsPage> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _categoriesExpanded = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(podcastsProvider.notifier).ensureWarm();
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
    if (!_scrollController.hasClients) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final current = _scrollController.position.pixels;
    if (current + 200 >= maxScroll) {
      ref.read(podcastsProvider.notifier).loadMore();
    }
  }

  void _onSearchSubmitted(String keyword) {
    ref.read(podcastsProvider.notifier).search(keyword);
  }

  void _clearSearch() {
    ref.read(podcastsProvider.notifier).clearSearch();
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
              Text('搜索播客', style: Theme.of(ctx).textTheme.titleMedium),
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
                searching: ref.watch(podcastsProvider).searching,
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

  void _openSourceSelector(Map<String, PodcastSourceInfo> sources, String? selectedSource) {
    if (sources.isEmpty) return;
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
                  ref.read(podcastsProvider.notifier).changeSource(entry.key);
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
    final state = ref.watch(podcastsProvider);
    final notifier = ref.read(podcastsProvider.notifier);

    if (_searchController.text != state.searchKeyword) {
      _searchController.text = state.searchKeyword;
      _searchController.selection = TextSelection.fromPosition(
        TextPosition(offset: _searchController.text.length),
      );
    }

    final programs = state.inSearchMode ? state.searchResults : state.programs;
    final padding = MediaQuery.of(context).padding;
    final titleText = state.selectedCategory?.name.isNotEmpty == true ? state.selectedCategory!.name : '播客';

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
              bottom: const PreferredSize(preferredSize: Size.fromHeight(0), child: SizedBox.shrink()),
              actions: [
                IconButton(
                  icon: const Icon(Icons.search_rounded),
                  onPressed: _openSearchSheet,
                  tooltip: '搜索播客',
                ),
                IconButton(
                  icon: const Icon(Icons.swap_horiz_rounded),
                  onPressed: () => _openSourceSelector(state.sources, state.selectedSource),
                  tooltip: '切换数据源',
                ),
                IconButton(
                  icon: Icon(state.viewMode == PodcastsViewMode.grid ? Icons.view_list_rounded : Icons.grid_view_rounded),
                  onPressed: notifier.toggleViewMode,
                  tooltip: '切换视图',
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
                  _CategoryBar(expanded: _categoriesExpanded, onToggle: _toggleCategories),
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
                          IconButton(onPressed: notifier.refresh, icon: const Icon(Icons.refresh_rounded)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            if ((state.loading || state.sourceSwitching) && programs.isNotEmpty)
              const SliverToBoxAdapter(child: LinearProgressIndicator(minHeight: 2))
            else if ((state.loading || state.sourceSwitching) && programs.isEmpty)
              const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
            else if (programs.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Text(
                    state.inSearchMode ? '无搜索结果' : '暂无播客',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              )
            else
              _buildPodcastSliver(context, state, programs),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.only(bottom: 16 + padding.bottom),
                child: Center(
                  child: state.loadingMore
                      ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2))
                      : const SizedBox.shrink(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPodcastSliver(BuildContext context, PodcastsState state, List<PodcastSummary> programs) {
    final padding = MediaQuery.of(context).padding;
    final paddingBottom = padding.bottom + 16;

    if (state.viewMode == PodcastsViewMode.list) {
      return SliverPadding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, paddingBottom),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final program = programs[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PodcastCard(
                  title: program.title,
                  coverUrl: program.cover,
                  subtitle: program.author ?? '${program.episodes}集',
                  source: program.source,
                  compact: true,
                  extra: program.description,
                  onTap: () => _openPodcastDetail(program.id),
                ),
              );
            },
            childCount: programs.length,
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
            final program = programs[index];
            return PodcastCard(
              title: program.title,
              coverUrl: program.cover,
              subtitle: program.author ?? '${program.episodes}集',
              source: program.source,
              extra: program.description,
              onTap: () => _openPodcastDetail(program.id),
            );
          },
          childCount: programs.length,
        ),
      ),
    );
  }

  void _openPodcastDetail(String podcastId) {
    if (podcastId.isEmpty) return;
    context.push('/podcast/$podcastId');
  }
}

/// 分类栏
class _CategoryBar extends ConsumerWidget {
  const _CategoryBar({required this.expanded, required this.onToggle});

  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(podcastsProvider);
    final notifier = ref.read(podcastsProvider.notifier);
    final categories = state.categories;

    if (categories.isEmpty) return const SizedBox.shrink();

    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      height: expanded ? null : 44,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final category = categories[index];
                final selected = category.id == state.selectedCategory?.id;
                return InkWell(
                  onTap: () => notifier.selectCategory(category),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    decoration: BoxDecoration(
                      border: selected
                          ? Border(bottom: BorderSide(color: colorScheme.primary, width: 2))
                          : null,
                    ),
                    child: Text(
                      category.name,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? colorScheme.primary : colorScheme.onSurface.withValues(alpha: 0.7),
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
                  Text('更多', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: colorScheme.primary)),
                  Icon(expanded ? Icons.expand_less : Icons.chevron_right, size: 18, color: colorScheme.primary),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 搜索栏
class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.controller, required this.onSubmitted, required this.onClear, required this.searching});

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
                child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
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
        hintText: '搜索播客',
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
