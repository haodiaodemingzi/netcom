import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/downloads/downloads_page.dart';
import '../features/profile/history_page.dart';
import '../features/profile/profile_page.dart';
import '../features/profile/favorites_page.dart';
import '../features/videos/videos_page.dart';
import '../features/videos/video_detail_page.dart';
import '../features/videos/video_player_page.dart';
import '../features/videos/video_models.dart';
import 'package:video_player/video_player.dart';
import '../features/videos/videos_provider.dart';
import '../features/comics/comic_detail_page.dart';
import '../features/comics/comic_reader_page.dart';
import '../features/comics/comics_page.dart';
import '../features/comics/comics_provider.dart';
import '../features/settings/settings_page.dart';
import '../features/ebooks/ebooks_page.dart';
import '../features/ebooks/ebook_detail_page.dart';
import '../features/ebooks/ebook_reader_page.dart';
import '../features/ebooks/ebook_offline_reader_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final navigatorKey = GlobalKey<NavigatorState>();
  return GoRouter(
    navigatorKey: navigatorKey,
    initialLocation: '/tabs/comics',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AppShell(shell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tabs/comics',
                name: 'comics',
                builder: (context, state) => const ComicsPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tabs/videos',
                name: 'videos',
                builder: (context, state) => const VideosPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tabs/ebooks',
                name: 'ebooks',
                builder: (context, state) => const EbooksPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tabs/profile',
                name: 'profile',
                builder: (context, state) => const ProfilePage(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/downloads',
        name: 'downloads',
        builder: (context, state) => const DownloadsPage(),
      ),
      GoRoute(
        path: '/favorites',
        name: 'favorites',
        builder: (context, state) => const FavoritesPage(),
      ),
      GoRoute(
        path: '/history',
        name: 'history',
        builder: (context, state) => const HistoryPage(),
      ),
      GoRoute(
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsPage(),
      ),
      GoRoute(
        path: '/comic/:id',
        name: 'comicDetail',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return ComicDetailPage(comicId: id);
        },
      ),
      GoRoute(
        path: '/comic/:id/read',
        name: 'comicReader',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          final args = state.extra;
          if (args is! ComicReaderArgs) {
            return const ComicReaderPage.fallback();
          }
          return ComicReaderPage(
            comicId: id,
            args: args,
          );
        },
      ),
      GoRoute(
        path: '/videos/:id',
        name: 'videoDetail',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          final extra = state.extra as Map<String, dynamic>?;
          final source = extra?['source'] as String?;
          return VideoDetailPage(videoId: id, source: source);
        },
      ),
      GoRoute(
        path: '/video-player',
        name: 'videoPlayer',
        parentNavigatorKey: navigatorKey,
        pageBuilder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          final videoId = (extra?['videoId'] as String?) ?? '';
          final episodeId = (extra?['episodeId'] as String?) ?? '';
          final source = extra?['source'] as String?;
          final episodes = (extra?['episodes'] as List<VideoEpisode>?) ?? const <VideoEpisode>[];
          final coverUrl = extra?['coverUrl'] as String?;
          final localPaths = (extra?['localPaths'] as Map<String, String>?) ?? const <String, String>{};
          final fullscreen = extra?['fullscreen'] as bool? ?? false;
          final controller = extra?['controller'] as VideoPlayerController?;
          return CustomTransitionPage(
            key: state.pageKey,
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              const begin = Offset(0.0, 1.0);
              const end = Offset.zero;
              const curve = Curves.easeInOut;
              final tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
              final offsetAnimation = animation.drive(tween);
              return SlideTransition(
                position: offsetAnimation,
                child: child,
              );
            },
            child: VideoPlayerPage(
              videoId: videoId,
              episodeId: episodeId,
              episodes: episodes,
              source: source,
              coverUrl: coverUrl,
              localPaths: localPaths,
              fullscreen: fullscreen,
              initialController: controller,
            ),
          );
        },
      ),
      GoRoute(
        path: '/ebooks/:id',
        name: 'ebookDetail',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return EbookDetailPage(bookId: id);
        },
      ),
      GoRoute(
        path: '/ebook-reader/:chapterId',
        name: 'ebookReader',
        builder: (context, state) {
          final chapterId = state.pathParameters['chapterId'] ?? '';
          return EbookReaderPage(chapterId: chapterId);
        },
      ),
      GoRoute(
        path: '/ebook-offline-reader/:bookId',
        name: 'ebookOfflineReader',
        builder: (context, state) {
          final bookId = state.pathParameters['bookId'] ?? '';
          final extra = state.extra as Map<String, dynamic>?;
          final bookTitle = extra?['bookTitle'] as String? ?? '';
          return EbookOfflineReaderPage(
            bookId: bookId,
            bookTitle: bookTitle,
          );
        },
      ),
    ],
  );
});

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  Future<void> _onTap(WidgetRef ref, int index) async {
    if (index == shell.currentIndex) {
      return;
    }
    shell.goBranch(index, initialLocation: index == shell.currentIndex);
    // 异步预热，避免阻塞切换，页面自行显示加载态
    Future.microtask(() {
      if (index == 0) {
        ref.read(comicsProvider.notifier).ensureWarm();
      } else if (index == 1) {
        ref.read(videosProvider.notifier).ensureWarm();
      } else if (index == 2) {
        // 电子书页面预热（后续可补充 ensureWarm）
      }
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        height: 56,
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (index) => _onTap(ref, index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.book_outlined), selectedIcon: Icon(Icons.book), label: '漫画'),
          NavigationDestination(icon: Icon(Icons.movie_outlined), selectedIcon: Icon(Icons.movie), label: '视频'),
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), selectedIcon: Icon(Icons.menu_book), label: '电子书'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: '我的'),
        ],
      ),
    );
  }
}
