"""
从网站获取meta图片（logo）的工具模块
支持获取 og:image, twitter:image, favicon 等
"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import logging

logger = logging.getLogger(__name__)


def get_meta_image(url, timeout=10):
    """
    从网站获取meta图片URL
    
    Args:
        url: 网站URL
        timeout: 请求超时时间（秒）
    
    Returns:
        str: 图片URL，如果获取失败返回None
    """
    if not url:
        return None
    
    try:
        # 确保URL有协议
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        headers = {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/120.0.0.0 Safari/537.36'
            ),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
        
        response = requests.get(url, headers=headers, timeout=timeout, verify=True)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 优先级顺序：og:image > twitter:image > apple-touch-icon > favicon > link[rel="icon"]
        image_url = None
        
        # 1. 尝试获取 og:image
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            image_url = og_image.get('content')
            logger.info(f"找到 og:image: {image_url}")
        
        # 2. 尝试获取 twitter:image
        if not image_url:
            twitter_image = soup.find('meta', attrs={'name': 'twitter:image'})
            if twitter_image and twitter_image.get('content'):
                image_url = twitter_image.get('content')
                logger.info(f"找到 twitter:image: {image_url}")
        
        # 3. 尝试获取 apple-touch-icon
        if not image_url:
            apple_icon = soup.find('link', rel='apple-touch-icon')
            if apple_icon and apple_icon.get('href'):
                image_url = apple_icon.get('href')
                logger.info(f"找到 apple-touch-icon: {image_url}")
        
        # 4. 尝试获取 favicon
        if not image_url:
            favicon = soup.find('link', rel='icon') or soup.find('link', rel='shortcut icon')
            if favicon and favicon.get('href'):
                image_url = favicon.get('href')
                logger.info(f"找到 favicon: {image_url}")
        
        # 5. 尝试获取其他icon链接
        if not image_url:
            icon_links = soup.find_all('link', rel=lambda x: x and 'icon' in x.lower())
            for link in icon_links:
                if link.get('href'):
                    image_url = link.get('href')
                    logger.info(f"找到其他icon: {image_url}")
                    break
        
        # 如果找到了图片URL，需要转换为绝对URL
        if image_url:
            # 如果是相对路径，转换为绝对路径
            if not image_url.startswith(('http://', 'https://', '//')):
                image_url = urljoin(url, image_url)
            elif image_url.startswith('//'):
                # 处理协议相对URL
                parsed = urlparse(url)
                image_url = f"{parsed.scheme}:{image_url}"
            
            # 验证图片URL是否有效（可选，可能会增加延迟）
            # 这里先不验证，直接返回
            
            return image_url
        
        logger.warning(f"未找到图片URL: {url}")
        return None
        
    except requests.exceptions.RequestException as e:
        logger.error(f"请求网站失败 {url}: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"解析网站meta信息失败 {url}: {str(e)}")
        return None

