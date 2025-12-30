import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_app/features/market/market_models.dart';
import 'package:flutter_app/features/market/market_provider.dart';

/// 数据源市场页面
class MarketPage extends ConsumerStatefulWidget {
  const MarketPage({super.key});

  @override
  ConsumerState<MarketPage> createState() => _MarketPageState();
}

class _MarketPageState extends ConsumerState<MarketPage> {
  @override
  void initState() {
    super.initState();
    // 设置默认选中"全部"分类
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final categories = ref.read(marketProvider).categories;
      if (categories.isNotEmpty) {
        ref.read(marketProvider.notifier).selectCategory(categories.first);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(marketProvider);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildAppBar(state),
          _buildCategoryTabBar(state),
          _buildContent(state),
        ],
      ),
    );
  }

  /// 构建 AppBar
  Widget _buildAppBar(MarketState state) {
    return SliverAppBar(
      title: const Text('数据源市场'),
      pinned: true,
      actions: [
        // 未激活时显示激活按钮
        if (!state.isActivated)
          IconButton(
            icon: const Icon(Icons.vpn_key),
            tooltip: '激活',
            onPressed: () => _openActivationDialog(context),
          ),
        IconButton(
          icon: const Icon(Icons.search),
          tooltip: '搜索',
          onPressed: () => _openSearchBottomSheet(context),
        ),
        IconButton(
          icon: const Icon(Icons.refresh),
          tooltip: '刷新',
          onPressed: state.loading ? null : () => ref.read(marketProvider.notifier).refresh(),
        ),
      ],
    );
  }

  /// 构建分类 TabBar
  Widget _buildCategoryTabBar(MarketState state) {
    return SliverToBoxAdapter(
      child: _CategoryTabBar(
        categories: state.categories,
        selectedCategory: state.selectedCategory,
        onSelect: (category) {
          ref.read(marketProvider.notifier).selectCategory(category);
        },
      ),
    );
  }

  /// 构建内容区域
  Widget _buildContent(MarketState state) {
    if (state.loading) {
      return const SliverFillRemaining(
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (state.error != null) {
      return SliverFillRemaining(
        child: _ErrorView(
          error: state.error!,
          onRetry: () => ref.read(marketProvider.notifier).refresh(),
        ),
      );
    }

    final sources = state.displaySources;
    if (sources.isEmpty) {
      return const SliverFillRemaining(
        child: _EmptyView(),
      );
    }

    return _SourceGrid(
      sources: sources,
      installedSources: state.installedSources,
      onInstall: (source) => ref.read(marketProvider.notifier).installSource(source),
      onUninstall: (sourceId) => ref.read(marketProvider.notifier).uninstallSource(sourceId),
    );
  }

  /// 打开搜索底部弹窗
  void _openSearchBottomSheet(BuildContext context) {
    final controller = TextEditingController();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('搜索数据源', style: Theme.of(ctx).textTheme.titleMedium),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: '搜索名称、描述、标签',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (value) {
                  ref.read(marketProvider.notifier).search(value);
                  Navigator.of(ctx).pop();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  /// 打开激活对话框
  void _openActivationDialog(BuildContext context) {
    final codeController = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) {
        final state = ref.watch(marketProvider);
        return AlertDialog(
          title: const Text('输入激活码'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: codeController,
                decoration: const InputDecoration(
                  labelText: '激活码',
                  hintText: '请输入激活码',
                  border: OutlineInputBorder(),
                ),
                autofocus: true,
              ),
              if (state.activationError != null) ...[
                const SizedBox(height: 12),
                Text(
                  state.activationError!,
                  style: TextStyle(color: Theme.of(ctx).colorScheme.error),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: state.activating ? null : () => Navigator.of(ctx).pop(),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: state.activating
                  ? null
                  : () {
                      final code = codeController.text.trim();
                      if (code.isEmpty) return;
                      ref.read(marketProvider.notifier).activate(code);
                      if (!state.activating) Navigator.of(ctx).pop();
                    },
              child: state.activating
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('激活'),
            ),
          ],
        );
      },
    );
  }
}

/// 分类 TabBar
class _CategoryTabBar extends StatelessWidget {
  const _CategoryTabBar({
    required this.categories,
    required this.selectedCategory,
    required this.onSelect,
  });

  final List<MarketCategory> categories;
  final MarketCategory? selectedCategory;
  final ValueChanged<MarketCategory> onSelect;

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final category = categories[index];
          final selected = category.id == selectedCategory?.id;
          return _CategoryChip(
            category: category,
            selected: selected,
            onTap: () => onSelect(category),
          );
        },
      ),
    );
  }
}

/// 分类 Chip
class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.category,
    required this.selected,
    required this.onTap,
  });

  final MarketCategory category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(category.icon, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 6),
            Text(
              category.name,
              style: TextStyle(
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 数据源列表
class _SourceGrid extends StatelessWidget {
  const _SourceGrid({
    required this.sources,
    required this.installedSources,
    required this.onInstall,
    required this.onUninstall,
  });

  final List<MarketSource> sources;
  final Map<String, List<String>> installedSources;
  final ValueChanged<MarketSource> onInstall;
  final ValueChanged<String> onUninstall;

  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final source = sources[index];
            final installed = source.isInstalled(installedSources);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _SourceCard(
                source: source,
                installed: installed,
                onToggleInstall: installed
                    ? () => onUninstall(source.id)
                    : () => onInstall(source),
              ),
            );
          },
          childCount: sources.length,
        ),
      ),
    );
  }
}

/// 数据源卡片
class _SourceCard extends StatelessWidget {
  const _SourceCard({
    required this.source,
    required this.installed,
    required this.onToggleInstall,
  });

  final MarketSource source;
  final bool installed;
  final VoidCallback onToggleInstall;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _showSourceDetail(context, source),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // 左边图标
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: CachedNetworkImage(
                  imageUrl: source.icon,
                  width: 80,
                  height: 80,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(
                    width: 80,
                    height: 80,
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    child: const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                  ),
                  errorWidget: (_, __, ___) => _buildDefaultIcon(context),
                ),
              ),
              const SizedBox(width: 16),
              // 右边信息
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      source.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      source.description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                          ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    // 标签
                    if (source.tags.isNotEmpty)
                      Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: source.tags.take(2).map((tag) {
                          return Chip(
                            label: Text(tag, style: const TextStyle(fontSize: 10)),
                            visualDensity: VisualDensity.compact,
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          );
                        }).toList(),
                      ),
                    const SizedBox(height: 8),
                    // 安装按钮
                    FilledButton.tonal(
                      onPressed: onToggleInstall,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(36),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                      ),
                      child: Text(installed ? '已安装' : '安装'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDefaultIcon(BuildContext context) {
    final initial = source.name.isNotEmpty ? source.name[0] : '?';
    return Container(
      width: 80,
      height: 80,
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Center(
        child: Text(
          initial,
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                color: Theme.of(context).colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.bold,
              ),
        ),
      ),
    );
  }

  void _showSourceDetail(BuildContext context, MarketSource source) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return SingleChildScrollView(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: CachedNetworkImage(
                      imageUrl: source.icon,
                      width: 80,
                      height: 80,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Container(
                        width: 80,
                        height: 80,
                        color: Theme.of(ctx).colorScheme.primaryContainer,
                        child: Center(
                          child: Text(
                            source.name.isNotEmpty ? source.name[0] : '?',
                            style: Theme.of(ctx).textTheme.headlineSmall,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          source.name,
                          style: Theme.of(ctx).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'v${source.version} · ${source.author}',
                          style: Theme.of(ctx).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                '描述',
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(source.description),
              const SizedBox(height: 16),
              Text(
                '标签',
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: source.tags
                    .map((tag) => Chip(label: Text(tag)))
                    .toList(),
              ),
              const SizedBox(height: 16),
              if (source.baseUrl != null) ...[
                Text(
                  '地址',
                  style: Theme.of(ctx).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  source.url,
                  style: Theme.of(ctx).textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
              ],
              FilledButton.tonal(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  onToggleInstall();
                },
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                child: Text(installed ? '已安装' : '安装'),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// 错误视图
class _ErrorView extends StatelessWidget {
  const _ErrorView({
    required this.error,
    required this.onRetry,
  });

  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              '加载失败',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('重试'),
            ),
          ],
        ),
      ),
    );
  }
}

/// 空视图
class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.store_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
          ),
          const SizedBox(height: 16),
          Text(
            '暂无数据源',
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ],
      ),
    );
  }
}
