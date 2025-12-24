import 'package:flutter/material.dart';

import '../core/network/image_proxy.dart';

class VideoCard extends StatelessWidget {
  const VideoCard({
    super.key,
    required this.title,
    required this.coverUrl,
    required this.subtitle,
    required this.source,
    this.onTap,
    this.compact = false,
    this.rating,
    this.extra,
  });

  final String title;
  final String coverUrl;
  final String subtitle;
  final String source;
  final VoidCallback? onTap;
  final bool compact;
  final double? rating;
  final String? extra;

  @override
  Widget build(BuildContext context) {
    final rawUrl = coverUrl.trim();
    final fallbackUrl = proxyImageUrl(rawUrl, useProxy: true);
    final image = rawUrl.isEmpty
        ? const Icon(Icons.broken_image_outlined, size: 48)
        : _buildCover(rawUrl, fallbackUrl);
    final colorScheme = Theme.of(context).colorScheme;
    final badge = rating != null && rating! > 0
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.star, color: Colors.amber, size: 12),
              const SizedBox(width: 2),
              Text(
                rating!.toStringAsFixed(1),
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ],
          )
        : null;
    return Material(
      color: Colors.white,
      elevation: compact ? 1 : 2,
      shadowColor: Colors.black12,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: AspectRatio(
          aspectRatio: 3 / 4,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  color: colorScheme.surfaceVariant,
                  child: image,
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(8, 32, 8, 8),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withOpacity(0.85),
                        ],
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.85),
                            fontSize: 10,
                          ),
                        ),
                        if (extra != null && extra!.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            extra!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.amber,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                Positioned(
                  top: 8,
                  left: 8,
                  child: Transform.rotate(
                    angle: -0.1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.amber,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        source,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ),
                ),
                if (badge != null)
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: badge,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
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
}
