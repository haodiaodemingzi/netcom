import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/storage/app_storage.dart';
import '../../core/storage/storage_providers.dart';
import '../downloads/download_center_provider.dart';
import '../downloads/download_models.dart';
import 'ebook_models.dart';
import 'ebook_providers.dart';

class EbookDetailPage extends ConsumerStatefulWidget {
  final String bookId;

  const EbookDetailPage({
    super.key,
    required this.bookId,
  });

  @override
  ConsumerState<EbookDetailPage> createState() => _EbookDetailPageState();
}

class _EbookDetailPageState extends ConsumerState<EbookDetailPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(ebookDetailProvider(widget.bookId).notifier).load();
    });
  }

  double _getDownloadProgress(List<EbookChapter> chapters) {
    final downloadState = ref.watch(downloadCenterProvider);
    if (chapters.isEmpty) {
      return 0;
    }
    // 同时统计队列中和已完成的下载任务
    final bookDownloads = [
      ...downloadState.queue.where((item) =>
        item.type == DownloadType.ebook &&
        item.parentId == widget.bookId
      ),
      ...downloadState.completed.where((item) =>
        item.type == DownloadType.ebook &&
        item.parentId == widget.bookId
      ),
    ];
    if (bookDownloads.isEmpty) {
      return 0;
    }
    final completedCount = bookDownloads.where((item) =>
      item.status == DownloadStatus.completed
    ).length;
    return completedCount / chapters.length;
  }

  bool get _isFavorite {
    final favoritesRepo = ref.read(favoritesRepositoryProvider);
    if (favoritesRepo == null) {
      return false;
    }
    return favoritesRepo.isFavorite(widget.bookId);
  }

  Future<void> _toggleFavorite() async {
    final favoritesRepo = ref.read(favoritesRepositoryProvider);
    if (favoritesRepo == null) {
      return;
    }
    
    final state = ref.read(ebookDetailProvider(widget.bookId));
    final detail = state.detail;
    
    if (detail == null) {
      return;
    }

    if (_isFavorite) {
      await favoritesRepo.remove(widget.bookId);
    } else {
      await favoritesRepo.add(FavoriteItem(
        id: widget.bookId,
        title: detail.title,
        cover: detail.cover,
        type: 'ebook',
        source: detail.source,
      ));
    }

    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(ebookDetailProvider(widget.bookId));

    return Scaffold(
      appBar: AppBar(
        title: Text(state.detail?.title ?? '书籍详情'),
      ),
      body: _buildBody(state),
    );
  }

  Widget _buildBody(EbookDetailState state) {
    if (state.loading && state.detail == null) {
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
                ref.read(ebookDetailProvider(widget.bookId).notifier).load();
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
          _buildBookInfo(detail),
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
          _buildSectionTitle('章节列表 (${state.chapters.length}章)'),
          const SizedBox(height: 8),
          _buildChapterList(state.chapters),

          // 下载进度
          if (state.chapters.isNotEmpty) ...[
            const SizedBox(height: 24),
            _buildDownloadProgress(state.chapters),
          ],
        ],
      ),
    );
  }

  Widget _buildBookInfo(EbookDetail detail) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 书籍封面
        Container(
          width: 120,
          height: 160,
          decoration: BoxDecoration(
            color: Colors.grey[300],
            borderRadius: BorderRadius.circular(8),
          ),
          child: detail.cover != null && detail.cover!.isNotEmpty
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: CachedNetworkImage(
                    imageUrl: detail.cover!,
                    width: 120,
                    height: 160,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(
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
                    ),
                    errorWidget: (context, url, error) => Container(
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
                    ),
                  ),
                )
              : const Center(
                  child: Icon(
                    Icons.book_outlined,
                    size: 48,
                    color: Colors.grey,
                  ),
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
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActionButtons(EbookDetail detail, EbookDetailState state) {
    final downloadProgress = _getDownloadProgress(state.chapters);
    final isDownloading = downloadProgress > 0 && downloadProgress < 1;
    
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () {
              if (state.chapters.isNotEmpty) {
                _openEbookReader(state.chapters.first.id, detail.title);
              }
            },
            icon: const Icon(Icons.play_arrow),
            label: const Text('开始阅读'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Stack(
            children: [
              ElevatedButton.icon(
                onPressed: () {
                  if (state.chapters.isNotEmpty && !isDownloading) {
                    _downloadBook(detail, state.chapters);
                  }
                },
                icon: const Icon(Icons.download),
                label: Text(isDownloading ? '下载中...' : '下载整本'),
              ),
              if (isDownloading)
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: LinearProgressIndicator(
                      value: downloadProgress,
                      backgroundColor: Colors.transparent,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Colors.white.withOpacity(0.5),
                      ),
                      minHeight: 4,
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildFavoriteButton(detail),
        ),
      ],
    );
  }

  void _downloadBook(EbookDetail detail, List<EbookChapter> chapters) {
    if (chapters.isEmpty) {
      return;
    }
    // 确保source不为空，使用默认值'ttkan'
    final detailWithSource = detail.source != null && detail.source!.isNotEmpty
        ? detail
        : EbookDetail(
            id: detail.id,
            title: detail.title,
            author: detail.author,
            description: detail.description,
            url: detail.url,
            cover: detail.cover,
            source: 'ttkan',
          );
    final downloadCenter = ref.read(downloadCenterProvider.notifier);
    downloadCenter.enqueueEbookChapters(
      detail: detailWithSource,
      chapters: chapters,
    );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('已添加到下载队列'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Widget _buildFavoriteButton(EbookDetail detail) {
    final isFav = _isFavorite;
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: _toggleFavorite,
        icon: Icon(isFav ? Icons.favorite : Icons.favorite_border),
        label: Text(isFav ? '已收藏' : '收藏'),
        style: ElevatedButton.styleFrom(
          backgroundColor: isFav
              ? Theme.of(context).colorScheme.primary.withOpacity(0.8)
              : null,
        ),
      ),
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

  Widget _buildChapterList(List<EbookChapter> chapters) {
    if (chapters.isEmpty) {
      return const Center(
        child: Text('暂无章节'),
      );
    }

    final colorScheme = Theme.of(context).colorScheme;

    return GridView.builder(
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
        final downloadState = ref.watch(downloadCenterProvider);
        final bookDownloads = downloadState.queue.where((item) =>
          item.type == DownloadType.ebook &&
          item.parentId == widget.bookId
        ).toList();
        final chapterDownload = bookDownloads.cast<DownloadItem?>().firstWhere(
          (item) => item?.resourceId == chapter.id,
          orElse: () => null,
        );

        return Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () {
              _openEbookReader(chapter.id, widget.bookId);
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
                  Row(
                    children: [
                      Text(
                        '第${chapter.order}章',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (chapterDownload != null)
                        Expanded(
                          child: LinearProgressIndicator(
                            value: chapterDownload.progress,
                            backgroundColor: colorScheme.surface,
                            valueColor: AlwaysStoppedAnimation<Color>(colorScheme.primary),
                            minHeight: 4,
                          ),
                        )
                      else if (chapterDownload?.status == DownloadStatus.completed)
                        const Icon(
                          Icons.check_circle,
                          size: 16,
                          color: Colors.green,
                        )
                      else
                        const SizedBox(width: 16),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDownloadProgress(List<EbookChapter> chapters) {
    final downloadState = ref.watch(downloadCenterProvider);
    final bookDownloads = downloadState.queue.where((item) =>
      item.type == DownloadType.ebook &&
      item.parentId == widget.bookId
    ).toList();
    if (bookDownloads.isEmpty) {
      return const SizedBox.shrink();
    }

    final total = chapters.length;
    final completed = bookDownloads.where((item) => item.status == DownloadStatus.completed).length;
    final progress = completed / total;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.download, size: 20),
              const SizedBox(width: 8),
              Text(
                '下载进度',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              Text(
                '$completed/$total章',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: progress,
            backgroundColor: Theme.of(context).colorScheme.surface,
            valueColor: AlwaysStoppedAnimation<Color>(
              Theme.of(context).colorScheme.primary,
            ),
            minHeight: 6,
          ),
        ],
      ),
    );
  }

  void _openEbookReader(String chapterId, String bookTitle) {
    if (chapterId.isEmpty) {
      return;
    }
    context.push('/ebook-reader/$chapterId');
  }
}
