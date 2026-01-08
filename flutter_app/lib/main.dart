import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart' show debugPrint;

import 'app/app_router.dart';
import 'app/theme/theme_provider.dart';

void main() {
  // 过滤Android视频解码日志
  debugPrint = (String? message, {int? wrapWidth}) {
    if (message != null &&
        (message.contains('CCodec') ||
            message.contains('MediaCodec') ||
            message.contains('BufferPool') ||
            message.contains('PesReader') ||
            message.contains('ColorUtils') ||
            message.contains('SurfaceUtils') ||
            message.contains('codec2'))) {
      return;
    }
    // 默认日志输出
    print(message);
  };

  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: AppRoot()));
}

class AppRoot extends ConsumerWidget {
  const AppRoot({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.read(appRouterProvider);
    final themeMode = ref.watch(themeModeProvider);
    final lightTheme = ref.watch(lightThemeProvider);
    final darkTheme = ref.watch(darkThemeProvider);
    
    return MaterialApp.router(
      title: 'Netcom',
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
