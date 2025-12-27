import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_app/app/theme/app_theme_color.dart';
import 'package:flutter_app/app/app_theme.dart';

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
    state = ThemeMode.values.firstWhere(
      (e) => e.name == themeModeName,
      orElse: () => ThemeMode.light,
    );
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    if (state == mode) return;
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeModeKey, mode.name);
  }
}

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
    state = AppThemeColor.values.firstWhere(
      (e) => e.name == themeColorName,
      orElse: () => AppThemeColor.blue,
    );
  }

  Future<void> setThemeColor(AppThemeColor color) async {
    if (state == color) return;
    state = color;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeColorKey, color.name);
  }
}

final lightThemeProvider = Provider<ThemeData>((ref) {
  final color = ref.watch(themeColorProvider);
  return AppTheme.createThemeData(color, Brightness.light);
});

final darkThemeProvider = Provider<ThemeData>((ref) {
  final color = ref.watch(themeColorProvider);
  return AppTheme.createThemeData(color, Brightness.dark);
});
