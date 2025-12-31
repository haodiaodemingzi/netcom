import 'package:flutter/material.dart';

import '../core/network/image_proxy.dart';

class PodcastCard extends StatelessWidget {
  const PodcastCard({
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
    if (compact) {
      return _buildCompactCard(context);
    }
    return _buildGridCard(context);
  }

  Widget _buildCompactCard(BuildContext context) {
    final rawUrl = coverUrl.trim();
    final fallbackUrl = proxyImageUrl(rawUrl, useProxy: true);
    final image = rawUrl.isEmpty
        ? const Icon(Icons.podcasts, size: 48)
        : _buildCover(rawUrl, fallbackUrl);
    final colorScheme = Theme.of(context).colorScheme;

    return Material(
      color: Colors.white,
      elevation: 1,
      shadowColor: Colors.black12,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          height: 120,
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  width: 80,
                  height: 96,
                  color: colorScheme.surfaceVariant,
                  child: image,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (extra != null && extra!.isNotEmpty)
                          Text(
                            extra!,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            source,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Colors.blue,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: Colors.grey[400],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGridCard(BuildContext context) {
    final rawUrl = coverUrl.trim();
    final fallbackUrl = proxyImageUrl(rawUrl, useProxy: true);
    final image = rawUrl.isEmpty
        ? const Icon(Icons.podcasts, size: 48)
        : _buildCover(rawUrl, fallbackUrl);
    final colorScheme = Theme.of(context).colorScheme;

    return Material(
      color: Colors.white,
      elevation: 2,
      shadowColor: Colors.black12,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: AspectRatio(
          aspectRatio: 1,
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
                              color: Colors.blue,
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
                        color: Colors.blue,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        source,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
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
        return const Icon(Icons.podcasts, size: 48);
      }
      return Image.network(
        fallbackUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Icon(Icons.podcasts, size: 48),
      );
    },
  );
}
