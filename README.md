# 💣 Minesweeper Multiplayer

A modern, feature-rich multiplayer minesweeper game with real-time competition, multiple game modes, and a beautiful glassmorphic UI. Play instantly in your browser!

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![Flask](https://img.shields.io/badge/Flask-3.0-green)
![Socket.IO](https://img.shields.io/badge/SocketIO-5.3-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 🎮 Multiple Game Modes

- **Standard Mode** - Classic minesweeper with revealed numbers
- **Time Bomb Mode** - Race against a countdown timer with time penalties
- **Survival Mode** - Progressive difficulty that increases with each level
- **Russian Roulette Mode** - Turn-based elimination with hidden numbers (multiplayer only)

### 🌐 Multiplayer Support

- **Real-time multiplayer** with WebSocket synchronization
- **Room system** with shareable 6-character codes
- **Turn-based gameplay** for Russian Roulette mode
- **Live leaderboards** showing player progress
- **Synchronized board generation** - all players get identical boards

### 🎯 Solo Features

- **Global leaderboard** - Compete for top scores across all game modes
- **Hint system** - Get assistance when stuck (with score penalty)
- **Progressive difficulty** - 5 difficulty levels from Easy to Hacker
- **Click-based scoring** - Efficient play = higher scores

### 🎨 Modern UI

- **Glassmorphic design** with backdrop blur effects
- **HTML5 Canvas rendering** for smooth gameplay
- **Responsive layout** for desktop and tablet
- **Clean, intuitive interface** with proper color contrast

### 🎁 Easter Egg
- Try username `ICantLose` for a special cheat mode!

## 🚀 Quick Start

### Prerequisites

- Python 3.9 or higher
- pip package manager
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/minesweeper-multiplayer.git
cd minesweeper-multiplayer
```

2. **Install Python dependencies:**
```bash
cd server
pip install -r requirements.txt
```

3. **Set environment variables (optional):**
```bash
export SECRET_KEY="your-secret-key-here"
export FLASK_ENV="development"  # for debug mode
export PORT="5000"  # default port
```

### Running Locally

1. **Start the Flask server:**
```bash
cd server
python app.py
```

2. **Open your browser:**
```
http://localhost:5000
```

3. **Play!** Open multiple tabs or share your local IP with friends on the same network.

## 🎮 How to Play

### Solo Mode

1. Enter your username
2. Select "Solo Play"
3. Choose a game mode (Standard, Time Bomb, or Survival)
4. Select difficulty level (Easy, Medium, Hard, Impossible, or Hacker)
5. **Left-click** to reveal tiles
6. **Right-click** to flag suspected mines
7. Press **'H'** for a hint (score penalty applied)
8. Clear all safe tiles to win!

### Multiplayer Mode

**Hosting a Room:**
1. Enter your username
2. Select "Multiplayer"
3. Choose "Host Room"
4. Select game mode and difficulty
5. Share the 6-character room code with friends
6. Wait for players to join
7. Click "Ready" when everyone has joined
8. Game starts when all players are ready!

**Joining a Room:**
1. Enter your username
2. Select "Multiplayer"
3. Choose "Join Room"
4. Enter the room code shared by host
5. Click "Ready"
6. Game starts when all players are ready!

### Controls
| Action | Method |
|--------|--------|
| Reveal cell | Left Click |
| Flag mine | Right Click |
| Use hint | Press 'H' or click Hint button |
| New game | Click "New Game" button |
| Quit game | Click "Quit" button |

## 📁 Project Structure

```
minesweeper-multiplayer/
├── server/
│   ├── app.py                    # Flask backend + Socket.IO server
│   ├── requirements.txt          # Python dependencies
│   └── web/
│       ├── index.html            # Main HTML structure
│       ├── game.js               # Game logic and rendering
│       └── styles.css            # Styling and animations
├── BUGS_FOUND_AND_FIXED.md       # Bug documentation
├── FEATURES_WISHLIST.md          # Future features brainstorm
└── README.md                     # This file
```

### Key Files Explained

- **`app.py`** - Flask server with Socket.IO for real-time multiplayer
- **`index.html`** - UI structure with multiple screens (username, mode select, lobby, game)
- **`game.js`** - Canvas rendering, game logic, WebSocket communication
- **`styles.css`** - Glassmorphic UI styling with animations

## 🎲 Game Modes Explained

### 📊 Standard Mode
Classic minesweeper where you reveal numbers indicating nearby mines. Clear all safe tiles to win!

**Difficulty Levels:**
- **Easy**: 16×16, 40 mines (15.6%)
- **Medium**: 16×16, 64 mines (25.0%)
- **Hard**: 16×16, 89 mines (34.8%)
- **Impossible**: 16×16, 115 mines (44.9%)
- **Hacker**: 16×16, 140 mines (54.7%)

**Scoring:** Base score = tiles revealed, with time bonuses for fast completion

### ⏰ Time Bomb Mode
Same as Standard but with a countdown timer! Each revealed tile adds time based on difficulty.

**Time Modifiers:**
- Easy: +1.0s per tile
- Medium: +0.5s per tile
- Hard: +0.2s per tile
- Impossible: +0.05s per tile
- Hacker: +0.01s per tile

**Starting Time:** 15 seconds (run out of time = game over!)

### 🏃 Survival Mode
Progressive difficulty mode where each completed level makes the board larger and more dangerous.

**Progression:**
```
Level 1:  8×8  = 64 tiles,  10 mines (15%)
Level 2: 10×10 = 100 tiles, 18 mines (18%)
Level 3: 12×12 = 144 tiles, 29 mines (20%)
Level 4: 14×14 = 196 tiles, 44 mines (22%)
Level 5: 16×16 = 256 tiles, 58 mines (23%)
...continues until death
```

**Scoring:** Total tiles revealed across all levels

### 🎲 Russian Roulette Mode (Multiplayer Only)
Turn-based elimination mode where numbers are hidden! Pure luck-based gameplay.

**Rules:**
- Players take turns revealing tiles
- Only your turn shows whose move it is
- Hit a mine = eliminated from the round
- Last player standing wins
- No hints available (they would reveal the hidden numbers!)

## 🌐 Deployment

This project is configured for deployment on **Railway** (or any platform supporting Python + WebSockets).

### Deploy to Railway

1. Fork this repository to your GitHub account
2. Sign up for [Railway](https://railway.app/) (free tier available)
3. Create a new project and select "Deploy from GitHub repo"
4. Select your forked repository
5. Railway will automatically detect the Python app and deploy it
6. Set environment variables in Railway dashboard:
   - `SECRET_KEY` - Generate a secure random key
   - `PORT` - Railway will auto-assign this
7. Your app will be live at `https://your-app-name.up.railway.app`

### Other Deployment Options

The app can be deployed to any platform supporting Python + WebSockets:
- **Render** - Supports WebSockets out of the box
- **Heroku** - Add `Procfile`: `web: gunicorn --worker-class eventlet -w 1 app:app`
- **DigitalOcean App Platform** - Full WebSocket support
- **Google Cloud Run** - Requires WebSocket configuration

## 🛠️ Technology Stack

### Backend
- **Flask 3.0** - Python web framework
- **Flask-SocketIO 5.3** - WebSocket implementation for real-time communication
- **Flask-CORS** - Cross-origin resource sharing
- **Eventlet** - Async networking library
- **Gunicorn** - Production WSGI server

### Frontend
- **HTML5 Canvas** - Game board rendering
- **Vanilla JavaScript** - No framework overhead for optimal performance
- **CSS3** - Modern glassmorphic styling with backdrop-filter
- **Socket.IO Client** - Real-time WebSocket communication

### Infrastructure
- **Railway/Render** - Cloud hosting platform
- **In-memory storage** - Current state management
- **PostgreSQL** - Planned database migration

## 📊 API Endpoints

### REST API
- `GET /` - Serve web client
- `GET /health` - Server health check for monitoring
- `GET /api/rooms/list` - List all active game rooms
- `GET /api/leaderboard/global?difficulty={all|Easy|Medium|Hard|Impossible|Hacker}` - Get leaderboard
- `POST /api/leaderboard/submit` - Submit score to global leaderboard

### WebSocket Events

**Client → Server:**
- `create_room` - Create new game room with settings
- `join_room` - Join existing room by code
- `leave_room` - Leave current room
- `player_ready` - Mark player as ready to start
- `game_action` - Send game move (reveal/flag)
- `game_finished` - Report game completion with score

**Server → Client:**
- `connected` - Connection established with session ID
- `room_created` - Room successfully created
- `room_joined` - Successfully joined room
- `player_joined` - Another player joined your room
- `player_left` - Player left the room
- `player_ready_update` - Player ready status changed
- `game_start` - Game starting with board seed
- `player_action` - Another player made a move
- `player_finished` - Player completed the game
- `player_eliminated` - Player eliminated (Russian Roulette)
- `turn_changed` - Turn changed (Russian Roulette)
- `game_ended` - All players finished, show results
- `error` - Error message

## 🐛 Known Issues & Bug Reports

See [BUGS_FOUND_AND_FIXED.md](./BUGS_FOUND_AND_FIXED.md) for comprehensive documentation including:
- 11 fixed bugs with detailed explanations
- 9 identified potential issues
- Prioritization recommendations
- Technical implementation details

**Recently Fixed:**
- ✅ Button visibility (white text on white background)
- ✅ Floating-point timer precision issues
- ✅ Multiplayer board synchronization
- ✅ Username masking in multiplayer comparisons
- ✅ Hints working in Russian Roulette mode
- ✅ Survival mode reset issues
- ✅ Ready button state management

**Known Limitations:**
- Canvas size not responsive on mobile (<600px screens)
- No quit confirmation dialog
- No reconnection logic for dropped connections
- In-memory storage (data lost on server restart)

## 💡 Feature Wishlist & Roadmap

See [FEATURES_WISHLIST.md](./FEATURES_WISHLIST.md) for extensive brainstorming including:
- 6+ new game mode concepts (Fog of War, Sabotage, Co-op, Speed Chess, etc.)
- 25+ quality of life improvements
- UI/UX enhancements
- Social features (friends, chat, clans)
- Progression systems (achievements, ranks)
- Competitive features (tournaments, ELO)

### Short-term (1-2 weeks)
- [ ] Mobile responsive canvas sizing
- [ ] Quit confirmation dialog
- [ ] Timer display for Standard mode
- [ ] Color-coded difficulty names
- [ ] Cell hover effects

### Medium-term (1-2 months)
- [ ] PostgreSQL database integration
- [ ] User authentication system
- [ ] Achievement system
- [ ] Daily challenges
- [ ] Better mobile touch controls

### Long-term (3+ months)
- [ ] Ranked mode with ELO rating
- [ ] Replay system for learning
- [ ] Friend system and private lobbies
- [ ] New game modes (Fog of War, Co-op)
- [ ] Native mobile apps

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Report Bugs
Open an issue with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Browser/device information
- Screenshots if applicable

### Suggest Features
Open an issue with:
- Feature description and benefits
- Use case examples
- Implementation ideas (optional)

### Submit Pull Requests
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (solo and multiplayer modes)
5. Commit with clear messages
6. Push to your fork
7. Open a pull request

### Development Guidelines
- Follow existing code style
- Test all game modes before submitting
- Update documentation for new features
- Add comments for complex logic
- Keep commits atomic and focused

## 🔒 Security

- Uses secure session management with Flask-SocketIO
- Room codes generated with `secrets` module for cryptographic randomness
- Environment-based secret key configuration
- CORS properly configured for production
- Input validation on room codes and usernames
- No sensitive data stored in client-side code

**Note:** Currently uses in-memory storage. For production at scale, migrate to PostgreSQL for persistent data and session recovery.

## 📊 Performance

- **Lightweight** - Vanilla JavaScript with no framework overhead
- **Efficient rendering** - HTML5 Canvas optimized for smooth gameplay
- **Low latency** - WebSocket communication for real-time updates
- **Scalable** - Optimized for 2-6 concurrent players per room
- **Horizontally scalable** - Can run multiple server instances

## 📝 License

This project is licensed under the MIT License - free to use, modify, and distribute!

## 🙏 Acknowledgments

- Built with assistance from [Claude Code](https://claude.com/claude-code)
- Inspired by classic Windows Minesweeper
- Community feedback and bug reports
- Open source libraries and frameworks

## 📧 Contact & Links

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/minesweeper-multiplayer/issues)
- **GitHub Repo**: [https://github.com/yourusername/minesweeper-multiplayer](https://github.com/yourusername/minesweeper-multiplayer)
- **Live Demo**: *[Add your Railway/Render URL here after deployment]*

---

**Made with 💣 and ❤️ by the Minesweeper Community**

*Star this repo if you enjoy the game!* ⭐

**Tech Stack:** Python • Flask • Socket.IO • HTML5 Canvas • Vanilla JS • Railway
