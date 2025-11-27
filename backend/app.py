from flask import Flask, jsonify
from flask_cors import CORS
from routes.comic import comic_bp
from routes.search import search_bp
from services.scraper_factory import ScraperFactory
import os

app = Flask(__name__)
CORS(app)

# 注册蓝图
app.register_blueprint(comic_bp, url_prefix='/api')
app.register_blueprint(search_bp, url_prefix='/api')

@app.route('/')
def index():
    return {
        'message': '漫画阅读器 API',
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
        debug=True
    )
