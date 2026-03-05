"""
Trade Hub API - Main Application
==================================
"""

import logging
import os
from flask import Flask, jsonify
from blueprints.auth.auth import auth_bp
from blueprints.trades.trades import trades_bp
from blueprints.tags.tags import tags_bp
from blueprints.analytics.analytics import analytics_bp
from blueprints.uploads.uploads import uploads_bp
from blueprints.news.news import news_bp
from flask_cors import CORS

# ─── Logging Setup (FR19) ─────────────────────────────────────────────────────

os.makedirs('logs', exist_ok=True)

logger = logging.getLogger('tradehub')
logger.setLevel(logging.INFO)

_fmt = logging.Formatter('%(asctime)s  %(levelname)-8s  %(message)s',
                          datefmt='%Y-%m-%d %H:%M:%S')

# Write to file
_fh = logging.FileHandler('logs/tradehub.log')
_fh.setFormatter(_fmt)
logger.addHandler(_fh)

# Also print to console
_ch = logging.StreamHandler()
_ch.setFormatter(_fmt)
logger.addHandler(_ch)

# Create Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}},
     allow_headers=["Content-Type", "x-access-token", "Authorization"],
     expose_headers=["x-access-token"])

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(trades_bp)
app.register_blueprint(tags_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(uploads_bp)
app.register_blueprint(news_bp)


# Error handlers
@app.errorhandler(404)
def not_found(error):
    logger.warning('404 Not Found: %s', error)
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error('500 Internal Server Error: %s', error)
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == "__main__":
    app.run(host='127.0.0.1', port=5050, debug=True)
