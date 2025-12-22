import 'package:flutter/material.dart';

class EbooksPage extends StatelessWidget {
  const EbooksPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const _PlaceholderPage(title: '电子书');
  }
}

class _PlaceholderPage extends StatelessWidget {
  const _PlaceholderPage({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(
          '$title 页面开发中',
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ),
    );
  }
}
