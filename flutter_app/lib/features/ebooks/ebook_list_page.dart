import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class EbookListPage extends ConsumerWidget {
  const EbookListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('电子书'),
      ),
      body: const Center(
        child: Text('电子书列表页面'),
      ),
    );
  }
}
