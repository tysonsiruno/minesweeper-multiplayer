# 🎮 Minesweeper Multiplayer

A modern, feature-rich Minesweeper game with **single-player** and **multiplayer** modes! Built with Python, Pygame, Flask, and Socket.IO.

## ✨ Features

### 🎯 Game Modes
- **Solo Mode**: Classic minesweeper with local leaderboards
- **Multiplayer Race Mode**: Compete against up to 3 players on the same board!

### 🏆 Core Features
- Three difficulty levels (Easy, Medium, Hard)
- Smart hint system (3 hints per game)
- Real-time scoring based on time and performance
- Local and global leaderboards
- Room system with shareable codes
- Live player standings during multiplayer games

### 🎨 Modern UI
- Dark theme interface
- Smooth hover effects
- Real-time game synchronization
- Player status indicators

### 🎁 Easter Egg
- Try username `ICantLose` for a special cheat mode!

## 🚀 Quick Start

### Prerequisites
```bash
# Python 3.9+
python3 --version

# Install dependencies
pip install -r requirements.txt
```

### Solo Mode (No Server Needed)
```bash
python3 minesweeper_multiplayer.py
# Choose "Solo" when prompted
```

### Multiplayer Mode

**Option 1: Play on Local Network**
```bash
# Terminal 1: Start server
cd server
python3 app.py

# Terminal 2: Start client
cd ..
export SERVER_URL=http://localhost:5000
python3 minesweeper_multiplayer.py
```

**Option 2: Play Online (Render)**
1. Deploy server to Render (see DEPLOYMENT.md)
2. Set SERVER_URL to your Render URL
3. Run client and choose "Multiplayer"

## 🎮 How to Play

### Controls
| Action | Input |
|--------|-------|
| Reveal cell | Left Click |
| Flag mine | Right Click |
| Use hint | H key or Hint button |
| New game | F2 or New button |
| Quit | ESC |

### Multiplayer Flow
1. **Create Room**: Click "Create Room" and share the 6-character code
2. **Join Room**: Enter room code to join existing game
3. **Ready Up**: Click "Ready" when all players have joined
4. **Race**: Same board, fastest solver wins!
5. **Results**: View standings and scores

## 📁 Project Structure

```
minesweeper-python/
├── minesweeper_multiplayer.py    # Main multiplayer client
├── minesweeper_final.py           # Solo-only version
├── minesweeper_enhanced.py        # Legacy version
├── requirements.txt               # Client dependencies
├── leaderboard.json              # Local scores
│
├── server/                       # Backend server
│   ├── app.py                   # Flask + Socket.IO server
│   ├── requirements.txt         # Server dependencies
│   ├── Procfile                 # Render config
│   └── render.yaml              # Render blueprint
│
├── README.md                     # This file
├── DEPLOYMENT.md                 # Deployment guide
├── README_ENHANCED.md            # Feature documentation
└── MULTIPLAYER_PLAN.md           # Architecture details
```

## 🔧 Development

### Run Server Locally
```bash
cd server
pip install -r requirements.txt
python3 app.py
# Server runs on http://localhost:5000
```

### Run Client
```bash
# Set server URL
export SERVER_URL=http://localhost:5000

# Run game
python3 minesweeper_multiplayer.py
```

### Test Multiplayer
1. Start server
2. Open 2-3 terminal windows
3. Run client in each
4. Create room in one, join from others

## 🌐 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full Render deployment instructions.

**Quick Deploy to Render:**
1. Fork this repository
2. Connect to Render
3. Create Web Service pointing to `/server`
4. Deploy!

## 📊 API Endpoints

### REST API
- `GET /health` - Server health check
- `GET /api/rooms/list` - List active rooms
- `GET /api/leaderboard/global?difficulty={Easy|Medium|Hard}` - Get leaderboard
- `POST /api/leaderboard/submit` - Submit score

### WebSocket Events
- `create_room` - Create new game room
- `join_room` - Join existing room
- `player_ready` - Mark player as ready
- `game_action` - Sync game moves
- `game_finished` - Report completion

## 🎯 Scoring System

```python
base_score = (1000 - time_seconds * 2) + (hints_remaining * 100)
final_score = base_score * difficulty_multiplier

# Difficulty multipliers:
# Easy: 1x, Medium: 2x, Hard: 3x
```

## 🐛 Known Issues

- Server spins down on Render free tier (first request takes ~30s)
- No persistent database yet (in-memory storage)
- No authentication system (planned)

## 🚧 Roadmap

- [ ] PostgreSQL database integration
- [ ] User authentication
- [ ] More game modes (Co-op, Battle)
- [ ] Chat system
- [ ] Spectator mode
- [ ] Mobile controls

## 🤝 Contributing

Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Add game modes

## 📝 License

Free to use, modify, and distribute!

## 🔗 Links

- **GitHub**: https://github.com/tysonsiruno/minesweeper-multiplayer
- **Render**: https://render.com (for deployment)
- **Architecture**: See MULTIPLAYER_PLAN.md

---

**Built with:** Python • Pygame • Flask • Socket.IO • Render

Enjoy the game and happy mining! 💣
