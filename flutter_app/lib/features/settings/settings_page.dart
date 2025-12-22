import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import '../../core/storage/storage_repository.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
  }

  Future<void> _loadAppVersion() async {
    final info = await PackageInfo.fromPlatform();
    setState(() {
      _appVersion = 'v${info.version} (${info.buildNumber})';
    });
  }

  @override
  Widget build(BuildContext context) {
    final settingsRepo = ref.watch(settingsRepositoryProvider);
    final settings = settingsRepo?.load();

    return Scaffold(
      appBar: AppBar(
        title: const Text('设置'),
      ),
      body: ListView(
        children: [
          _buildUserHeader(context),
          const SizedBox(height: 16),
          _buildMySection(context),
          const SizedBox(height: 16),
          _buildNetworkSection(context),
          const SizedBox(height: 16),
          _buildSettingsSection(context, settings, settingsRepo),
          const SizedBox(height: 16),
          _buildOtherSection(context),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildUserHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(32),
      color: Theme.of(context).colorScheme.surface,
      child: Column(
        children: [
          CircleAvatar(
            radius: 40,
            backgroundColor: Theme.of(context).colorScheme.primary,
            child: const Icon(Icons.person, size: 40, color: Colors.white),
          ),
          const SizedBox(height: 16),
          Text(
            '漫画爱好者',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildMySection(BuildContext context) {
    return _buildSection(
      context,
      title: '我的',
      children: [
        _buildMenuItem(
          context,
          title: '数据源市场',
          icon: Icons.store,
          onTap: () => context.push('/market'),
        ),
        _buildMenuItem(
          context,
          title: '我的收藏',
          icon: Icons.favorite,
          onTap: () => context.push('/favorites'),
        ),
        _buildMenuItem(
          context,
          title: '阅读历史',
          icon: Icons.history,
          onTap: () => context.push('/history'),
        ),
        _buildMenuItem(
          context,
          title: '下载管理',
          icon: Icons.download,
          onTap: () => context.push('/downloads'),
        ),
      ],
    );
  }

  Widget _buildNetworkSection(BuildContext context) {
    return _buildSection(
      context,
      title: '网络',
      children: [
        _buildMenuItem(
          context,
          title: '代理设置',
          icon: Icons.vpn_key,
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('代理设置功能开发中')),
            );
          },
        ),
      ],
    );
  }

  Widget _buildSettingsSection(
    BuildContext context,
    SettingsModel? settings,
    SettingsRepository? repo,
  ) {
    if (settings == null || repo == null) {
      return const SizedBox.shrink();
    }

    return _buildSection(
      context,
      title: '设置',
      children: [
        _buildRadioSetting(
          context,
          title: '显示模式',
          value: settings.viewMode,
          options: const [
            RadioOption(label: '卡片', value: 'card'),
            RadioOption(label: '列表', value: 'list'),
          ],
          onChanged: (value) {
            repo.update({'viewMode': value});
          },
        ),
        _buildRadioSetting(
          context,
          title: '阅读模式',
          value: settings.scrollMode,
          options: const [
            RadioOption(label: '左右滑动', value: 'horizontal'),
            RadioOption(label: '上下滑动', value: 'vertical'),
          ],
          onChanged: (value) {
            repo.update({'scrollMode': value});
          },
        ),
        _buildSwitchSetting(
          context,
          title: '夜间模式',
          value: settings.darkMode,
          onChanged: (value) {
            repo.update({'darkMode': value});
          },
        ),
        _buildSwitchSetting(
          context,
          title: 'WiFi下自动加载高清图',
          value: settings.autoLoadHD,
          onChanged: (value) {
            repo.update({'autoLoadHD': value});
          },
        ),
        _buildSwitchSetting(
          context,
          title: '阅读时保持屏幕常亮',
          value: settings.keepScreenOn,
          onChanged: (value) {
            repo.update({'keepScreenOn': value});
          },
        ),
        _buildNumberSetting(
          context,
          title: '下载并发数',
          value: settings.maxConcurrentDownloads,
          min: 1,
          max: 20,
          onChanged: (value) {
            repo.update({'maxConcurrentDownloads': value});
          },
        ),
      ],
    );
  }

  Widget _buildOtherSection(BuildContext context) {
    return _buildSection(
      context,
      title: '其他',
      children: [
        _buildMenuItem(
          context,
          title: '清除缓存',
          icon: Icons.delete_sweep,
          onTap: () => _handleClearCache(context),
        ),
        _buildMenuItem(
          context,
          title: '清除历史记录',
          icon: Icons.delete_outline,
          onTap: () => _handleClearHistory(context),
        ),
        _buildMenuItem(
          context,
          title: '关于应用',
          icon: Icons.info_outline,
          trailing: Text(
            _appVersion,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          showArrow: false,
          onTap: () {
            showAboutDialog(
              context: context,
              applicationName: '漫画阅读器',
              applicationVersion: _appVersion,
              applicationIcon: const Icon(Icons.book, size: 48),
            );
          },
        ),
      ],
    );
  }

  Widget _buildSection(
    BuildContext context, {
    required String title,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            title,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ),
        Card(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: children,
          ),
        ),
      ],
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required String title,
    IconData? icon,
    Widget? trailing,
    bool showArrow = true,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: icon != null ? Icon(icon) : null,
      title: Text(title),
      trailing: trailing ??
          (showArrow ? const Icon(Icons.chevron_right) : null),
      onTap: onTap,
    );
  }

  Widget _buildSwitchSetting(
    BuildContext context, {
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile(
      title: Text(title),
      value: value,
      onChanged: onChanged,
    );
  }

  Widget _buildRadioSetting(
    BuildContext context, {
    required String title,
    required String value,
    required List<RadioOption> options,
    required ValueChanged<String> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            title,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Row(
            children: options.map((option) {
              final isSelected = value == option.value;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(
                    label: Text(option.label),
                    selected: isSelected,
                    onSelected: (_) => onChanged(option.value),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        const Divider(height: 1),
      ],
    );
  }

  Widget _buildNumberSetting(
    BuildContext context, {
    required String title,
    required int value,
    required int min,
    required int max,
    required ValueChanged<int> onChanged,
  }) {
    return ListTile(
      title: Text(title),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.remove),
            onPressed: value > min
                ? () => onChanged(value - 1)
                : null,
          ),
          Container(
            width: 48,
            alignment: Alignment.center,
            child: Text(
              '$value',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: value < max
                ? () => onChanged(value + 1)
                : null,
          ),
        ],
      ),
    );
  }

  Future<void> _handleClearCache(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('清除缓存'),
        content: const Text(
          '确定要清除所有缓存数据吗?\n\n这将删除:\n• 安装的数据源\n• 下载的漫画\n• 下载的视频\n• 所有下载记录\n• 阅读历史\n• 收藏记录\n• 搜索历史\n\n此操作不可恢复!',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('确定'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    try {
      final storage = ref.read(appStorageProvider).maybeWhen(data: (value) => value, orElse: () => null);
      final historyRepo = ref.read(historyRepositoryProvider);
      final searchHistoryRepo = ref.read(searchHistoryRepositoryProvider);

      if (storage != null) {
        await storage.clearAllCache();
      } else {
        final futures = <Future<bool>>[];
        if (historyRepo != null) {
          futures.add(historyRepo.clear());
        }
        if (searchHistoryRepo != null) {
          futures.add(searchHistoryRepo.clear());
        }
        if (futures.isNotEmpty) {
          await Future.wait(futures);
        }
      }

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('缓存已清除, 应用已恢复到初始状态')),
      );
    } catch (e) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('清除缓存失败: $e')),
      );
    }
  }

  Future<void> _handleClearHistory(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('清除历史'),
        content: const Text('确定要清除所有阅读历史吗?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('确定'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    final historyRepo = ref.read(historyRepositoryProvider);
    if (historyRepo == null) {
      return;
    }

    await historyRepo.clear();

    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('历史记录已清除')),
    );
  }
}

class RadioOption {
  const RadioOption({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;
}
