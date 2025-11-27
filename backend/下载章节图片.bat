@echo off
chcp 65001 >nul
echo ========================================
echo X漫画章节图片下载器
echo ========================================
echo.

cd /d %~dp0

python test_download_chapter.py

echo.
pause
