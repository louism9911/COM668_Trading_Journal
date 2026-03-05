"""
News Blueprint
===============
Proxies financial news requests to NewsAPI.
"""

from flask import Blueprint, request, jsonify, make_response
import requests as http_requests

try:
    from backend.decorators import jwt_required
except ModuleNotFoundError:
    from decorators import jwt_required

news_bp = Blueprint('news', __name__)

_NEWS_API_KEY = '080190181aa644c1b48f5361460732d6'
_NEWS_API_URL = 'https://newsapi.org/v2/everything'


_DEFAULT_QUERY = 'forex trading'
_PAGE_SIZE = 100   # NewsAPI free tier maximum


@news_bp.route('/api/v1.0/news', methods=['GET'])
@jwt_required
def get_news(current_user):
    """
    GET /api/v1.0/news?q=XAUUSD
    Returns up to 20 recent English-language articles matching the query.
    """
    query = request.args.get('q', '').strip()
    if not query:
        return make_response(jsonify({'articles': [], 'totalResults': 0, 'query': ''}), 200)

    params = {
        'q':        query,
        'apiKey':   _NEWS_API_KEY,
        'language': 'en',
        'sortBy':   'publishedAt',
        'pageSize': _PAGE_SIZE,
    }

    try:
        resp = http_requests.get(_NEWS_API_URL, params=params, timeout=10)
        data = resp.json()
    except Exception:
        return make_response(jsonify({
            'error': 'Failed to connect to news service. Please try again.'
        }), 502)

    if data.get('status') != 'ok':
        return make_response(jsonify({
            'error': data.get('message', 'NewsAPI returned an error.')
        }), 400)

    # Strip articles with no title or removed articles
    articles = [
        a for a in data.get('articles', [])
        if a.get('title') and a['title'] != '[Removed]'
    ]

    return make_response(jsonify({
        'query':        query,
        'totalResults': data.get('totalResults', 0),
        'articles':     articles,
    }), 200)
