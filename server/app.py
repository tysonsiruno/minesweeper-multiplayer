"""
Minesweeper Multiplayer Server
Flask + Socket.IO backend for multiplayer functionality
"""

import os
import secrets
from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, 'web')

# Initialize Flask app
app = Flask(__name__, static_folder=WEB_DIR, static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(16))

# Database Configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL or 'sqlite:///minesweeper.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}

# Initialize extensions
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize rate limiter (requires Redis for production)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.environ.get('REDIS_URL', 'memory://')
)

# Initialize database
from models import db, User, Session, GameHistory, EmailVerificationToken, PasswordResetToken, SecurityAuditLog

db.init_app(app)

# Import authentication utilities
from auth import (
    hash_password, verify_password, validate_password, validate_username, validate_email,
    generate_access_token, generate_refresh_token, decode_access_token, decode_refresh_token,
    token_required, get_client_ip, get_user_agent, sanitize_input
)

# Import email service
from email_service import (
    send_verification_email, send_password_reset_email,
    send_account_locked_email, send_welcome_email
)

# Create database tables
with app.app_context():
    db.create_all()
    print("Database tables created successfully!")

# In-memory storage for game rooms (multiplayer only)
game_rooms = {}  # {room_code: {host, players, difficulty, status, board_seed}}
player_sessions = {}  # {session_id: {username, room_code}}

def generate_room_code():
    """Generate a unique 6-digit numeric room code"""
    while True:
        code = str(secrets.randbelow(1000000)).zfill(6)
        if code not in game_rooms:
            return code

# Security headers middleware
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# Web Client Routes

@app.route('/')
def index():
    """Serve the web client"""
    return send_from_directory(WEB_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory(WEB_DIR, path)

# REST API Endpoints

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Render"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.route('/api/auth/register', methods=['POST'])
@limiter.limit("5 per hour")
def register():
    """User registration"""
    data = request.json
    username = sanitize_input(data.get('username', ''), 20)
    email = sanitize_input(data.get('email', ''), 255).lower()
    password = data.get('password', '')

    # Validation
    valid, msg = validate_username(username)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400

    valid, msg = validate_email(email)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400

    valid, msg = validate_password(password)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400

    # Check if username or email already exists
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': 'Username already taken'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Email already registered'}), 400

    # Create user (auto-verified - no email setup)
    try:
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            is_verified=True  # Auto-verify since no email service configured
        )
        db.session.add(user)
        db.session.commit()

        SecurityAuditLog.log_action(user.id, 'register', True, get_client_ip(), get_user_agent())

        return jsonify({'success': True, 'message': 'Registration successful! You can now log in.', 'user_id': user.id})
    except Exception as e:
        db.session.rollback()
        print(f'Registration error: {e}')
        return jsonify({'success': False, 'message': 'Registration failed. Please try again.'}), 500

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("10 per 15 minutes")
def login():
    """User login"""
    data = request.json
    # Get raw input without sanitization first for password
    username_or_email_raw = data.get('username_or_email', '').strip()
    password = data.get('password', '')
    remember_me = data.get('remember_me', False)

    # Sanitize but don't lowercase username (only lowercase email)
    username_or_email = sanitize_input(username_or_email_raw, 255)

    # Try case-sensitive username first, then case-insensitive email
    user = User.query.filter(User.username == username_or_email).first()
    if not user:
        # Try as email (case-insensitive)
        user = User.query.filter(User.email == username_or_email.lower()).first()

    if not user or not verify_password(password, user.password_hash):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=15)
                # Email disabled: send_account_locked_email(user.email, user.username, 15)
            db.session.commit()
        SecurityAuditLog.log_action(user.id if user else None, 'login', False, get_client_ip(), get_user_agent())
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.utcnow():
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60)
        return jsonify({'success': False, 'message': f'Account locked. Try again in {remaining} minutes.'}), 403

    # Reset failed attempts and create session
    try:
        user.failed_login_attempts = 0
        user.last_login = datetime.utcnow()

        # Auto-verify existing users (migration fix for disabled email verification)
        if not user.is_verified:
            user.is_verified = True

        db.session.commit()

        # Generate tokens
        access_token = generate_access_token(user.id, user.username, user.is_verified)
        refresh_token_str = secrets.token_urlsafe(32)

        session = Session(
            user_id=user.id,
            session_token=secrets.token_urlsafe(32),
            refresh_token=refresh_token_str,
            expires_at=datetime.utcnow() + (timedelta(days=30) if remember_me else timedelta(days=7)),
            ip_address=get_client_ip(),
            user_agent=get_user_agent()
        )
        db.session.add(session)
        db.session.commit()

        SecurityAuditLog.log_action(user.id, 'login', True, get_client_ip(), get_user_agent())

        return jsonify({
            'success': True,
            'access_token': access_token,
            'refresh_token': refresh_token_str,
            'user': user.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        print(f'Login session creation error: {e}')
        return jsonify({'success': False, 'message': 'Login failed. Please try again.'}), 500

# Email verification disabled - no email service configured
# @app.route('/api/auth/verify-email', methods=['GET'])
# def verify_email():
#     """Verify user email with token"""
#     token = request.args.get('token')
#     if not token:
#         return jsonify({'success': False, 'message': 'Token required'}), 400
#
#     verification = EmailVerificationToken.query.filter_by(token=token).first()
#     if not verification or verification.is_expired() or verification.is_used():
#         return jsonify({'success': False, 'message': 'Invalid or expired token'}), 400
#
#     try:
#         user = User.query.get(verification.user_id)
#         user.is_verified = True
#         verification.used_at = datetime.utcnow()
#         db.session.commit()
#
#         send_welcome_email(user.email, user.username)
#         SecurityAuditLog.log_action(user.id, 'email_verified', True, get_client_ip(), get_user_agent())
#
#         return jsonify({'success': True, 'message': 'Email verified successfully!'})
#     except Exception as e:
#         db.session.rollback()
#         print(f'Email verification error: {e}')
#         return jsonify({'success': False, 'message': 'Verification failed. Please try again.'}), 500

# Password reset via email disabled - no email service configured
# To re-enable: uncomment this endpoint and configure SendGrid
# @app.route('/api/auth/forgot-password', methods=['POST'])
# @limiter.limit("3 per hour")
# def forgot_password():
#     """Request password reset"""
#     data = request.json
#     email = sanitize_input(data.get('email', ''), 255).lower()
#
#     user = User.query.filter_by(email=email).first()
#     if user:
#         try:
#             token = PasswordResetToken.generate_token()
#             reset = PasswordResetToken(
#                 user_id=user.id,
#                 token=token,
#                 expires_at=datetime.utcnow() + timedelta(hours=1),
#                 ip_address=get_client_ip()
#             )
#             db.session.add(reset)
#             db.session.commit()
#             send_password_reset_email(email, user.username, token)
#         except Exception as e:
#             db.session.rollback()
#             print(f'Password reset token creation error: {e}')
#             return jsonify({'success': False, 'message': 'Failed to send reset link. Please try again.'}), 500
#
#     return jsonify({'success': True, 'message': 'If email exists, reset link has been sent'})

# Password reset endpoint disabled (depends on email)
# @app.route('/api/auth/reset-password', methods=['POST'])
# def reset_password():
#     """Reset password with token"""
#     data = request.json
#     token = data.get('token')
#     new_password = data.get('new_password')
#
#     valid, msg = validate_password(new_password)
#     if not valid:
#         return jsonify({'success': False, 'message': msg}), 400
#
#     reset = PasswordResetToken.query.filter_by(token=token).first()
#     if not reset or reset.is_expired() or reset.is_used():
#         return jsonify({'success': False, 'message': 'Invalid or expired token'}), 400
#
#     try:
#         user = User.query.get(reset.user_id)
#         user.password_hash = hash_password(new_password)
#         reset.used_at = datetime.utcnow()
#
#         # Invalidate all sessions
#         Session.query.filter_by(user_id=user.id).delete()
#         db.session.commit()
#
#         SecurityAuditLog.log_action(user.id, 'password_reset', True, get_client_ip(), get_user_agent())
#         return jsonify({'success': True, 'message': 'Password reset successfully'})
#     except Exception as e:
#         db.session.rollback()
#         print(f'Password reset error: {e}')
#         return jsonify({'success': False, 'message': 'Password reset failed. Please try again.'}), 500

@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout(current_user):
    """Logout user"""
    try:
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.split(' ')[1] if ' ' in auth_header else ''

        # Invalidate current session
        Session.query.filter_by(user_id=current_user.id).delete()
        db.session.commit()

        SecurityAuditLog.log_action(current_user.id, 'logout', True, get_client_ip(), get_user_agent())
        return jsonify({'success': True, 'message': 'Logged out successfully'})
    except Exception as e:
        db.session.rollback()
        print(f'Logout error: {e}')
        return jsonify({'success': False, 'message': 'Logout failed. Please try again.'}), 500

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    """Get current user info"""
    return jsonify({'success': True, 'user': current_user.to_dict()})

@app.route('/api/auth/refresh', methods=['POST'])
def refresh_token():
    """Refresh access token using refresh token"""
    auth_header = request.headers.get('Authorization', '')
    refresh_token_str = auth_header.split(' ')[1] if ' ' in auth_header else ''

    if not refresh_token_str:
        return jsonify({'success': False, 'message': 'Refresh token required'}), 401

    # Find session with this refresh token
    session = Session.query.filter_by(refresh_token=refresh_token_str, is_active=True).first()

    if not session or session.is_expired():
        return jsonify({'success': False, 'message': 'Invalid or expired refresh token'}), 401

    # Get user
    user = User.query.get(session.user_id)
    if not user or user.account_status != 'active':
        return jsonify({'success': False, 'message': 'User not found or inactive'}), 401

    try:
        # Generate new access token
        access_token = generate_access_token(user.id, user.username, user.is_verified)

        # Optionally rotate refresh token for better security
        new_refresh_token = secrets.token_urlsafe(32)
        session.refresh_token = new_refresh_token
        db.session.commit()

        return jsonify({
            'success': True,
            'access_token': access_token,
            'refresh_token': new_refresh_token
        })
    except Exception as e:
        db.session.rollback()
        print(f'Token refresh error: {e}')
        return jsonify({'success': False, 'message': 'Token refresh failed. Please try again.'}), 500

# Email verification disabled - no email service configured
# @app.route('/api/auth/resend-verification', methods=['POST'])
# @token_required
# @limiter.limit("3 per hour")
# def resend_verification(current_user):
#     """Resend email verification"""
#     if current_user.is_verified:
#         return jsonify({'success': False, 'message': 'Email already verified'}), 400
#
#     try:
#         # Invalidate old tokens
#         EmailVerificationToken.query.filter_by(user_id=current_user.id, used_at=None).delete()
#
#         # Create new verification token
#         token = EmailVerificationToken.generate_token()
#         verification = EmailVerificationToken(
#             user_id=current_user.id,
#             token=token,
#             expires_at=datetime.utcnow() + timedelta(hours=24)
#         )
#         db.session.add(verification)
#         db.session.commit()
#
#         # Send verification email
#         send_verification_email(current_user.email, current_user.username, token)
#
#         SecurityAuditLog.log_action(current_user.id, 'resend_verification', True, get_client_ip(), get_user_agent())
#
#         return jsonify({'success': True, 'message': 'Verification email sent'})
#     except Exception as e:
#         db.session.rollback()
#         print(f'Resend verification error: {e}')
#         return jsonify({'success': False, 'message': 'Failed to send verification email. Please try again.'}), 500

@app.route('/api/rooms/list', methods=['GET'])
def list_rooms():
    """Get list of active rooms"""
    active_rooms = [
        {
            "code": code,
            "host": room["host"],
            "difficulty": room["difficulty"],
            "players": len(room["players"]),
            "max_players": room["max_players"],
            "status": room["status"]
        }
        for code, room in game_rooms.items()
        if room["status"] == "waiting"
    ]
    return jsonify({"rooms": active_rooms})

@app.route('/api/leaderboard/global', methods=['GET'])
def get_global_leaderboard():
    """Get global leaderboard from database"""
    game_mode = request.args.get('difficulty', 'all')  # Using 'difficulty' param for backwards compatibility

    query = GameHistory.query.filter_by(won=True)

    if game_mode != 'all':
        query = query.filter_by(game_mode=game_mode)

    # Get top scores
    leaderboard = query.order_by(GameHistory.score.desc()).limit(50).all()

    return jsonify({
        "leaderboard": [
            {
                "username": game.username,
                "score": game.score,
                "time": game.time_seconds,
                "difficulty": game.game_mode,
                "hints_used": game.hints_used,
                "date": game.created_at.isoformat() if game.created_at else None
            }
            for game in leaderboard
        ]
    })

@app.route('/api/leaderboard/submit', methods=['POST'])
@limiter.limit("100 per hour")
def submit_score():
    """Submit score to database leaderboard"""
    data = request.json

    # Validate and sanitize inputs
    username = sanitize_input(data.get("username", "Guest"), 50)

    # Validate numeric inputs with error handling
    try:
        score = int(data.get("score", 0))
        time_seconds = int(data.get("time", 0))
        hints_used = int(data.get("hints_used", 0))
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": "Invalid numeric value provided"}), 400

    # Validate score and time are non-negative
    if score < 0 or time_seconds < 0 or hints_used < 0:
        return jsonify({"success": False, "message": "Score, time, and hints must be non-negative"}), 400

    # Validate reasonable max values to prevent abuse
    if score > 10000 or time_seconds > 86400 or hints_used > 100:
        return jsonify({"success": False, "message": "Invalid score values"}), 400

    game_mode = sanitize_input(data.get("difficulty", "standard"), 50)  # Using 'difficulty' for backwards compatibility
    won = bool(data.get("won", False))

    try:
        # Create game history entry
        game = GameHistory(
            username=username,
            game_mode=game_mode,
            score=score,
            time_seconds=time_seconds,
            tiles_clicked=score,  # Score is tiles clicked
            hints_used=hints_used,
            won=won,
            multiplayer=False
        )
        db.session.add(game)
        db.session.commit()

        return jsonify({"success": True, "entry": game.to_dict()})
    except Exception as e:
        db.session.rollback()
        print(f'Leaderboard submission error: {e}')
        return jsonify({"success": False, "message": "Failed to submit score. Please try again."}), 500

# WebSocket Events

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")
    emit('connected', {"session_id": request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"Client disconnected: {request.sid}")

    # Remove player from any room they're in
    if request.sid in player_sessions:
        session = player_sessions[request.sid]
        room_code = session.get("room_code")

        if room_code and room_code in game_rooms:
            room = game_rooms[room_code]
            room["players"] = [p for p in room["players"] if p["session_id"] != request.sid]

            # Notify other players
            emit('player_left', {
                "username": session["username"],
                "players_remaining": len(room["players"]),
                "players": room["players"]
            }, room=room_code)

            # Delete room if empty
            if len(room["players"]) == 0:
                del game_rooms[room_code]

        del player_sessions[request.sid]

@socketio.on('create_room')
def handle_create_room(data):
    """Create a new game room"""
    if not data:
        emit('error', {"message": "Invalid data"})
        return

    # Sanitize and validate inputs
    username = sanitize_input(data.get("username", "Player"), 50)
    difficulty = sanitize_input(data.get("difficulty", "Medium"), 20)
    game_mode = sanitize_input(data.get("game_mode", "standard"), 20)

    # Validate max_players
    try:
        max_players = int(data.get("max_players", 3))
        if max_players < 2 or max_players > 10:
            emit('error', {"message": "Max players must be between 2 and 10"})
            return
    except (ValueError, TypeError):
        emit('error', {"message": "Invalid max players value"})
        return

    room_code = generate_room_code()

    game_rooms[room_code] = {
        "code": room_code,
        "host": username,
        "difficulty": difficulty,
        "max_players": max_players,
        "game_mode": game_mode,
        "status": "waiting",
        "players": [{
            "username": username,
            "session_id": request.sid,
            "ready": False,
            "score": 0,
            "finished": False,
            "eliminated": False
        }],
        "board_seed": secrets.randbelow(1000000),
        "current_turn": username if game_mode == "luck" else None,
        "created_at": datetime.now().isoformat()
    }

    player_sessions[request.sid] = {
        "username": username,
        "room_code": room_code
    }

    join_room(room_code)

    emit('room_created', {
        "room_code": room_code,
        "difficulty": difficulty,
        "max_players": max_players,
        "game_mode": game_mode
    })

    print(f"Room {room_code} created by {username} (mode: {game_mode})")

@socketio.on('join_room')
def handle_join_room(data):
    """Join an existing game room"""
    if not data:
        emit('error', {"message": "Invalid data"})
        return

    # Validate and sanitize room code
    room_code = str(data.get("room_code", "")).strip()
    if not room_code or len(room_code) != 6 or not room_code.isdigit():
        emit('error', {"message": "Invalid room code format - must be 6 digits"})
        return

    # Sanitize username
    username = sanitize_input(data.get("username", "Player"), 50)
    if not username:
        emit('error', {"message": "Username required"})
        return

    if room_code not in game_rooms:
        emit('error', {"message": "Room not found"})
        return

    room = game_rooms[room_code]

    if room["status"] != "waiting":
        emit('error', {"message": "Game already in progress"})
        return

    if len(room["players"]) >= room["max_players"]:
        emit('error', {"message": "Room is full"})
        return

    # Add player to room
    room["players"].append({
        "username": username,
        "session_id": request.sid,
        "ready": False,
        "score": 0,
        "finished": False,
        "eliminated": False
    })

    player_sessions[request.sid] = {
        "username": username,
        "room_code": room_code
    }

    join_room(room_code)

    # Notify player they joined
    emit('room_joined', {
        "room_code": room_code,
        "difficulty": room["difficulty"],
        "host": room["host"],
        "players": room["players"]
    })

    # Notify other players
    emit('player_joined', {
        "username": username,
        "players": room["players"]
    }, room=room_code, skip_sid=request.sid)

    print(f"{username} joined room {room_code}")

@socketio.on('leave_room')
def handle_leave_room():
    """Leave current room"""
    if request.sid not in player_sessions:
        return

    session = player_sessions.get(request.sid)
    if not session:
        return

    room_code = session.get("room_code")
    if not room_code:
        return

    if room_code in game_rooms:
        room = game_rooms[room_code]
        room["players"] = [p for p in room["players"] if p["session_id"] != request.sid]

        leave_room(room_code)

        emit('left_room', {"success": True})
        emit('player_left', {
            "username": session["username"],
            "players_remaining": len(room["players"]),
            "players": room["players"]
        }, room=room_code)

        # Delete room if empty
        if len(room["players"]) == 0:
            del game_rooms[room_code]

    # Safely remove from player_sessions
    if request.sid in player_sessions:
        del player_sessions[request.sid]

@socketio.on('player_ready')
def handle_player_ready(data):
    """Mark player as ready to start"""
    if request.sid not in player_sessions:
        return

    session = player_sessions[request.sid]
    room_code = session["room_code"]

    if room_code not in game_rooms:
        return

    room = game_rooms[room_code]

    # Mark player as ready
    for player in room["players"]:
        if player["session_id"] == request.sid:
            player["ready"] = True
            break

    # Check if all players are ready
    all_ready = all(p["ready"] for p in room["players"])

    emit('player_ready_update', {
        "username": session["username"],
        "players": room["players"],
        "all_ready": all_ready
    }, room=room_code)

    # Start game if all ready (need at least 2 players for multiplayer)
    if all_ready and len(room["players"]) >= 2:
        room["status"] = "playing"
        emit('game_start', {
            "difficulty": room["difficulty"],
            "board_seed": room["board_seed"],
            "game_mode": room["game_mode"],
            "current_turn": room.get("current_turn"),
            "players": room["players"]
        }, room=room_code)

@socketio.on('game_action')
def handle_game_action(data):
    """Handle game actions (cell reveal, flag)"""
    if not data:
        return

    if request.sid not in player_sessions:
        return

    session = player_sessions[request.sid]
    room_code = session["room_code"]

    if room_code not in game_rooms:
        return

    room = game_rooms[room_code]
    action = data.get("action")

    # Validate action type
    valid_actions = ["reveal", "flag", "eliminated"]
    if action not in valid_actions:
        return

    # Validate row and col if provided
    if action in ["reveal", "flag"]:
        try:
            row = data.get("row")
            col = data.get("col")
            if row is not None:
                row = int(row)
                if row < 0 or row > 100:  # Reasonable max board size
                    return
            if col is not None:
                col = int(col)
                if col < 0 or col > 100:  # Reasonable max board size
                    return
        except (ValueError, TypeError):
            return

    # Handle elimination in ALL game modes
    if action == "eliminated":
        # Mark player as eliminated and record their score
        for player in room["players"]:
            if player["session_id"] == request.sid:
                player["eliminated"] = True
                player["finished"] = True
                player["score"] = data.get("clicks", 0)
                break

        # Check if only one player remains
        active_players = [p for p in room["players"] if not p["eliminated"]]

        if len(active_players) == 1:
            # Last player standing wins!
            winner = active_players[0]
            winner["finished"] = True

            # Notify all players that someone was eliminated and there's a winner
            emit('player_eliminated', {
                "username": session["username"],
                "winner": winner["username"]
            }, room=room_code)

            # Sort players by score (winner first, then by who lasted longest)
            sorted_players = sorted(room["players"], key=lambda x: (not x["eliminated"], x["score"]), reverse=True)

            # Send game_ended event to show results and return to waiting room
            emit('game_ended', {
                "results": sorted_players
            }, room=room_code)

            # Reset room status for next game
            room["status"] = "waiting"
            for player in room["players"]:
                player["ready"] = False
                player["score"] = 0
                player["finished"] = False
                player["eliminated"] = False

        elif len(active_players) == 0:
            # Everyone died somehow - tie game
            emit('game_ended', {
                "results": room["players"]
            }, room=room_code)

            room["status"] = "waiting"
            for player in room["players"]:
                player["ready"] = False
                player["score"] = 0
                player["finished"] = False
                player["eliminated"] = False
        else:
            # Multiple players still alive, just notify elimination
            emit('player_eliminated', {
                "username": session["username"]
            }, room=room_code)

            # In Luck Mode (turn-based), move to next player's turn
            if room["game_mode"] == "luck":
                current_idx = next((i for i, p in enumerate(room["players"]) if p["username"] == room["current_turn"]), 0)
                next_idx = (current_idx + 1) % len(room["players"])

                # Find next non-eliminated player
                attempts = 0
                while room["players"][next_idx]["eliminated"] and attempts < len(room["players"]):
                    next_idx = (next_idx + 1) % len(room["players"])
                    attempts += 1

                if attempts < len(room["players"]):
                    room["current_turn"] = room["players"][next_idx]["username"]
                    emit('turn_changed', {
                        "current_turn": room["current_turn"]
                    }, room=room_code)
        return

    # Broadcast action to other players in room
    emit('player_action', {
        "username": session["username"],
        "action": action,
        "row": data.get("row"),
        "col": data.get("col")
    }, room=room_code, skip_sid=request.sid)

    # In Luck Mode, change turn after reveal action
    if room["game_mode"] == "luck" and action == "reveal":
        # Find next player
        current_idx = next((i for i, p in enumerate(room["players"]) if p["username"] == room["current_turn"]), 0)
        next_idx = (current_idx + 1) % len(room["players"])

        # Find next non-eliminated player
        attempts = 0
        while room["players"][next_idx].get("eliminated", False) and attempts < len(room["players"]):
            next_idx = (next_idx + 1) % len(room["players"])
            attempts += 1

        if attempts < len(room["players"]):
            room["current_turn"] = room["players"][next_idx]["username"]
            emit('turn_changed', {
                "current_turn": room["current_turn"]
            }, room=room_code)

@socketio.on('game_finished')
def handle_game_finished(data):
    """Handle player finishing game"""
    if not data:
        return

    if request.sid not in player_sessions:
        return

    session = player_sessions[request.sid]
    room_code = session["room_code"]

    if room_code not in game_rooms:
        return

    room = game_rooms[room_code]

    # Validate score and time
    try:
        score = int(data.get("score", 0))
        time = int(data.get("time", 0))
        if score < 0 or time < 0:
            score, time = 0, 0
        if score > 10000 or time > 86400:  # Reasonable max values
            score, time = min(score, 10000), min(time, 86400)
    except (ValueError, TypeError):
        score, time = 0, 0

    # Update player score
    for player in room["players"]:
        if player["session_id"] == request.sid:
            player["score"] = score
            player["time"] = time
            player["finished"] = True
            break

    # Check if all players finished
    all_finished = all(p["finished"] for p in room["players"])

    emit('player_finished', {
        "username": session["username"],
        "score": data.get("score", 0),
        "time": data.get("time", 0),
        "players": room["players"]
    }, room=room_code)

    if all_finished:
        # Sort by score
        sorted_players = sorted(room["players"], key=lambda x: x["score"], reverse=True)

        emit('game_ended', {
            "results": sorted_players
        }, room=room_code)

        # Reset room status
        room["status"] = "waiting"
        for player in room["players"]:
            player["ready"] = False
            player["score"] = 0
            player["finished"] = False
            player["eliminated"] = False

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    socketio.run(app, host='0.0.0.0', port=port, debug=debug_mode)
