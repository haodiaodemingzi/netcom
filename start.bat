@echo off
echo 启动漫画阅读器...
echo.
echo 正在启动前端开发服务器...
start cmd /k "npm start"
echo.
echo 等待5秒后启动后端服务...
timeout /t 5 /nobreak
echo.
echo 正在启动后端API服务...
start cmd /k "cd backend && python app.py"
echo.
echo 所有服务已启动!
echo 前端: http://localhost:8081
echo 后端: http://localhost:5000
pause
