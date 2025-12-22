import 'package:flutter/material.dart';

class ComicCard extends StatelessWidget {
  const ComicCard({
    super.key,
    required this.title,
    required this.coverUrl,
    required this.subtitle,
    required this.source,
    this.onTap,
    this.onFavoriteTap,
    this.onDownloadTap,
    this.isFavorite = false,
    this.compact = false,
  });

  final String title;
  final String coverUrl;
  final String subtitle;
  final String source;
  final VoidCallback? onTap;
  final VoidCallback? onFavoriteTap;
  final VoidCallback? onDownloadTap;
  final bool isFavorite;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final image = coverUrl.trim().isEmpty
        ? const Icon(Icons.broken_image_outlined, size: 48)
        : Image.network(
            coverUrl,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined, size: 48),
          );
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 3 / 4,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  color: colorScheme.surfaceVariant,
                  child: image,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              maxLines: compact ? 1 : 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            if (!compact) ...[
              const SizedBox(height: 4),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  IconButton(
                    iconSize: 20,
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      isFavorite ? Icons.favorite : Icons.favorite_border,
                      color: isFavorite ? colorScheme.primary : colorScheme.outline,
                    ),
                    onPressed: onFavoriteTap,
                  ),
                  IconButton(
                    iconSize: 20,
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      Icons.download_rounded,
                      color: colorScheme.outline,
                    ),
                    onPressed: onDownloadTap,
                  ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 2),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
