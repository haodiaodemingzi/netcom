#!/bin/bash

# 漫画阅读器后端一键安装脚本
# 支持Ubuntu/Debian/CentOS

set -e

echo "========================================="
echo "  漫画阅读器后端一键安装脚本"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        echo -e "${RED}无法检测操作系统${NC}"
        exit 1
    fi
    echo -e "${GREEN}检测到操作系统: $OS $VER${NC}"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        echo -e "${YELLOW}建议使用root权限运行此脚本${NC}"
        echo "请使用: sudo bash install.sh"
        read -p "是否继续? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 安装Python3
install_python() {
    echo -e "${GREEN}[1/5] 检查Python3...${NC}"
    
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | awk '{print $2}')
        echo "Python3 已安装: $PYTHON_VERSION"
    else
        echo "正在安装Python3..."
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            apt-get update
            apt-get install -y python3 python3-pip python3-venv
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
            yum install -y python3 python3-pip
        else
            echo -e "${RED}不支持的操作系统${NC}"
            exit 1
        fi
    fi
}

# 创建虚拟环境
create_venv() {
    echo -e "${GREEN}[2/5] 创建Python虚拟环境...${NC}"
    
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        echo "虚拟环境创建成功"
    else
        echo "虚拟环境已存在"
    fi
}

# 安装依赖
install_dependencies() {
    echo -e "${GREEN}[3/5] 安装Python依赖包...${NC}"
    
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    echo "依赖安装完成"
}

# 配置环境变量
setup_env() {
    echo -e "${GREEN}[4/5] 配置环境变量...${NC}"
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "已创建.env配置文件"
        echo "请编辑.env文件配置您的代理等信息"
    else
        echo ".env文件已存在"
    fi
}

# 创建系统服务
create_service() {
    echo -e "${GREEN}[5/5] 创建系统服务...${NC}"
    
    read -p "是否创建systemd服务以开机自启? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        WORK_DIR=$(pwd)
        SERVICE_FILE="/etc/systemd/system/comic-backend.service"
        
        cat > $SERVICE_FILE <<EOF
[Unit]
Description=Comic Reader Backend Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORK_DIR
Environment="PATH=$WORK_DIR/venv/bin"
ExecStart=$WORK_DIR/venv/bin/python app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable comic-backend
        echo "系统服务已创建"
        echo "使用以下命令管理服务:"
        echo "  启动: sudo systemctl start comic-backend"
        echo "  停止: sudo systemctl stop comic-backend"
        echo "  状态: sudo systemctl status comic-backend"
        echo "  日志: sudo journalctl -u comic-backend -f"
    fi
}

# 启动服务
start_service() {
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}  安装完成！${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    
    read -p "是否现在启动服务? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "/etc/systemd/system/comic-backend.service" ]; then
            systemctl start comic-backend
            echo "服务已启动"
            systemctl status comic-backend --no-pager
        else
            source venv/bin/activate
            echo "正在启动..."
            nohup python app.py > comic.log 2>&1 &
            echo "服务已在后台启动，日志: comic.log"
        fi
        
        echo ""
        echo "后端API地址: http://localhost:5000"
        echo "测试API: curl http://localhost:5000/api/sources"
    fi
}

# 主函数
main() {
    detect_os
    check_root
    install_python
    create_venv
    install_dependencies
    setup_env
    create_service
    start_service
    
    echo ""
    echo -e "${GREEN}全部完成！${NC}"
    echo "后续可以编辑 .env 文件配置代理等信息"
}

# 运行主函数
main
