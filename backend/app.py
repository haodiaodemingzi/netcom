from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import os

# 统一日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from routes.comic import comic_bp
from routes.search import search_bp
from routes.ebook import ebook_bp
from routes.video import video_bhttps://www.huanting.cc/p
from routes.market import market_bp
from routes.podcast import podcast_bp
from services.scraper_factory import ScraperFactory
from services.ebook_scraper_factory import EbookScraperFactory

app = Flask(__name__)
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*')
CORS(app, resources={r"/api/*": {"origins": "*"}})


def _resolve_origin(request_origin: str | None) -> str:
    if not request_origin:
        return '*'
    allowed = ALLOWED_ORIGINS.strip()
    if allowed == '*' or not allowed:
        return request_origin
    splitted = {item.strip() for item in allowed.split(',') if item.strip()}
    return request_origin if request_origin in splitted else splitted.pop() if splitted else '*'


@app.after_request
def apply_cors_headers(response):
    origin = request.headers.get('Origin')
    response.headers['Access-Control-Allow-Origin'] = _resolve_origin(origin)
    response.headers.setdefault('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.setdefault('Access-Control-Allow-Headers', 'Authorization,Content-Type')
    response.headers.setdefault('Access-Control-Allow-Credentials', 'true')
    response.headers['Vary'] = 'Origin'
    return response

# 注册蓝图
app.register_blueprint(comic_bp, url_prefix='/api')
app.register_blueprint(search_bp, url_prefix='/api')
app.register_blueprint(ebook_bp, url_prefix='/api')
app.register_blueprint(video_bp, url_prefix='/api')
app.register_blueprint(market_bp, url_prefix='/api')
app.register_blueprint(podcast_bp, url_prefix='/api')

@app.route('/')
def index():
    return {
        'message': '漫画与电子书阅读器 API',
        'version': '1.0.0',
        'status': 'running'
    }

@app.route('/health')
def health():
    return {'status': 'healthy'}

@app.route('/api/sources')
def get_sources():
    """获取所有可用的数据源"""
    try:
        sources = ScraperFactory.get_available_sources()
        return jsonify(sources), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True,
        use_reloader=False
    )
