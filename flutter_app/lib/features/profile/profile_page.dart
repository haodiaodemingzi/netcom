import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('我的'),
      ),
      body: ListView(
        children: [
          _buildUserHeader(context),
          const SizedBox(height: 16),
          _buildSection(
            context,
            children: [
              _buildMenuItem(
                context,
                title: '我的收藏',
                icon: Icons.favorite,
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('收藏功能开发中')),
                  );
                },
              ),
              _buildMenuItem(
                context,
                title: '阅读历史',
                icon: Icons.history,
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('历史功能开发中')),
                  );
                },
              ),
              _buildMenuItem(
                context,
                title: '下载管理',
                icon: Icons.download,
                onTap: () => context.push('/downloads'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildSection(
            context,
            children: [
              _buildMenuItem(
                context,
                title: '数据源市场',
                icon: Icons.store,
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('数据源市场开发中')),
                  );
                },
              ),
              _buildMenuItem(
                context,
                title: '设置',
                icon: Icons.settings,
                onTap: () => context.push('/settings'),
              ),
            ],
          ),
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

  Widget _buildSection(BuildContext context, {required List<Widget> children}) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required String title,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
