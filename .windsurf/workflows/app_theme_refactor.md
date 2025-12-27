
# 多配色主题系统架构设计文档

## 1. 主题配置结构设计

### 1.1. 主题枚举定义

为了方便管理和切换主题，我们首先定义一个枚举 `AppThemeColor`，用于表示所有支持的配色方案。

**文件:** `flutter_app/lib/app/theme/app_theme_color.dart` (新文件)

```dart
import 'package:flutter/material.dart';

enum AppThemeColor {
  blue(
    name: '蓝色',
    seedColor: Color(0xFF1DA1F2),
  ),
  red(
    name: '红色',
    seedColor: Color(0xFFF21D1D),
  ),
  green(
    name: '绿色',
    seedColor: Color(0xFF1DF278),
  );

  const AppThemeColor({
    required this.name,
    required this.seedColor,
  });

  final String name;
  final Color seedColor;
}
```

### 1.2. 配色参数与主题生成

我们将重构现有的 `AppTheme` 类，使其能够根据传入的 `AppThemeColor` 动态生成 `ThemeData`。我们将保留 `light` 和 `dark` 两个静态 getter，但它们内部会调用一个新的静态方法 `_createThemeData`。

**文件:** `flutter_app/lib/app/app_theme.dart` (修改)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_app/app/theme/app_theme_color.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => _createThemeData(AppThemeColor.blue, Brightness.light);
  static ThemeData get dark => _createThemeData(AppThemeColor.blue, Brightness.dark);

  static ThemeData _createThemeData(AppThemeColor themeColor, Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: themeColor.seedColor,
      brightness: brightness,
    );

    // 统一的按钮样式
    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(999));
    const buttonPadding = EdgeInsets.symmetric(horizontal: 16);
    const buttonMinSize = Size.fromHeight(48);

    final base = ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      // ... 其他通用主题配置
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: buttonMinSize,
          padding: buttonPadding,
          shape: buttonShape,
          elevation: 0,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: scheme.primaryContainer,
          foregroundColor: scheme.onPrimaryContainer,
          minimumSize: const Size(48, 44),
          padding: buttonPadding,
          shape: buttonShape,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: scheme.primary,
          side: BorderSide(color: scheme.primary.withOpacity(0.4)),
          padding: buttonPadding,
          shape: buttonShape,
        ),
      ),
    );
    return base;
  }
}
```

## 2. 主题管理器设计

### 2.1. 主题状态管理 (Riverpod)

我们将创建一个 `ThemeProvider` 来管理当前的主题模式（亮/暗）和主题颜色。

**文件:** `flutter_app/lib/app/theme/theme_provider.dart` (新文件)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_app/app/theme/app_theme_color.dart';
import 'package:flutter_app/app/app_theme.dart';

// 主题模式 Provider
final themeModeProvider = StateNotifierProvider<ThemeModeNotifier, ThemeMode>((ref) {
  return ThemeModeNotifier(ref);
});

class ThemeModeNotifier extends StateNotifier<ThemeMode> {
  ThemeModeNotifier(this.ref) : super(ThemeMode.light) {
    _loadThemeMode();
  }

  final Ref ref;
  static const _themeModeKey = 'themeMode';

  void _loadThemeMode() async {
    final prefs = await SharedPreferences.getInstance();
    final themeModeName = prefs.getString(_themeModeKey) ?? ThemeMode.light.name;
    state = ThemeMode.values.firstWhere((e) => e.name == themeModeName);
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    if (state == mode) return;
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeModeKey, mode.name);
  }
}

// 主题颜色 Provider
final themeColorProvider = StateNotifierProvider<ThemeColorNotifier, AppThemeColor>((ref) {
  return ThemeColorNotifier(ref);
});

class ThemeColorNotifier extends StateNotifier<AppThemeColor> {
  ThemeColorNotifier(this.ref) : super(AppThemeColor.blue) {
    _loadThemeColor();
  }

  final Ref ref;
  static const _themeColorKey = 'themeColor';

  void _loadThemeColor() async {
    final prefs = await SharedPreferences.getInstance();
    final themeColorName = prefs.getString(_themeColorKey) ?? AppThemeColor.blue.name;
    state = AppThemeColor.values.firstWhere((e) => e.name == themeColorName);
  }

  Future<void> setThemeColor(AppThemeColor color) async {
    if (state == color) return;
    state = color;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeColorKey, color.name);
  }
}

// 动态主题 Provider
final themeProvider = Provider<ThemeData>((ref) {
  final mode = ref.watch(themeModeProvider);
  final color = ref.watch(themeColorProvider);
  return AppTheme._createThemeData(color, mode == ThemeMode.dark ? Brightness.dark : Brightness.light);
});
```

### 2.2. 主题持久化存储

如上面的代码所示，`ThemeModeNotifier` 和 `ThemeColorNotifier` 内部都使用了 `shared_preferences` 来读取和保存用户的选择。

- `themeMode`: 存储亮/暗模式 (`ThemeMode.light.name` 或 `ThemeMode.dark.name`)
- `themeColor`: 存储主题颜色 (`AppThemeColor.blue.name`, `AppThemeColor.red.name`, etc.)

## 3. 按钮样式设计

在 `AppTheme._createThemeData` 方法中，我们已经统一了 `ElevatedButton`、`FilledButton` 和 `OutlinedButton` 的样式。

- **圆角:** `RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))` 确保所有按钮都是胶囊形状。
- **高度/内边距:** 通过 `minimumSize` 和 `padding` 保证了按钮尺寸的一致性。
- **颜色:** 按钮颜色直接从 `ColorScheme` (`scheme.primary`, `scheme.onPrimary` 等) 获取，确保它们能根据不同的主题颜色动态变化。

## 4. 文件结构设计

### 4.1. 新建文件

- `flutter_app/lib/app/theme/app_theme_color.dart`: 定义主题颜色枚举。
- `flutter_app/lib/app/theme/theme_provider.dart`: 定义 Riverpod providers 用于状态管理。
- `flutter_app/lib/features/settings/theme_setting_page.dart`: (可选) 创建一个新的页面专门用于主题设置。

### 4.2. 修改文件

- `flutter_app/lib/app/app_theme.dart`: 重构 `AppTheme` 类以支持动态主题生成。
- `flutter_app/lib/main.dart`: 在 `MaterialApp` 中使用 `themeProvider`。
- `flutter_app/lib/features/settings/settings_page.dart`: 添加切换主题的 UI 控件。

## 5. 实现步骤规划

1.  **创建 `app_theme_color.dart`:** 定义 `AppThemeColor` 枚举。
2.  **重构 `app_theme.dart`:** 实现 `_createThemeData` 方法，并更新 `light` 和 `dark` 主题的获取方式。
3.  **创建 `theme_provider.dart`:** 实现 `ThemeModeNotifier`, `ThemeColorNotifier`, 和 `themeProvider`。
4.  **修改 `main.dart`:**
    - 将 `MaterialApp` 包装在 `ConsumerWidget` 中。
    - 在 `MaterialApp` 中设置 `theme`, `darkTheme`, 和 `themeMode`。
    ```dart
    // main.dart
    class MyApp extends ConsumerWidget {
      const MyApp({super.key});

      @override
      Widget build(BuildContext context, WidgetRef ref) {
        final themeMode = ref.watch(themeModeProvider);
        final color = ref.watch(themeColorProvider);
        
        return MaterialApp(
          title: 'Flutter App',
          theme: AppTheme._createThemeData(color, Brightness.light),
          darkTheme: AppTheme._createThemeData(color, Brightness.dark),
          themeMode: themeMode,
          home: const MyHomePage(),
        );
      }
    }
    ```
5.  **修改 `settings_page.dart`:**
    - 添加用于切换亮/暗模式的 `SwitchListTile`。
    - 添加用于选择主题颜色的 `RadioListTile` 或 `DropdownButton`。
    - 在回调中调用 `ref.read(themeModeProvider.notifier).setThemeMode(...)` 和 `ref.read(themeColorProvider.notifier).setThemeColor(...)`。

---

请审阅此设计文档。如果满意，我将把此文档保存到 `flutter_app/docs/theme_system_design.md` 并更新待办事项。
