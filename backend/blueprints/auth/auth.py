"""
Authentication Blueprint
=========================
"""

from flask import Blueprint, request, jsonify, make_response
import jwt
import datetime
import bcrypt
import logging
from bson import ObjectId

logger = logging.getLogger('tradehub')

try:
    from backend import globals
    from backend.decorators import jwt_required, admin_required
except ModuleNotFoundError:
    import globals
    from decorators import jwt_required, admin_required

# Create blueprint
auth_bp = Blueprint('auth', __name__)
users = globals.users


@auth_bp.route("/api/v1.0/register", methods=['POST'])
def register():
    # Validate input
    data = request.get_json()
    
    if not data:
        return make_response(jsonify({'error': 'No data provided'}), 400)
    
    if 'username' not in data or 'password' not in data:
        return make_response(jsonify({'error': 'Username and password required'}), 400)
    
    username = data['username']
    password = data['password']
    
    # Check if username exists
    if globals.users.find_one({'username': username}):
        return make_response(jsonify({'error': 'Username already exists'}), 409)
    
    # Hash password with bcrypt
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Insert new user
    new_user = {
        'username': username,
        'password': hashed_password,
        'admin': False,
        'created_at': datetime.datetime.now(datetime.timezone.utc)
    }
    result = globals.users.insert_one(new_user)
    logger.info('REGISTER  user="%s"', username)
    return make_response(jsonify({
        'message': 'User registered successfully',
        'user_id': str(result.inserted_id)
    }), 201)


@auth_bp.route('/api/v1.0/login', methods=['GET'])
def login():
    # Get Basic Auth credentials
    auth = request.authorization
    
    if not auth:
        return make_response(jsonify({'message': 'Authentication required'}), 401)
    
    # Find user by username
    user = globals.users.find_one({'username': auth.username})
    
    if user is None:
        logger.warning('LOGIN FAIL  user="%s"  reason="unknown username"', auth.username)
        return make_response(jsonify({'message': 'Bad username'}), 401)

    # Verify password with bcrypt
    if not bcrypt.checkpw(auth.password.encode('utf-8'), user['password']):
        logger.warning('LOGIN FAIL  user="%s"  reason="wrong password"', auth.username)
        return make_response(jsonify({'message': 'Bad password'}), 401)
    
    # Generate JWT token
    token = jwt.encode({
        'user_id': str(user['_id']),
        'username': user['username'],
        'admin': user.get('admin', False),
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=30)
    }, globals.SECRET_KEY, algorithm="HS256")

    logger.info('LOGIN  user="%s"', user['username'])
    return make_response(jsonify({
        'token': token,
        'username': user['username'],
        'user_id': str(user['_id']),
        'admin': user.get('admin', False)
    }), 200)


@auth_bp.route("/api/v1.0/logout", methods=['GET'])
def logout():
    token = None

    # Get token from headers
    if 'x-access-token' in request.headers:
        token = request.headers['x-access-token']
    
    if not token:
        return make_response(jsonify({'message': 'Token is missing'}), 401)

    try:
        # Validate token
        decoded = jwt.decode(token, globals.SECRET_KEY, algorithms=["HS256"])

        # Check if already blacklisted
        if globals.blacklist.find_one({'token': token}):
            return make_response(jsonify({'message': 'Token already blacklisted'}), 400)

        # Add to blacklist
        globals.blacklist.insert_one({
            'token': token,
            'user_id': decoded.get('user_id'),
            'username': decoded.get('username'),
            'blacklisted_at': datetime.datetime.now(datetime.timezone.utc)
        })

        logger.info('LOGOUT  user="%s"', decoded.get('username'))
        return make_response(jsonify({
            'message': 'Logout successful',
            'user': decoded.get('username')
        }), 200)
    
    except jwt.ExpiredSignatureError:
        return make_response(jsonify({'message': 'Token has expired'}), 401)

    except jwt.InvalidTokenError:
        return make_response(jsonify({'message': 'Invalid token'}), 401)


# ─── Account Management ───────────────────────────────────────────────────────

@auth_bp.route('/api/v1.0/users/me', methods=['PUT'])
@jwt_required
def update_own_account(current_user):
    """
    Update the logged-in user's account.
    - Change password: requires current_password + new_password
    - Change username: requires new_username
    """
    data = request.get_json()
    if not data:
        return make_response(jsonify({'error': 'No data provided'}), 400)

    updates = {}

    # ── Username change ──────────────────────────────────
    new_username = data.get('new_username', '').strip()
    if new_username:
        if len(new_username) < 3:
            return make_response(jsonify({'error': 'Username must be at least 3 characters'}), 400)
        if globals.users.find_one({'username': new_username}):
            return make_response(jsonify({'error': 'Username already taken'}), 409)
        updates['username'] = new_username

    # ── Password change ──────────────────────────────────
    current_password = data.get('current_password', '')
    new_password     = data.get('new_password', '')
    if current_password or new_password:
        if not current_password or not new_password:
            return make_response(jsonify({'error': 'current_password and new_password are both required'}), 400)
        if len(new_password) < 6:
            return make_response(jsonify({'error': 'New password must be at least 6 characters'}), 400)
        if not bcrypt.checkpw(current_password.encode('utf-8'), current_user['password']):
            return make_response(jsonify({'error': 'Current password is incorrect'}), 401)
        updates['password'] = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())

    if not updates:
        return make_response(jsonify({'error': 'Nothing to update'}), 400)

    updates['updated_at'] = datetime.datetime.now(datetime.timezone.utc)
    globals.users.update_one({'_id': current_user['_id']}, {'$set': updates})

    fields = [k for k in updates if k not in ('updated_at', 'password')]
    if 'password' in updates:
        fields.append('password')
    logger.info('ACCOUNT UPDATE  user="%s"  fields=%s', current_user['username'], fields)
    return make_response(jsonify({
        'message': 'Account updated successfully',
        'username': updates.get('username', current_user['username'])
    }), 200)


@auth_bp.route('/api/v1.0/users/me', methods=['DELETE'])
@jwt_required
def delete_own_account(current_user):
    """
    Delete the currently logged-in user's account and all their trades.
    Also blacklists the current token so it cannot be reused.
    """
    user_id = str(current_user['_id'])

    # Delete all trades belonging to this user
    globals.trades.delete_many({'user_id': user_id})
    globals.users.delete_one({'_id': ObjectId(user_id)})

    # Blacklist the token so it cannot be reused
    token = request.headers.get('x-access-token')
    if token:
        globals.blacklist.insert_one({
            'token': token,
            'user_id': user_id,
            'username': current_user.get('username'),
            'blacklisted_at': datetime.datetime.now(datetime.timezone.utc)
        })

    logger.info('ACCOUNT DELETE  user="%s"', current_user.get('username'))
    return make_response(jsonify({'message': 'Account deleted successfully'}), 200)


# ─── Admin: User Management ───────────────────────────────────────────────────

@auth_bp.route('/api/v1.0/admin/users', methods=['GET'])
@admin_required
def admin_list_users(current_user):
    """Return a list of all users with basic stats (admin only)."""
    result = []
    for user in globals.users.find():
        uid = str(user['_id'])
        trade_count = globals.trades.count_documents({'user_id': uid})
        result.append({
            'user_id':    uid,
            'username':   user['username'],
            'admin':      user.get('admin', False),
            'created_at': user.get('created_at', '').isoformat() if user.get('created_at') else '',
            'trade_count': trade_count,
        })
    return make_response(jsonify(result), 200)


@auth_bp.route('/api/v1.0/admin/users/<string:user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(current_user, user_id):
    """Delete any user account and all their trades (admin only)."""
    # Prevent admin from deleting themselves via this endpoint
    if user_id == str(current_user['_id']):
        return make_response(
            jsonify({'error': 'Use the account page to delete your own account'}), 400
        )

    try:
        target = globals.users.find_one({'_id': ObjectId(user_id)})
    except Exception:
        return make_response(jsonify({'error': 'Invalid user ID'}), 400)

    if not target:
        return make_response(jsonify({'error': 'User not found'}), 404)

    globals.trades.delete_many({'user_id': user_id})
    globals.users.delete_one({'_id': ObjectId(user_id)})

    return make_response(jsonify({
        'message': f'User {target["username"]} deleted successfully'
    }), 200)
