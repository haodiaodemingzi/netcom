@echo off
echo ========================================
echo 安装Python依赖 (使用豆瓣镜像)
echo ========================================
echo.

py -3 -m pip install -i https://pypi.douban.com/simple -r requirements.txt

echo.
echo ========================================
echo 安装完成！
echo ========================================
pause
