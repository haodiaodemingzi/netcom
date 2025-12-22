from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import logging
import os
import requests

# 统一日志配置
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from routes.comic import comic_bp
from routes.search import search_bp
from routes.ebook import ebook_bp
from routes.video import video_bp
from routes.market import market_bp
from services.scraper_factory import ScraperFactory
from services.ebook_scraper_factory import EbookScraperFactory

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 注册蓝图
app.register_blueprint(comic_bp, url_prefix='/api')
app.register_blueprint(search_bp, url_prefix='/api')
app.register_blueprint(ebook_bp, url_prefix='/api')
app.register_blueprint(video_bp, url_prefix='/api')
app.register_blueprint(market_bp, url_prefix='/api')

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


@app.route('/api/proxy/image')
def proxy_image():
    url = request.args.get('url', '')
    if not url:
        return jsonify({'error': 'missing url'}), 400
    if not url.startswith('http'):
        return jsonify({'error': 'invalid url'}), 400
    try:
        resp = requests.get(url, timeout=10)
        headers = {
          'Content-Type': resp.headers.get('Content-Type', 'image/jpeg'),
          'Access-Control-Allow-Origin': '*',
        }
        proxy_resp = make_response(resp.content, resp.status_code)
        for k, v in headers.items():
            proxy_resp.headers[k] = v
        return proxy_resp
    except Exception as e:
        logging.exception('image proxy failed')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True,
        use_reloader=False
    )
