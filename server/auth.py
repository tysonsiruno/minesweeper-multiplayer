"""
Authentication Utilities
Password hashing, JWT generation, validation
"""

import bcrypt
import jwt
import re
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
import os

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-key-change-in-production')
JWT_REFRESH_SECRET = os.environ.get('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
REFRESH_TOKEN_EXPIRES = timedelta(days=7)
REFRESH_TOKEN_EXPIRES_REMEMBER = timedelta(days=30)

# Password Requirements
PASSWORD_MIN_LENGTH = 8
PASSWORD_REGEX = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~])')

# Username Requirements
USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_]{3,20}$')

# Email Validation
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


# ============================================================================
# PASSWORD HASHING
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with cost factor 12

    Args:
        password: Plain text password

    Returns:
        Hashed password string
    """
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a password against a hash

    Args:
        password: Plain text password
        hashed: Hashed password from database

    Returns:
        True if password matches, False otherwise
    """
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def validate_password(password: str) -> tuple:
    """
    Validate password meets requirements

    Requirements:
    - At least 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 number
    - At least 1 special character

    Returns:
        (is_valid: bool, error_message: str or None)
    """
    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f'Password must be at least {PASSWORD_MIN_LENGTH} characters long'

    if not re.search(r'[a-z]', password):
        return False, 'Password must contain at least one lowercase letter'

    if not re.search(r'[A-Z]', password):
        return False, 'Password must contain at least one uppercase letter'

    if not re.search(r'\d', password):
        return False, 'Password must contain at least one number'

    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]', password):
        return False, 'Password must contain at least one special character'

    return True, None


# ============================================================================
# INPUT VALIDATION
# ============================================================================

def validate_username(username: str) -> tuple:
    """
    Validate username format

    Requirements:
    - 3-20 characters
    - Only letters, numbers, and underscores

    Returns:
        (is_valid: bool, error_message: str or None)
    """
    if not username:
        return False, 'Username is required'

    if len(username) < 3:
        return False, 'Username must be at least 3 characters long'

    if len(username) > 20:
        return False, 'Username must be at most 20 characters long'

    if not USERNAME_REGEX.match(username):
        return False, 'Username can only contain letters, numbers, and underscores'

    return True, None


def validate_email(email: str) -> tuple:
    """
    Validate email format

    Returns:
        (is_valid: bool, error_message: str or None)
    """
    if not email:
        return False, 'Email is required'

    if not EMAIL_REGEX.match(email):
        return False, 'Invalid email format'

    if len(email) > 255:
        return False, 'Email is too long'

    return True, None


def sanitize_input(text: str, max_length: int = 500) -> str:
    """
    Sanitize user input - remove potentially dangerous characters

    Args:
        text: Input text
        max_length: Maximum allowed length

    Returns:
        Sanitized text
    """
    if not text:
        return ''

    # Remove null bytes
    text = text.replace('\x00', '')

    # Trim to max length
    text = text[:max_length]

    # Remove leading/trailing whitespace
    text = text.strip()

    return text


# ============================================================================
# JWT TOKEN GENERATION
# ============================================================================

def generate_access_token(user_id: int, username: str, is_verified: bool = False) -> str:
    """
    Generate a JWT access token

    Args:
        user_id: User ID
        username: Username
        is_verified: Whether user's email is verified

    Returns:
        JWT token string
    """
    payload = {
        'user_id': user_id,
        'username': username,
        'is_verified': is_verified,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + ACCESS_TOKEN_EXPIRES,
        'type': 'access'
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def generate_refresh_token(user_id: int, session_id: int, remember_me: bool = False) -> str:
    """
    Generate a JWT refresh token

    Args:
        user_id: User ID
        session_id: Session ID
        remember_me: Whether to extend expiration

    Returns:
        JWT token string
    """
    expiry = REFRESH_TOKEN_EXPIRES_REMEMBER if remember_me else REFRESH_TOKEN_EXPIRES

    payload = {
        'user_id': user_id,
        'session_id': session_id,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + expiry,
        'type': 'refresh'
    }
    return jwt.encode(payload, JWT_REFRESH_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate an access token

    Args:
        token: JWT token string

    Returns:
        Decoded payload dict

    Raises:
        jwt.ExpiredSignatureError: If token is expired
        jwt.InvalidTokenError: If token is invalid
    """
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def decode_refresh_token(token: str) -> dict:
    """
    Decode and validate a refresh token

    Args:
        token: JWT token string

    Returns:
        Decoded payload dict

    Raises:
        jwt.ExpiredSignatureError: If token is expired
        jwt.InvalidTokenError: If token is invalid
    """
    return jwt.decode(token, JWT_REFRESH_SECRET, algorithms=[JWT_ALGORITHM])


# ============================================================================
# AUTHENTICATION DECORATORS
# ============================================================================

def token_required(f):
    """
    Decorator to require valid JWT token

    Usage:
        @app.route('/protected')
        @token_required
        def protected_route(current_user):
            # current_user is passed as first argument
            return jsonify({'message': f'Hello {current_user.username}'})
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Format: "Bearer <token>"
            except IndexError:
                return jsonify({'success': False, 'message': 'Invalid authorization header format'}), 401

        if not token:
            return jsonify({'success': False, 'message': 'Authentication token is missing'}), 401

        try:
            # Decode token
            payload = decode_access_token(token)

            # Import here to avoid circular imports
            from models import User

            # Get user from database
            current_user = User.query.filter_by(id=payload['user_id']).first()

            if not current_user:
                return jsonify({'success': False, 'message': 'User not found'}), 401

            if current_user.account_status != 'active':
                return jsonify({'success': False, 'message': 'Account is not active'}), 403

            # Pass current user to the route
            return f(current_user, *args, **kwargs)

        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid token'}), 401
        except Exception as e:
            return jsonify({'success': False, 'message': 'Authentication failed', 'error': str(e)}), 401

    return decorated


def verified_required(f):
    """
    Decorator to require verified email

    Usage:
        @app.route('/verified-only')
        @token_required
        @verified_required
        def verified_route(current_user):
            return jsonify({'message': 'Email is verified!'})
    """
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if not current_user.is_verified:
            return jsonify({'success': False, 'message': 'Email verification required'}), 403

        return f(current_user, *args, **kwargs)

    return decorated


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_client_ip():
    """Get client IP address from request"""
    if request.environ.get('HTTP_X_FORWARDED_FOR'):
        return request.environ['HTTP_X_FORWARDED_FOR'].split(',')[0]
    return request.environ.get('REMOTE_ADDR')


def get_user_agent():
    """Get user agent from request"""
    return request.headers.get('User-Agent', '')[:500]  # Limit length
