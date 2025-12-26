import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/ebook_card.dart';
import 'ebooks_models.dart';
import 'ebooks_provider.dart';

class EbooksPage extends ConsumerStatefulWidget {
  const EbooksPage({super.key});

  @override
  ConsumerState<EbooksPage> createState() => _EbooksPageState();
}

class _EbooksPageState extends ConsumerState<EbooksPage> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _categoriesExpanded = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(ebooksProvider.notifier).ensureWarm();
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
      ref.read(ebooksProvider.notifier).loadMore();
    }
  }

  void _onSearchSubmitted(String keyword) {
    ref.read(ebooksProvider.notifier).searchBooks(keyword);
  }

  void _clearSearch() {
    _searchController.clear();
    ref.read(ebooksProvider.notifier).clearSearch();
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
              Text('搜索书籍', style: Theme.of(ctx).textTheme.titleMedium),
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
                searching: ref.watch(ebooksProvider).searching,
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

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(ebooksProvider);
    final notifier = ref.read(ebooksProvider.notifier);
    if (_searchController.text != state.searchQuery) {
      _searchController.text = state.searchQuery;
      _searchController.selection = TextSelection.fromPosition(
        TextPosition(offset: _searchController.text.length),
      );
    }
    final items = state.books;
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
                  tooltip: '搜索书籍',
                ),
                IconButton(
                  icon: const Icon(Icons.swap_horiz_rounded),
                  onPressed: () => _openSourceSelector(state.sources, state.selectedSource),
                  tooltip: '切换数据源',
                ),
                IconButton(
                  icon: Icon(state.viewMode == EbooksViewMode.grid ? Icons.view_list_rounded : Icons.grid_view_rounded),
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
                    state.inSearchMode ? '无搜索结果' : '暂无书籍',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              )
            else
              _buildBookSliver(context, state, items),
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

  Widget _buildBookSliver(
    BuildContext context,
    EbooksState state,
    List<EbookSummary> items,
  ) {
    final padding = MediaQuery.of(context).padding;
    final paddingBottom = padding.bottom + 16;
    
    if (state.viewMode == EbooksViewMode.list) {
      return SliverPadding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, paddingBottom),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final book = items[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: EbookCard(
                  title: book.title,
                  author: book.author,
                  cover: book.cover,
                  category: book.category,
                  source: book.source,
                  compact: true,
                  onTap: () => _openBookDetail(book.id),
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
            final book = items[index];
            return EbookCard(
              title: book.title,
              author: book.author,
              cover: book.cover,
              category: book.category,
              source: book.source,
              onTap: () => _openBookDetail(book.id),
            );
          },
          childCount: items.length,
        ),
      ),
    );
  }

  void _openBookDetail(String bookId) {
    if (bookId.isEmpty) {
      return;
    }
    context.push('/ebooks/$bookId');
  }

  void _openSourceSelector(List<EbookSourceInfo> sources, EbookSourceInfo? selectedSource) {
    if (sources.isEmpty) {
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: sources.map((source) {
              final selected = source.id == selectedSource?.id;
              return ListTile(
                title: Text(source.name),
                trailing: selected ? const Icon(Icons.check_rounded) : null,
                onTap: () {
                  ref.read(ebooksProvider.notifier).changeSource(source);
                  Navigator.of(ctx).pop();
                },
              );
            }).toList(),
          ),
        );
      },
    );
  }

  void _showMoreCategories() {
    final state = ref.read(ebooksProvider);
    
    showModalBottomSheet(
      context: context,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        builder: (context, scrollController) => Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '全部分类',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  itemCount: state.categories.length,
                  itemBuilder: (context, index) {
                    final category = state.categories[index];
                    final isSelected = state.selectedCategory?.id == category.id;
                    
                    return ListTile(
                      title: Text(category.name),
                      subtitle: category.group != null ? Text(category.group!) : null,
                      selected: isSelected,
                      onTap: () {
                        ref.read(ebooksProvider.notifier).changeCategory(category);
                        Navigator.pop(context);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
    final state = ref.watch(ebooksProvider);
    final notifier = ref.read(ebooksProvider.notifier);
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
                  onTap: () => notifier.changeCategory(category),
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
        hintText: '搜索书籍',
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}
