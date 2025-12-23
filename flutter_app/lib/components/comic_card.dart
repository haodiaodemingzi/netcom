import 'package:flutter/material.dart';

import '../core/network/image_proxy.dart';

class ComicCard extends StatelessWidget {
  const ComicCard({
    super.key,
    required this.title,
    required this.coverUrl,
    required this.subtitle,
    required this.source,
    this.onTap,
    this.compact = false,
    this.extra,
  });

  final String title;
  final String coverUrl;
  final String subtitle;
  final String source;
  final VoidCallback? onTap;
  final bool compact;
  final String? extra;

  @override
  Widget build(BuildContext context) {
    final rawUrl = coverUrl.trim();
    final fallbackUrl = proxyImageUrl(rawUrl, useProxy: true);
    final image = rawUrl.isEmpty
        ? const Icon(Icons.broken_image_outlined, size: 48)
        : _buildCover(rawUrl, fallbackUrl);
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: Colors.white,
      elevation: compact ? 1 : 2,
      shadowColor: Colors.black12,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AspectRatio(
                  aspectRatio: 3 / 4,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      color: colorScheme.surfaceVariant,
                      child: image,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                maxLines: compact ? 1 : 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle.isEmpty ? source : subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(color: colorScheme.onSurface.withOpacity(0.72)),
              ),
              if (extra != null && extra!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  extra!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colorScheme.primary, fontWeight: FontWeight.w700),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

Widget _buildCover(String url, String fallbackUrl) {
  return Image.network(
    url,
    fit: BoxFit.cover,
    errorBuilder: (context, error, stackTrace) {
      if (url == fallbackUrl) {
        return const Icon(Icons.broken_image_outlined, size: 48);
      }
      return Image.network(
        fallbackUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined, size: 48),
      );
    },
  );
}
