import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_app/features/ebooks/ebooks_provider.dart';
import 'package:flutter_app/features/ebooks/ebooks_models.dart';
import 'package:flutter_app/core/network/image_proxy.dart';

class EbookDetailPage extends ConsumerStatefulWidget {
  final String bookId;
  final String source;

  const EbookDetailPage({
    super.key,
    required this.bookId,
    required this.source,
  });

  @override
  ConsumerState<EbookDetailPage> createState() => _EbookDetailPageState();
}

class _EbookDetailPageState extends ConsumerState<EbookDetailPage> {
  late EbookDetailNotifier _detailNotifier;

  @override
  void initState() {
    super.initState();
    _detailNotifier = ref.read(ebookDetailProvider(widget.bookId).notifier);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _detailNotifier.loadDetail(widget.bookId, widget.source);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(ebookDetailProvider(widget.bookId));

    return Scaffold(
      appBar: AppBar(
        title: Text(state.detail?.title ?? '书籍详情'),
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () {
              // TODO: 实现分享功能
            },
          ),
        ],
      ),
      body: _buildBody(state),
    );
  }

  Widget _buildBody(EbookDetailState state) {
    if (state.isLoading && state.detail == null) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (state.error != null && state.detail == null) {
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
                _detailNotifier.clearError();
                _detailNotifier.loadDetail(widget.bookId, widget.source);
              },
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (state.detail == null) {
      return const Center(
        child: Text('书籍信息不存在'),
      );
    }

    final detail = state.detail!;
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 书籍基本信息
          _buildBookInfo(detail, state),
          const SizedBox(height: 24),
          
          // 操作按钮
          _buildActionButtons(detail, state),
          const SizedBox(height: 24),
          
          // 书籍简介
          if (detail.description.isNotEmpty) ...[
            _buildSectionTitle('简介'),
            const SizedBox(height: 8),
            _buildDescription(detail.description),
            const SizedBox(height: 24),
          ],
          
          // 章节列表
          _buildSectionTitle('章节列表 (${detail.totalChapters}章)'),
          const SizedBox(height: 8),
          _buildChapterList(detail.chapters, state),
        ],
      ),
    );
  }

  Widget _buildBookInfo(EbookDetail detail, EbookDetailState state) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 封面
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(
            detail.cover,
            width: 120,
            height: 160,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                width: 120,
                height: 160,
                color: Colors.grey[300],
                child: const Center(
                  child: Icon(
                    Icons.book_outlined,
                    size: 48,
                    color: Colors.grey,
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(width: 16),
        
        // 书籍信息
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                detail.title,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Text(
                '作者：${detail.author}',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 4),
              Text(
                '状态：${detail.status}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: detail.status == '完结' ? Colors.green : Colors.orange,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '章节数：${detail.totalChapters}',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 4),
              Text(
                '数据源：${detail.source}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActionButtons(EbookDetail detail, EbookDetailState state) {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () {
              if (detail.chapters.isNotEmpty) {
                Navigator.pushNamed(
                  context,
                  '/ebook-reader/${detail.chapters.first.id}',
                  arguments: {
                    'bookId': detail.id,
                    'source': detail.source,
                    'bookTitle': detail.title,
                    'bookCover': detail.cover,
                  },
                );
              }
            },
            icon: const Icon(Icons.play_arrow),
            label: const Text('开始阅读'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: state.isDownloading
                ? null
                : state.isDownloaded
                    ? () {
                        Navigator.pushNamed(
                          context,
                          '/ebook-offline-reader/${detail.id}',
                          arguments: {
                            'bookTitle': detail.title,
                          },
                        );
                      }
                    : () => _detailNotifier.downloadBook(),
            icon: state.isDownloading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : state.isDownloaded
                    ? const Icon(Icons.offline_bolt)
                    : const Icon(Icons.download),
            label: Text(
              state.isDownloading
                  ? '下载中...'
                  : state.isDownloaded
                      ? '离线阅读'
                      : '下载整本',
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.bold,
      ),
    );
  }

  Widget _buildDescription(String description) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        description,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }

  Widget _buildChapterList(List<EbookChapter> chapters, EbookDetailState state) {
    if (chapters.isEmpty) {
      return const Center(
        child: Text('暂无章节'),
      );
    }

    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // 章节排序选项
          Row(
            children: [
              Text(
                '排序：',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              TextButton(
                onPressed: () {
                  // TODO: 实现正序排列
                },
                child: const Text('正序'),
              ),
              TextButton(
                onPressed: () {
                  // TODO: 实现倒序排列
                },
                child: const Text('倒序'),
              ),
              const Spacer(),
              TextButton(
                onPressed: () {
                  // TODO: 实现批量选择
                },
                child: const Text('批量'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          
          // 章节网格布局
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 2.5,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: chapters.length,
            itemBuilder: (context, index) {
              final chapter = chapters[index];
              return Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () {
                    Navigator.pushNamed(
                      context,
                      '/ebook-reader/${chapter.id}',
                      arguments: {
                        'bookId': widget.bookId,
                        'source': widget.source,
                        'bookTitle': state.detail?.title ?? '',
                        'bookCover': state.detail?.cover ?? '',
                      },
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          chapter.title,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '第${chapter.index + 1}章',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.primary,
                          ),
                        ),
                        const Spacer(),
                        Row(
                          children: [
                            const Icon(Icons.menu_book, size: 16, color: Colors.grey),
                            const SizedBox(width: 4),
                            const Icon(Icons.download_outlined, size: 16, color: Colors.grey),
                            const Spacer(),
                            const Icon(Icons.play_arrow, size: 16, color: colorScheme.primary),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
