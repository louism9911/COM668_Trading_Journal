"""
Trades Blueprint
=================
"""

from flask import Blueprint, request, jsonify, make_response
from bson import ObjectId
import datetime
import logging

logger = logging.getLogger('tradehub')

try:
    from backend import globals
    from backend.decorators import jwt_required
except ModuleNotFoundError:
    import globals
    from decorators import jwt_required

# Create blueprint
trades_bp = Blueprint("trades", __name__)


@trades_bp.route("/api/v1.0/trades", methods=['GET'])
@jwt_required
def get_all_trades(current_user):
    # Pagination parameters
    page_num = int(request.args.get('pn', 1))
    page_size = int(request.args.get('ps', 10))
    page_start = (page_num - 1) * page_size
    
    # User isolation - filter by user_id
    user_id = str(current_user['_id'])
    
    data_to_return = []
    for trade in globals.trades.find({'user_id': user_id}).skip(page_start).limit(page_size):
        trade['_id'] = str(trade['_id'])
        
        # Convert tag ObjectIds to strings
        if 'tags' in trade:
            for tag in trade['tags']:
                if '_id' in tag and isinstance(tag['_id'], ObjectId):
                    tag['_id'] = str(tag['_id'])
        
        data_to_return.append(trade)
    
    # Return JSON response
    return make_response(jsonify(data_to_return), 200)


@trades_bp.route("/api/v1.0/trades/<string:id>", methods=['GET'])
@jwt_required
def get_one_trade(current_user, id):
    # Validate ObjectId
    try:
        # find_one with user isolation
        trade = globals.trades.find_one({
            '_id': ObjectId(id),
            'user_id': str(current_user['_id'])
        })
    except:
        return make_response(jsonify({'error': 'Invalid trade ID'}), 400)
    
    # Handle not found
    if trade is None:
        return make_response(jsonify({'error': 'Trade not found'}), 404)
    
    # Format response
    trade['_id'] = str(trade['_id'])
    if 'tags' in trade:
        for tag in trade['tags']:
            if '_id' in tag and isinstance(tag['_id'], ObjectId):
                tag['_id'] = str(tag['_id'])
    
    # Return 200 OK
    return make_response(jsonify(trade), 200)


@trades_bp.route("/api/v1.0/trades", methods=['POST'])
@jwt_required
def add_trade(current_user):
    data = request.get_json()
    
    # Validate required fields
    if not data:
        return make_response(jsonify({'error': 'No data provided'}), 400)
    
    required_fields = ['symbol', 'type']
    for field in required_fields:
        if field not in data:
            return make_response(jsonify({'error': f'Missing required field: {field}'}), 400)
    
    # Create trade document
    new_trade = {
        "user_id": str(current_user['_id']),
        "ticket": data.get('ticket', ''),
        "symbol": data['symbol'],
        "type": data['type'],
        "lots": float(data.get('lots', 0)),
        "open_time": globals.normalize_open_time(data.get('open_time', '')),
        "close_time": globals.normalize_open_time(data.get('close_time', '')),
        "open_price": float(data.get('open_price', 0)),
        "close_price": float(data.get('close_price', 0)),
        "commission": float(data.get('commission', 0)),
        "swap": float(data.get('swap', 0)),
        "profit": float(data.get('profit', 0)),
        "sl": float(data.get('sl', 0)),
        "tp": float(data.get('tp', 0)),
        "tags": [],
        "created_at": datetime.datetime.now(datetime.timezone.utc)
    }
    
    # Insert into MongoDB
    result = globals.trades.insert_one(new_trade)
    
    logger.info('TRADE CREATE  user="%s"  symbol="%s"  type="%s"  profit=%s',
                new_trade['user_id'], new_trade['symbol'], new_trade['type'], new_trade['profit'])
    new_trade_link = f"http://localhost:5050/api/v1.0/trades/{str(result.inserted_id)}"
    return make_response(jsonify({
        "url": new_trade_link,
        "trade_id": str(result.inserted_id)
    }), 201)


@trades_bp.route("/api/v1.0/trades/<string:id>", methods=['PUT'])
@jwt_required
def update_trade(current_user, id):

    data = request.get_json()
    
    # Validate input
    if not data:
        return make_response(jsonify({'error': 'No data provided'}), 400)
    
    # Prepare update data
    update_fields = {}
    allowed_fields = ['symbol', 'type', 'lots', 'profit', 'open_price', 'close_price',
                      'open_time', 'close_time', 'commission', 'swap', 'sl', 'tp', 'ticket']
    
    for field in allowed_fields:
        if field in data:
            if field in ['lots', 'profit', 'open_price', 'close_price', 'commission', 'swap', 'sl', 'tp']:
                update_fields[field] = float(data[field])
            elif field in ['open_time', 'close_time']:
                update_fields[field] = globals.normalize_open_time(data[field])
            else:
                update_fields[field] = data[field]
    
    update_fields['updated_at'] = datetime.datetime.now(datetime.timezone.utc)
    
    try:
        # update_one with user isolation
        result = globals.trades.update_one(
            {
                '_id': ObjectId(id),
                'user_id': str(current_user['_id'])
            },
            {'$set': update_fields}
        )
    except:
        return make_response(jsonify({'error': 'Invalid trade ID'}), 400)
    
    # Handle not found
    if result.matched_count == 0:
        return make_response(jsonify({'error': 'Trade not found'}), 404)
    
    trade_link = f"http://localhost:5050/api/v1.0/trades/{id}"
    return make_response(jsonify({
        'url': trade_link,
        'message': 'Trade updated successfully'
    }), 200)


@trades_bp.route("/api/v1.0/trades/<string:id>", methods=['DELETE'])
@jwt_required
def delete_trade(current_user, id):

    try:
        result = globals.trades.delete_one({
            '_id': ObjectId(id),
            'user_id': str(current_user['_id'])
        })
    except:
        return make_response(jsonify({'error': 'Invalid trade ID'}), 400)
    
    # Handle not found
    if result.deleted_count == 0:
        return make_response(jsonify({'error': 'Trade not found'}), 404)
    
    logger.info('TRADE DELETE  trade_id="%s"  user="%s"', id, str(current_user['_id']))
    return make_response(jsonify({}), 204)
