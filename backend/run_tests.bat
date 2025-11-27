@echo off
echo ========================================
echo 国漫8采集源测试
echo ========================================
echo.

echo 选择测试类型:
echo 1. 测试国漫8采集源 (详细)
echo 2. 测试所有数据源 (快速)
echo 3. 退出
echo.

set /p choice=请输入选择 (1-3): 

if "%choice%"=="1" (
    echo.
    echo 开始测试国漫8采集源...
    echo.
    python test_guoman8.py
) else if "%choice%"=="2" (
    echo.
    echo 开始测试所有数据源...
    echo.
    python test_all_sources.py
) else if "%choice%"=="3" (
    echo 退出测试
    exit
) else (
    echo 无效选择
)

echo.
pause
