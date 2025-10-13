"""
Minesweeper Multiplayer Server
Flask + Socket.IO backend for multiplayer functionality
"""

import os
import secrets
from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
from flask_cors import CORS
from datetime import datetime
import json

# Get paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, 'web')

app = Flask(__name__, static_folder=WEB_DIR, static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(16))
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage (will be replaced with PostgreSQL later)
game_rooms = {}  # {room_code: {host, players, difficulty, status, board_seed}}
player_sessions = {}  # {session_id: {username, room_code}}
global_leaderboard = []

def generate_room_code():
    """Generate a unique 6-character room code"""
    while True:
        code = secrets.token_hex(3).upper()
        if code not in game_rooms:
            return code

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
    """Get global leaderboard"""
    difficulty = request.args.get('difficulty', 'all')

    if difficulty == 'all':
        board = sorted(global_leaderboard, key=lambda x: x['score'], reverse=True)[:50]
    else:
        board = sorted(
            [entry for entry in global_leaderboard if entry['difficulty'] == difficulty],
            key=lambda x: x['score'],
            reverse=True
        )[:10]

    return jsonify({"leaderboard": board})

@app.route('/api/leaderboard/submit', methods=['POST'])
def submit_score():
    """Submit score to global leaderboard"""
    data = request.json
    entry = {
        "username": data.get("username"),
        "score": data.get("score"),
        "time": data.get("time"),
        "difficulty": data.get("difficulty"),
        "hints_used": data.get("hints_used"),
        "date": datetime.now().isoformat()
    }
    global_leaderboard.append(entry)

    # Keep only top 1000 scores
    global_leaderboard.sort(key=lambda x: x['score'], reverse=True)
    if len(global_leaderboard) > 1000:
        global_leaderboard[:] = global_leaderboard[:1000]

    return jsonify({"success": True, "entry": entry})

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
    username = data.get("username", "Player")
    difficulty = data.get("difficulty", "Medium")
    max_players = data.get("max_players", 3)
    game_mode = data.get("game_mode", "standard")

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
    room_code = data.get("room_code", "").upper()
    username = data.get("username", "Player")

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

    session = player_sessions[request.sid]
    room_code = session["room_code"]

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
    if request.sid not in player_sessions:
        return

    session = player_sessions[request.sid]
    room_code = session["room_code"]

    if room_code not in game_rooms:
        return

    room = game_rooms[room_code]
    action = data.get("action")

    # Handle elimination in Luck Mode
    if action == "eliminated" and room["game_mode"] == "luck":
        # Mark player as eliminated
        for player in room["players"]:
            if player["session_id"] == request.sid:
                player["eliminated"] = True
                break

        # Check if only one player remains
        active_players = [p for p in room["players"] if not p["eliminated"]]
        if len(active_players) == 1:
            winner = active_players[0]
            emit('player_eliminated', {
                "username": session["username"],
                "winner": winner["username"]
            }, room=room_code)
            room["status"] = "finished"
        else:
            emit('player_eliminated', {
                "username": session["username"]
            }, room=room_code)

            # Move to next player's turn
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
    if request.sid not in player_sessions:
        return

    session = player_sessions[request.sid]
    room_code = session["room_code"]

    if room_code not in game_rooms:
        return

    room = game_rooms[room_code]

    # Update player score
    for player in room["players"]:
        if player["session_id"] == request.sid:
            player["score"] = data.get("score", 0)
            player["time"] = data.get("time", 0)
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
