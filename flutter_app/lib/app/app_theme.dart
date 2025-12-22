import 'package:flutter/material.dart';

class AppTheme {
  AppTheme._();

  static const _tweetBlue = Color(0xFF1DA1F2);
  static const _tweetNavy = Color(0xFF0F1419);
  static const _tweetGray = Color(0xFFE6ECF0);
  static const _tweetBg = Color(0xFFF5F8FA);

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: _tweetBlue,
      brightness: Brightness.light,
    ).copyWith(
      background: _tweetBg,
      surface: Colors.white,
      surfaceTint: Colors.white,
      outlineVariant: _tweetGray,
      primary: _tweetBlue,
      onPrimary: Colors.white,
      secondary: const Color(0xFF657786),
      onSurface: _tweetNavy,
    );

    final base = ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      scaffoldBackgroundColor: _tweetBg,
      fontFamily: 'Helvetica Neue',
      textTheme: Typography.blackMountainView.copyWith(
        displaySmall: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.2),
        headlineMedium: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.1),
        titleLarge: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.1),
        titleMedium: const TextStyle(fontWeight: FontWeight.w700),
        labelLarge: const TextStyle(fontWeight: FontWeight.w700),
        bodyLarge: const TextStyle(letterSpacing: -0.1, height: 1.24),
        bodyMedium: const TextStyle(letterSpacing: -0.05, height: 1.24),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: _tweetNavy,
        centerTitle: false,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: _tweetNavy,
          letterSpacing: -0.2,
        ),
        shape: const Border(
          bottom: BorderSide(color: _tweetGray, width: 1),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: _tweetBlue.withOpacity(0.12),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysHide,
        surfaceTintColor: Colors.transparent,
        iconTheme: MaterialStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(MaterialState.selected) ? _tweetBlue : const Color(0xFF536471),
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shadowColor: Colors.black.withOpacity(0.04),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: _tweetGray),
        ),
      ),
      dividerColor: _tweetGray,
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _tweetBlue,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
          elevation: 0,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: _tweetNavy,
          foregroundColor: Colors.white,
          minimumSize: const Size(48, 44),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: _tweetBlue,
          side: BorderSide(color: _tweetBlue.withOpacity(0.4)),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceVariant,
        selectedColor: _tweetBlue.withOpacity(0.12),
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        hintStyle: TextStyle(color: const Color(0xFF536471).withOpacity(0.7)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: _tweetGray),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: _tweetGray),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: _tweetBlue, width: 1.4),
        ),
      ),
    );
    return base.copyWith(
      bottomNavigationBarTheme: base.bottomNavigationBarTheme.copyWith(
        backgroundColor: Colors.white,
        selectedItemColor: _tweetBlue,
        unselectedItemColor: const Color(0xFF536471),
        elevation: 0,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.1),
        unselectedLabelStyle: const TextStyle(letterSpacing: -0.05),
      ),
    );
  }

  static ThemeData get dark {
    final scheme = ColorScheme.fromSeed(
      seedColor: _tweetBlue,
      brightness: Brightness.dark,
    );
    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
    );
  }
}
