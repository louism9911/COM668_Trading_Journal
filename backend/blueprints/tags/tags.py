"""
Tags Blueprint
===============
"""

from flask import Blueprint, request, jsonify, make_response
from bson import ObjectId
import datetime

try:
    from backend import globals
    from backend.decorators import jwt_required
except ModuleNotFoundError:
    import globals
    from decorators import jwt_required

# Create blueprint
tags_bp = Blueprint('tags', __name__)


@tags_bp.route("/api/v1.0/trades/<string:id>/tags", methods=['GET'])
@jwt_required
def get_all_tags(current_user, id):
    try:
        # Find trade with user isolation
        trade = globals.trades.find_one(
            {
                '_id': ObjectId(id),
                'user_id': str(current_user['_id'])
            },
            {'tags': 1, '_id': 0}  
        )
    except:
        return make_response(jsonify({'error': 'Invalid trade ID'}), 400)
    
    if not trade or 'tags' not in trade:
        return make_response(jsonify({'error': 'Trade not found'}), 404)
    
    # Format tags
    data_to_return = []
    for tag in trade['tags']:
        if '_id' in tag and isinstance(tag['_id'], ObjectId):
            tag['_id'] = str(tag['_id'])
        data_to_return.append(tag)
    
    return make_response(jsonify(data_to_return), 200)


@tags_bp.route("/api/v1.0/trades/<string:id>/tags/<string:tag_id>", methods=['GET'])
@jwt_required
def get_one_tag(current_user, id, tag_id):
    try:
        trade = globals.trades.find_one(
            {
                '_id': ObjectId(id),
                'user_id': str(current_user['_id']),
                'tags._id': ObjectId(tag_id)
            },
            {'_id': 0, 'tags.$': 1} 
        )
    except:
        return make_response(jsonify({'error': 'Invalid ID'}), 400)
    
    if not trade or 'tags' not in trade:
        return make_response(jsonify({'error': 'Tag not found'}), 404)
    
    tag = trade['tags'][0]
    if '_id' in tag and isinstance(tag['_id'], ObjectId):
        tag['_id'] = str(tag['_id'])
    
    return make_response(jsonify(tag), 200)


@tags_bp.route("/api/v1.0/trades/<string:id>/tags", methods=['POST'])
@jwt_required
def add_tag(current_user, id):

    data = request.get_json()
    
    # Validate input
    if not data:
        return make_response(jsonify({'error': 'No data provided'}), 400)
    
    # Create new tag sub-document
    new_tag = {
        "_id": ObjectId(),
        "strategy": data.get("strategy", ""),
        "entry_type": data.get("entry_type", ""),
        "emotional_state": data.get("emotional_state", ""),
        "notes": data.get("notes", ""),
        "created_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y.%m.%d %H:%M:%S")
    }
    
    try:
        # $push to add tag to array
        result = globals.trades.update_one(
            {
                '_id': ObjectId(id),
                'user_id': str(current_user['_id'])
            },
            {'$push': {'tags': new_tag}}
        )
    except:
        return make_response(jsonify({'error': 'Invalid trade ID'}), 400)
    
    if result.matched_count == 0:
        return make_response(jsonify({'error': 'Trade not found'}), 404)
    
    # Return 201 Created
    tag_link = f"http://localhost:5050/api/v1.0/trades/{id}/tags/{str(new_tag['_id'])}"
    return make_response(jsonify({
        'url': tag_link,
        'tag_id': str(new_tag['_id'])
    }), 201)


@tags_bp.route("/api/v1.0/trades/<string:t_id>/tags/<string:tag_id>", methods=['PUT'])
@jwt_required
def update_tag(current_user, t_id, tag_id):

    data = request.get_json()
    
    if not data:
        return make_response(jsonify({'error': 'No data provided'}), 400)
    
    edited_tag = {}
    
    if 'strategy' in data:
        edited_tag['tags.$.strategy'] = data['strategy']
    if 'entry_type' in data:
        edited_tag['tags.$.entry_type'] = data['entry_type']
    if 'emotional_state' in data:
        edited_tag['tags.$.emotional_state'] = data['emotional_state']
    if 'notes' in data:
        edited_tag['tags.$.notes'] = data['notes']
    
    edited_tag['tags.$.updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y.%m.%d %H:%M:%S")
    
    try:
        result = globals.trades.update_one(
            {
                '_id': ObjectId(t_id),
                'user_id': str(current_user['_id']),
                'tags._id': ObjectId(tag_id)
            },
            {'$set': edited_tag}
        )
    except:
        return make_response(jsonify({'error': 'Invalid ID'}), 400)
    
    if result.matched_count == 0:
        return make_response(jsonify({'error': 'Tag not found'}), 404)
    
    # Return 200 OK
    tag_url = f"http://localhost:5050/api/v1.0/trades/{t_id}/tags/{tag_id}"
    return make_response(jsonify({'url': tag_url}), 200)


@tags_bp.route("/api/v1.0/trades/<string:t_id>/tags/<string:tag_id>", methods=['DELETE'])
@jwt_required
def delete_tag(current_user, t_id, tag_id):
    try:
        # $pull to remove from array
        result = globals.trades.update_one(
            {
                '_id': ObjectId(t_id),
                'user_id': str(current_user['_id'])
            },
            {'$pull': {'tags': {'_id': ObjectId(tag_id)}}}
        )
    except:
        return make_response(jsonify({'error': 'Invalid ID'}), 400)
    
    if result.matched_count == 0:
        return make_response(jsonify({'error': 'Trade not found'}), 404)
    
    # Return 204 No Content
    return make_response(jsonify({}), 204)
