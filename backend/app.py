from flask import Flask
from flask_cors import CORS
from routes.comic import comic_bp
from routes.search import search_bp
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

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True
    )
