import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_app/features/ebooks/ebooks_provider.dart';
import 'package:flutter_app/features/ebooks/ebooks_models.dart';
import 'package:flutter_app/components/ebook_card.dart';

class EbooksPage extends ConsumerStatefulWidget {
  const EbooksPage({super.key});

  @override
  ConsumerState<EbooksPage> createState() => _EbooksPageState();
}

class _EbooksPageState extends ConsumerState<EbooksPage>
    with SingleTickerProviderStateMixin {
  final TextEditingController _searchController = TextEditingController();
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _tabController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  void _loadMore() {
    final state = ref.read(ebooksProvider);
    if (!state.isLoading && state.hasMore && !state.isSearching) {
      ref.read(ebooksProvider.notifier).loadBooks();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(ebooksProvider);
    final notifier = ref.read(ebooksProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('电子书'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(120),
          child: Column(
            children: [
              // 搜索栏和数据源选择
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: '搜索书籍...',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: state.searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear),
                                  onPressed: () {
                                    _searchController.clear();
                                    notifier.clearSearch();
                                  },
                                )
                              : null,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(25),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                        ),
                        onChanged: (value) {
                          if (value.isEmpty) {
                            notifier.clearSearch();
                          }
                        },
                        onSubmitted: (value) {
                          notifier.searchBooks(value);
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    DropdownButton<EbookSourceInfo>(
                      value: state.selectedSource,
                      items: state.categories
                          .where((cat) => cat.type == 'source')
                          .map((source) => DropdownMenuItem(
                                value: EbookSourceInfo(
                                  id: source.id,
                                  name: source.name,
                                  description: '',
                                  supportsSearch: true,
                                ),
                                child: Text(source.name),
                              ))
                          .toList(),
                      onChanged: (source) {
                        if (source != null) {
                          notifier.changeSource(source);
                        }
                      },
                    ),
                  ],
                ),
              ),
              // 分类标签栏
              SizedBox(
                height: 50,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: state.categories.length + 1,
                  itemBuilder: (context, index) {
                    if (index == state.categories.length) {
                      // 更多按钮
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ActionChip(
                          label: const Text('更多'),
                          onPressed: () {
                            _showMoreCategories(context);
                          },
                        ),
                      );
                    }

                    final category = state.categories[index];
                    final isSelected = state.selectedCategory?.id == category.id;
                    
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(category.name),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            notifier.changeCategory(category);
                          }
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await notifier.refresh();
        },
        child: _buildBody(state, notifier),
      ),
    );
  }

  Widget _buildBody(EbooksState state, EbooksNotifier notifier) {
    if (state.isLoading && state.books.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (state.error != null && state.books.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              state.error!,
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                notifier.clearError();
                notifier.refresh();
              },
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (state.books.isEmpty && !state.isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.book_outlined,
              size: 64,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 16),
            Text(
              state.isSearching ? '未找到相关书籍' : '暂无书籍',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            if (state.isSearching) ...[
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: notifier.clearSearch,
                child: const Text('清除搜索'),
              ),
            ],
          ],
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: GridView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              childAspectRatio: 3 / 4,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: state.books.length + (state.isLoading ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == state.books.length) {
                return const Center(
                  child: CircularProgressIndicator(),
                );
              }

              final book = state.books[index];
              return EbookCard(
                title: book.title,
                author: book.author,
                cover: book.cover,
                category: book.category,
                source: book.source,
                onTap: () {
                  Navigator.pushNamed(
                    context,
                    '/ebooks/${book.id}',
                    arguments: {
                      'bookId': book.id,
                      'source': book.source,
                    },
                  );
                },
              );
            },
          ),
        ),
        if (state.isLoading && state.books.isNotEmpty)
          const Padding(
            padding: EdgeInsets.all(16),
            child: LinearProgressIndicator(),
          ),
      ],
    );
  }

  void _showMoreCategories(BuildContext context) {
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
