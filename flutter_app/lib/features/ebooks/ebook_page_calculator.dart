import 'package:flutter/material.dart';

class EbookPageCalculator {
  static List<String> calculatePages({
    required String content,
    required double fontSize,
    required double lineHeight,
    required double pageWidth,
    required double pageHeight,
    required EdgeInsets padding,
  }) {
    if (content.isEmpty) {
      return [];
    }

    final textPainter = TextPainter(
      textDirection: TextDirection.ltr,
      maxLines: null,
    );

    final availableWidth = pageWidth - padding.left - padding.right;
    final availableHeight = pageHeight - padding.top - padding.bottom;

    final textStyle = TextStyle(
      fontSize: fontSize,
      height: lineHeight,
    );

    final paragraphs = content.split('\n');
    final pages = <String>[];
    final currentPageLines = <String>[];
    double currentPageHeight = 0;

    for (final paragraph in paragraphs) {
      if (paragraph.trim().isEmpty) {
        final emptyLineHeight = fontSize * lineHeight;
        if (currentPageHeight + emptyLineHeight > availableHeight) {
          if (currentPageLines.isNotEmpty) {
            pages.add(currentPageLines.join('\n'));
            currentPageLines.clear();
            currentPageHeight = 0;
          }
        }
        currentPageLines.add('');
        currentPageHeight += emptyLineHeight;
        continue;
      }

      textPainter.text = TextSpan(
        text: paragraph,
        style: textStyle,
      );
      textPainter.layout(maxWidth: availableWidth);

      final lines = _breakTextIntoLines(
        paragraph,
        textPainter,
        availableWidth,
        textStyle,
      );

      for (final line in lines) {
        textPainter.text = TextSpan(text: line, style: textStyle);
        textPainter.layout(maxWidth: availableWidth);
        final lineHeight = textPainter.height;

        if (currentPageHeight + lineHeight > availableHeight) {
          if (currentPageLines.isNotEmpty) {
            pages.add(currentPageLines.join('\n'));
            currentPageLines.clear();
            currentPageHeight = 0;
          }
        }

        currentPageLines.add(line);
        currentPageHeight += lineHeight;
      }
    }

    if (currentPageLines.isNotEmpty) {
      pages.add(currentPageLines.join('\n'));
    }

    return pages.isEmpty ? [''] : pages;
  }

  static List<String> _breakTextIntoLines(
    String text,
    TextPainter textPainter,
    double maxWidth,
    TextStyle textStyle,
  ) {
    final lines = <String>[];
    final words = text.split('');
    final currentLine = StringBuffer();

    for (final char in words) {
      final testLine = currentLine.toString() + char;
      textPainter.text = TextSpan(text: testLine, style: textStyle);
      textPainter.layout(maxWidth: maxWidth);

      if (textPainter.width > maxWidth && currentLine.isNotEmpty) {
        lines.add(currentLine.toString());
        currentLine.clear();
        currentLine.write(char);
      } else {
        currentLine.write(char);
      }
    }

    if (currentLine.isNotEmpty) {
      lines.add(currentLine.toString());
    }

    return lines;
  }
}
