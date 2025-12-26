import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'ebook_models.dart';
import 'ebook_providers.dart';

class EbookListPage extends ConsumerStatefulWidget {
  const EbookListPage({super.key});

  @override
  ConsumerState<EbookListPage> createState() => _EbookListPageState();
}

class _EbookListPageState extends ConsumerState<EbookListPage> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _categoriesExpanded = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(ebookListProvider.notifier).ensureWarm();
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
      ref.read(ebookListProvider.notifier).loadMore();
    }
  }

  void _onSearchSubmitted(String keyword) {
    ref.read(ebookListProvider.notifier).search(keyword);
  }

  void _clearSearch() {
    ref.read(ebookListProvider.notifier).clearSearch();
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
              Text('搜索电子书', style: Theme.of(ctx).textTheme.titleMedium),
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
                searching: ref.watch(ebookListProvider).searching,
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

  void _openSourceSelector(Map<String, EbookSourceInfo> sources, String? selectedSource) {
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
              final selected = entry.value.id == selectedSource;
              return ListTile(
                title: Text(entry.value.name),
                trailing: selected ? const Icon(Icons.check_rounded) : null,
                onTap: () {
                  ref.read(ebookListProvider.notifier).changeSource(entry.value.id);
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
    final state = ref.watch(ebookListProvider);
    final notifier = ref.read(ebookListProvider.notifier);
    if (_searchController.text != state.searchKeyword) {
      _searchController.text = state.searchKeyword;
      _searchController.selection = TextSelection.fromPosition(
        TextPosition(offset: _searchController.text.length),
      );
    }
    final items = state.inSearchMode ? state.searchResults : state.books;
    final padding = MediaQuery.of(context).padding;
    final titleText = state.selectedCategory?.name.isNotEmpty == true ? state.selectedCategory!.name : '电子书';
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
                  tooltip: '搜索电子书',
                ),
                IconButton(
                  icon: const Icon(Icons.swap_horiz_rounded),
                  onPressed: () => _openSourceSelector(state.sources, state.selectedSource),
                  tooltip: '切换数据源',
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
                    state.inSearchMode ? '无搜索结果' : '暂无电子书',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              )
            else
              _buildEbookSliver(context, items),
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

  Widget _buildEbookSliver(
    BuildContext context,
    List<EbookSummary> items,
  ) {
    final padding = MediaQuery.of(context).padding;
    final paddingBottom = padding.bottom + 16;
    return SliverPadding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, paddingBottom),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 16,
          crossAxisSpacing: 12,
          childAspectRatio: 0.65,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final book = items[index];
            return _EbookCard(
              title: book.title,
              author: book.author,
              onTap: () => _openEbookDetail(book.id),
            );
          },
          childCount: items.length,
        ),
      ),
    );
  }

  void _openEbookDetail(String bookId) {
    if (bookId.isEmpty) {
      return;
    }
    context.push('/ebooks/$bookId');
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
    final state = ref.watch(ebookListProvider);
    final notifier = ref.read(ebookListProvider.notifier);
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
        hintText: '搜索电子书',
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}

class _EbookCard extends StatelessWidget {
  const _EbookCard({
    required this.title,
    required this.author,
    required this.onTap,
  });

  final String title;
  final String author;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: Theme.of(context).colorScheme.outline.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                author,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
