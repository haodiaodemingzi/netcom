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
  ),
  purple(
    name: '紫色',
    seedColor: Color(0xFF9C27B0),
  ),
  orange(
    name: '橙色',
    seedColor: Color(0xFFFF9800),
  );

  const AppThemeColor({
    required this.name,
    required this.seedColor,
  });

  final String name;
  final Color seedColor;
}
