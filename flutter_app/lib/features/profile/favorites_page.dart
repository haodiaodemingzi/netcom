import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';

class FavoritesPage extends ConsumerStatefulWidget {
  const FavoritesPage({super.key});

  @override
  ConsumerState<FavoritesPage> createState() => _FavoritesPageState();
}

class _FavoritesPageState extends ConsumerState<FavoritesPage> {
  late final TextEditingController _controller;
  String _keyword = '';

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _controller.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onSearchChanged);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.watch(favoritesRepositoryProvider);
    if (repo == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    final all = repo.list();
    final filtered = _filter(all, _keyword);
    return Scaffold(
      appBar: AppBar(
        title: const Text('我的收藏'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _controller,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _keyword.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _controller.clear();
                          _onSearchChanged();
                        },
                      ),
                hintText: '搜索标题或来源',
                border: const OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? const _EmptyView()
                : ListView.separated(
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      if (item.id.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      return ListTile(
                        leading: _cover(item.cover),
                        title: Text(item.title.isNotEmpty ? item.title : '未命名'),
                        subtitle: Text(item.source?.isNotEmpty == true ? '来源 ${item.source}' : '漫画'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _navigateToDetail(context, item.id),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _onSearchChanged() {
    final value = _controller.text;
    final next = value.trim();
    if (next == _keyword) {
      return;
    }
    setState(() {
      _keyword = next;
    });
  }

  List<FavoriteItem> _filter(List<FavoriteItem> items, String keyword) {
    if (items.isEmpty) {
      return <FavoriteItem>[];
    }
    if (keyword.isEmpty) {
      return items;
    }
    final lower = keyword.toLowerCase();
    return items.where((e) {
      final title = e.title.toLowerCase();
      final source = (e.source ?? '').toLowerCase();
      return title.contains(lower) || source.contains(lower);
    }).toList();
  }

  void _navigateToDetail(BuildContext context, String id) {
    if (id.isEmpty) {
      return;
    }
    context.push('/comic/$id');
  }

  Widget _cover(String? url) {
    if (url == null || url.trim().isEmpty) {
      return const Icon(Icons.broken_image_outlined, size: 40);
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        url,
        width: 40,
        height: 56,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined, size: 40),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.favorite_border, size: 64, color: Colors.grey),
          const SizedBox(height: 12),
          Text(
            '暂无收藏',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
