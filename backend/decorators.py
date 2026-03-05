"""
Decorators - JWT Authentication
=================================
"""

from flask import request, jsonify, make_response
from bson import ObjectId
import jwt
from functools import wraps

try:
    from backend import globals
except ModuleNotFoundError:
    import globals

def jwt_required(func):
    @wraps(func)
    def jwt_required_wrapper(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        
        if not token:
            return make_response(jsonify({'message': 'Token is missing'}), 401)
        
        # Check blacklist
        if globals.blacklist.find_one({'token': token}):
            return make_response(jsonify({'message': 'Token has been revoked'}), 401)
        
        try:
            # Decode token
            data = jwt.decode(token, globals.SECRET_KEY, algorithms=["HS256"])
            current_user = globals.users.find_one({'_id': ObjectId(data['user_id'])})
            
            if current_user is None:
                return make_response(jsonify({'message': 'Invalid token'}), 401)
        except jwt.ExpiredSignatureError:
            return make_response(jsonify({'message': 'Token has expired'}), 401)
        except jwt.InvalidTokenError:
            return make_response(jsonify({'message': 'Invalid token'}), 401)
        except Exception:
            return make_response(jsonify({'message': 'Token validation failed'}), 401)
        
        # Pass current_user to decorated function
        return func(current_user=current_user, *args, **kwargs)
    
    return jwt_required_wrapper


def admin_required(func):
    @wraps(func)
    def admin_required_wrapper(*args, **kwargs):
        token = None
        
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        
        if not token:
            return make_response(jsonify({'message': 'Token is missing'}), 401)
        
        if globals.blacklist.find_one({'token': token}):
            return make_response(jsonify({'message': 'Token has been revoked'}), 401)
        
        try:
            data = jwt.decode(token, globals.SECRET_KEY, algorithms=["HS256"])
            current_user = globals.users.find_one({'_id': ObjectId(data['user_id'])})
            
            if current_user is None:
                return make_response(jsonify({'message': 'Invalid token'}), 401)
            
            # Check admin status
            if not current_user.get('admin', False):
                return make_response(jsonify({'message': 'Admin access required'}), 403)
                
        except Exception:
            return make_response(jsonify({'message': 'Token validation failed'}), 401)
        
        return func(current_user=current_user, *args, **kwargs)
    
    return admin_required_wrapper
