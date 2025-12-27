import 'package:flutter/material.dart';
import 'package:flutter_app/app/theme/app_theme_color.dart';

class AppTheme {
  AppTheme._();

  static const _tweetNavy = Color(0xFF0F1419);
  static const _tweetGray = Color(0xFFE6ECF0);
  static const _tweetBg = Color(0xFFF5F8FA);

  static ThemeData get light => createThemeData(AppThemeColor.blue, Brightness.light);
  static ThemeData get dark => createThemeData(AppThemeColor.blue, Brightness.dark);

  static ThemeData createThemeData(AppThemeColor themeColor, Brightness brightness) {
    final isLight = brightness == Brightness.light;
    final scheme = ColorScheme.fromSeed(
      seedColor: themeColor.seedColor,
      brightness: brightness,
    ).copyWith(
      background: isLight ? _tweetBg : null,
      surface: isLight ? Colors.white : null,
      surfaceTint: isLight ? Colors.white : null,
      outlineVariant: isLight ? _tweetGray : null,
      onSurface: isLight ? _tweetNavy : null,
    );

    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(999));
    const buttonPadding = EdgeInsets.symmetric(horizontal: 16);
    const buttonMinSize = Size.fromHeight(48);

    final base = ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      scaffoldBackgroundColor: isLight ? _tweetBg : null,
      fontFamily: 'Helvetica Neue',
      textTheme: (isLight ? Typography.blackMountainView : Typography.whiteMountainView).copyWith(
        displaySmall: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.2),
        headlineMedium: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.1),
        titleLarge: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.1),
        titleMedium: const TextStyle(fontWeight: FontWeight.w700),
        labelLarge: const TextStyle(fontWeight: FontWeight.w700),
        bodyLarge: const TextStyle(letterSpacing: -0.1, height: 1.24),
        bodyMedium: const TextStyle(letterSpacing: -0.05, height: 1.24),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: isLight ? Colors.white : null,
        foregroundColor: isLight ? _tweetNavy : null,
        centerTitle: false,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: isLight ? _tweetNavy : null,
          letterSpacing: -0.2,
        ),
        shape: isLight ? const Border(
          bottom: BorderSide(color: _tweetGray, width: 1),
        ) : null,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isLight ? Colors.white : null,
        indicatorColor: scheme.primary.withOpacity(0.12),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysHide,
        surfaceTintColor: Colors.transparent,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected) 
                ? scheme.primary 
                : (isLight ? const Color(0xFF536471) : null),
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: isLight ? Colors.white : null,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shadowColor: Colors.black.withOpacity(0.04),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: isLight ? const BorderSide(color: _tweetGray) : BorderSide.none,
        ),
      ),
      dividerColor: isLight ? _tweetGray : null,
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
      chipTheme: ChipThemeData(
        backgroundColor: isLight ? Colors.white : null,
        selectedColor: scheme.primary,
        labelStyle: TextStyle(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.1,
          color: isLight ? _tweetNavy : null,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
          side: BorderSide(color: scheme.primary.withOpacity(0.25)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isLight ? Colors.white : null,
        hintStyle: TextStyle(color: const Color(0xFF536471).withOpacity(0.7)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: isLight ? const BorderSide(color: _tweetGray) : BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: isLight ? const BorderSide(color: _tweetGray) : BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.primary, width: 1.4),
        ),
      ),
    );
    return base.copyWith(
      bottomNavigationBarTheme: base.bottomNavigationBarTheme.copyWith(
        backgroundColor: isLight ? Colors.white : null,
        selectedItemColor: scheme.primary,
        unselectedItemColor: isLight ? const Color(0xFF536471) : null,
        elevation: 0,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.1),
        unselectedLabelStyle: const TextStyle(letterSpacing: -0.05),
      ),
    );
  }
}
