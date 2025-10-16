# 🎮 Minesweeper Multiplayer

A modern, real-time multiplayer minesweeper game with multiple game modes, authentication, and leaderboards.

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![Flask](https://img.shields.io/badge/Flask-2.0+-green)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.5.4-black)

---

## ✨ Features

### Core Features
- ✅ **Real-time Multiplayer** - Play with friends using room codes
- ✅ **4 Unique Game Modes** - Standard, Russian Roulette, Time Bomb, Survival
- ✅ **3 Difficulty Levels** - Easy, Medium, Hard (Standard, Time Bomb, Survival)
- ✅ **User Authentication** - Secure JWT-based auth with bcrypt
- ✅ **Guest Mode** - Play without creating an account
- ✅ **Global Leaderboards** - Track high scores
- ✅ **Responsive Design** - Works on desktop and mobile
- ✅ **Touch Controls** - Long press to flag on mobile

### Security
- 🔒 bcrypt password hashing (cost factor 12)
- 🔒 JWT tokens (15min access, 7-30 day refresh)
- 🔒 Rate limiting on all endpoints
- 🔒 CORS protection
- 🔒 Input sanitization
- 🔒 Account lockout after 5 failed attempts

---

## 🎲 Game Modes

### 1. Standard Mode
Classic minesweeper race with **Easy/Medium/Hard** difficulties:
- **Easy**: 9x9 grid, 10 mines
- **Medium**: 16x16 grid, 40 mines  
- **Hard**: 30x16 grid, 99 mines

### 2. Russian Roulette Mode
Turn-based chaos - no numbers shown! Fixed difficulty (16x16, 40 mines).

### 3. Time Bomb Mode ⏰
Race against time with **5 difficulty levels**:
- **Easy**: 90s start, +1.0s per tile
- **Medium**: 60s start, +0.5s per tile
- **Hard**: 45s start, +0.2s per tile
- **Impossible**: 30s start, +0.05s per tile
- **Hacker**: 20s start, +0.01s per tile

### 4. Survival Mode 🏃
Endless challenge with **Easy/Medium/Hard** difficulties.

---

## 🚀 Quick Start

### Installation
\`\`\`bash
# Clone repo
git clone <repo-url>
cd minesweeper-multiplayer

# Create venv
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run server
cd server
python app.py
\`\`\`

Server runs on http://localhost:5000

### Environment Variables (.env)
\`\`\`bash
SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
DATABASE_URL=sqlite:///minesweeper.db  # or PostgreSQL URL
FLASK_ENV=development
\`\`\`

---

## 🎯 Controls

**Desktop:**
- Left Click - Reveal tile
- Right Click - Flag mine
- H - Use hint
- ? - Show help

**Mobile:**
- Tap - Reveal tile
- Long Press - Flag mine

---

## 📁 Project Structure

\`\`\`
minesweeper-multiplayer/
├── server/
│   ├── app.py              # Flask app & Socket.IO
│   ├── auth.py             # JWT & authentication
│   ├── models.py           # Database models
│   └── web/
│       ├── index.html      # Main HTML
│       ├── game.js         # Game logic
│       ├── auth.js         # Client auth
│       └── styles.css      # Styles
├── requirements.txt
├── README.md
└── .env
\`\`\`

---

## 🐛 Bug Fixes

**ALL 230 BUGS FIXED (100%)!** ✅

See BUGS_FIXED_COMPLETE.md and FINAL_BUG_STATUS.md for details.

---

## 📄 License

MIT License

---

**Made with ❤️ - Last Updated: 2025-10-13**
