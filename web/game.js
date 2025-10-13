// Configuration
const SERVER_URL = 'https://minesweeper-server-production-ecec.up.railway.app';

// Game State
const state = {
    username: '',
    mode: 'solo', // 'solo' or 'multiplayer'
    gameMode: 'standard', // 'standard' or 'luck'
    currentScreen: 'username-screen',
    socket: null,
    roomCode: null,
    players: [],
    gameStarted: false,
    currentTurn: null,

    // Game variables
    difficulty: { name: 'Medium', rows: 16, cols: 16, mines: 40 },
    board: [],
    cellSize: 30,
    firstClick: true,
    gameOver: false,
    gameWon: false,
    startTime: null,
    elapsedTime: 0,
    flagsPlaced: 0,
    hintsRemaining: 3,
    hintCell: null,
    score: 0,
    timerInterval: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initCanvas();
});

function setupEventListeners() {
    // Username screen
    document.getElementById('username-submit').addEventListener('click', submitUsername);
    document.getElementById('username-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitUsername();
    });

    // Mode selection
    document.getElementById('solo-btn').addEventListener('click', () => startSoloGame());
    document.getElementById('multiplayer-btn').addEventListener('click', () => showMultiplayerLobby());
    document.getElementById('back-to-username').addEventListener('click', () => showScreen('username-screen'));

    // Lobby
    document.getElementById('create-room-btn').addEventListener('click', () => showScreen('gamemode-screen'));
    document.getElementById('join-room-btn').addEventListener('click', () => showScreen('join-screen'));
    document.getElementById('back-to-mode').addEventListener('click', () => {
        disconnectSocket();
        showScreen('mode-screen');
    });

    // Join room
    document.getElementById('join-submit').addEventListener('click', joinRoom);
    document.getElementById('room-code-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });
    document.getElementById('back-to-lobby').addEventListener('click', () => showScreen('lobby-screen'));

    // Game mode selection
    document.querySelectorAll('.select-mode').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.closest('.mode-card').dataset.mode;
            createRoom(mode);
        });
    });
    document.getElementById('back-to-lobby2').addEventListener('click', () => showScreen('lobby-screen'));

    // Waiting room
    document.getElementById('ready-btn').addEventListener('click', markReady);
    document.getElementById('leave-room-btn').addEventListener('click', leaveRoom);

    // Game controls
    document.getElementById('hint-btn').addEventListener('click', useHint);
    document.getElementById('new-game-btn').addEventListener('click', resetGame);
    document.getElementById('quit-btn').addEventListener('click', quitGame);
    document.getElementById('result-ok-btn').addEventListener('click', () => {
        document.getElementById('result-overlay').classList.remove('active');
    });

    // Canvas events
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('contextmenu', handleCanvasRightClick);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (state.currentScreen === 'game-screen') {
            if (e.key === 'h' || e.key === 'H') useHint();
        }
    });
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    state.currentScreen = screenId;
}

function submitUsername() {
    const input = document.getElementById('username-input');
    const username = input.value.trim();

    if (!username) {
        alert('Please enter a username');
        return;
    }

    state.username = username;
    showScreen('mode-screen');
}

function startSoloGame() {
    state.mode = 'solo';
    state.gameMode = 'standard';
    showScreen('game-screen');
    document.getElementById('username-display').textContent = state.username;
    document.getElementById('room-display').textContent = '';
    document.getElementById('leaderboard-title').textContent = 'Local Stats';
    resetGame();
}

function showMultiplayerLobby() {
    showScreen('lobby-screen');
    connectToServer();
}

function connectToServer() {
    if (state.socket) return;

    document.getElementById('connection-status').textContent = 'Connecting to server...';

    state.socket = io(SERVER_URL);

    state.socket.on('connect', () => {
        console.log('Connected to server');
        document.getElementById('connection-status').textContent = '✅ Connected to server';
        document.getElementById('create-room-btn').disabled = false;
        document.getElementById('join-room-btn').disabled = false;
    });

    state.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        document.getElementById('connection-status').textContent = '❌ Disconnected from server';
    });

    state.socket.on('room_created', (data) => {
        state.roomCode = data.room_code;
        state.gameMode = data.game_mode;
        showWaitingRoom();
    });

    state.socket.on('room_joined', (data) => {
        state.roomCode = data.room_code;
        state.players = data.players;
        showWaitingRoom();
    });

    state.socket.on('player_joined', (data) => {
        state.players = data.players;
        updatePlayersList();
    });

    state.socket.on('player_left', (data) => {
        updatePlayersList();
    });

    state.socket.on('player_ready_update', (data) => {
        state.players = data.players;
        updatePlayersList();
    });

    state.socket.on('game_start', (data) => {
        state.gameStarted = true;
        state.gameMode = data.game_mode;
        state.currentTurn = data.current_turn;
        startMultiplayerGame(data.board_seed);
    });

    state.socket.on('player_action', (data) => {
        // Handle other players' actions
        console.log(`Player ${data.username} performed action: ${data.action}`);
    });

    state.socket.on('turn_changed', (data) => {
        state.currentTurn = data.current_turn;
        updateTurnIndicator();
    });

    state.socket.on('player_finished', (data) => {
        state.players = data.players;
        updateLeaderboard();
    });

    state.socket.on('game_ended', (data) => {
        const results = data.results;
        const myResult = results.find(p => p.username === state.username);
        const won = results[0].username === state.username;
        showGameResult(won, myResult ? myResult.score : 0);
    });

    state.socket.on('player_eliminated', (data) => {
        if (data.username === state.username) {
            showGameResult(false, 0, 'Eliminated!');
        }
        if (data.winner) {
            showGameResult(data.winner === state.username, 0);
        }
    });

    state.socket.on('error', (data) => {
        alert('Error: ' + data.message);
    });
}

function disconnectSocket() {
    if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
    }
}

function createRoom(gameMode) {
    state.socket.emit('create_room', {
        username: state.username,
        difficulty: 'Medium',
        max_players: 3,
        game_mode: gameMode
    });
}

function joinRoom() {
    const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();

    if (!roomCode || roomCode.length !== 6) {
        document.getElementById('join-error').textContent = 'Please enter a valid 6-character room code';
        return;
    }

    state.socket.emit('join_room', {
        room_code: roomCode,
        username: state.username
    });
}

function showWaitingRoom() {
    showScreen('waiting-screen');
    document.getElementById('display-room-code').textContent = state.roomCode;
    updatePlayersList();
}

function updatePlayersList() {
    const listEl = document.getElementById('players-list');
    listEl.innerHTML = '<h3>Players:</h3>';

    state.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `
            <span>${player.username}</span>
            <span class="${player.ready ? 'player-ready' : ''}">${player.ready ? '✓ Ready' : 'Waiting...'}</span>
        `;
        listEl.appendChild(div);
    });
}

function markReady() {
    state.socket.emit('player_ready', {});
    document.getElementById('ready-btn').disabled = true;
    document.getElementById('ready-btn').textContent = 'Waiting for others...';
}

function leaveRoom() {
    state.socket.emit('leave_room', {});
    state.roomCode = null;
    state.players = [];
    showScreen('lobby-screen');
}

function startMultiplayerGame(boardSeed) {
    state.mode = 'multiplayer';
    showScreen('game-screen');
    document.getElementById('username-display').textContent = state.username;
    document.getElementById('room-display').textContent = `Room: ${state.roomCode}`;
    document.getElementById('leaderboard-title').textContent = 'Race Standings';

    // Seed random for consistent board
    Math.seedrandom = (seed) => {
        const m = 2 ** 35 - 31;
        const a = 185852;
        let s = seed % m;
        return () => (s = s * a % m) / m;
    };

    resetGame();
    updateTurnIndicator();
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (state.gameMode === 'luck' && state.currentTurn) {
        if (state.currentTurn === state.username) {
            indicator.textContent = '🎯 YOUR TURN!';
            indicator.style.display = 'block';
        } else {
            indicator.textContent = `⏳ ${state.currentTurn}'s turn`;
            indicator.style.display = 'block';
        }
    } else {
        indicator.style.display = 'none';
    }
}

// Game Logic
function initCanvas() {
    const canvas = document.getElementById('game-canvas');
    const width = state.difficulty.cols * state.cellSize;
    const height = state.difficulty.rows * state.cellSize;
    canvas.width = width;
    canvas.height = height;
}

function resetGame() {
    state.board = [];
    state.firstClick = true;
    state.gameOver = false;
    state.gameWon = false;
    state.startTime = null;
    state.elapsedTime = 0;
    state.flagsPlaced = 0;
    state.hintsRemaining = 3;
    state.hintCell = null;
    state.score = 0;

    if (state.timerInterval) clearInterval(state.timerInterval);

    // Initialize board
    for (let row = 0; row < state.difficulty.rows; row++) {
        state.board[row] = [];
        for (let col = 0; col < state.difficulty.cols; col++) {
            state.board[row][col] = {
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                adjacentMines: 0
            };
        }
    }

    updateStats();
    drawBoard();
}

function placeMines(excludeRow, excludeCol) {
    let minesPlaced = 0;
    const excludeCells = new Set();

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = excludeRow + dr;
            const c = excludeCol + dc;
            if (r >= 0 && r < state.difficulty.rows && c >= 0 && c < state.difficulty.cols) {
                excludeCells.add(`${r},${c}`);
            }
        }
    }

    while (minesPlaced < state.difficulty.mines) {
        const row = Math.floor(Math.random() * state.difficulty.rows);
        const col = Math.floor(Math.random() * state.difficulty.cols);

        if (!state.board[row][col].isMine && !excludeCells.has(`${row},${col}`)) {
            state.board[row][col].isMine = true;
            minesPlaced++;
        }
    }

    // Calculate adjacent mines
    for (let row = 0; row < state.difficulty.rows; row++) {
        for (let col = 0; col < state.difficulty.cols; col++) {
            if (!state.board[row][col].isMine) {
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const r = row + dr;
                        const c = col + dc;
                        if (r >= 0 && r < state.difficulty.rows && c >= 0 && c < state.difficulty.cols) {
                            if (state.board[r][c].isMine) count++;
                        }
                    }
                }
                state.board[row][col].adjacentMines = count;
            }
        }
    }
}

function revealCell(row, col) {
    if (row < 0 || row >= state.difficulty.rows || col < 0 || col >= state.difficulty.cols) return;

    const cell = state.board[row][col];
    if (cell.isRevealed || cell.isFlagged) return;

    // Check turn in Luck Mode
    if (state.mode === 'multiplayer' && state.gameMode === 'luck') {
        if (state.currentTurn !== state.username) return;
    }

    cell.isRevealed = true;

    if (state.firstClick) {
        state.firstClick = false;
        state.startTime = Date.now();
        state.timerInterval = setInterval(updateTimer, 1000);
        placeMines(row, col);
    }

    if (cell.isMine) {
        state.gameOver = true;
        revealAllMines();

        if (state.mode === 'multiplayer' && state.gameMode === 'luck') {
            state.socket.emit('game_action', { action: 'eliminated', row, col });
        }

        drawBoard();
        if (state.mode === 'solo') {
            setTimeout(() => showGameResult(false, 0), 500);
        }
        return;
    }

    // Send action to server if multiplayer
    if (state.mode === 'multiplayer' && state.gameStarted) {
        state.socket.emit('game_action', { action: 'reveal', row, col });
    }

    // Flood fill if no adjacent mines (not in Luck Mode)
    if (state.gameMode !== 'luck' && cell.adjacentMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                revealCell(row + dr, col + dc);
            }
        }
    }

    checkWin();
    drawBoard();
}

function toggleFlag(row, col) {
    if (row < 0 || row >= state.difficulty.rows || col < 0 || col >= state.difficulty.cols) return;

    const cell = state.board[row][col];
    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    state.flagsPlaced += cell.isFlagged ? 1 : -1;

    if (state.mode === 'multiplayer' && state.gameStarted) {
        state.socket.emit('game_action', { action: 'flag', row, col });
    }

    updateStats();
    drawBoard();
}

function revealAllMines() {
    for (let row = 0; row < state.difficulty.rows; row++) {
        for (let col = 0; col < state.difficulty.cols; col++) {
            if (state.board[row][col].isMine) {
                state.board[row][col].isRevealed = true;
            }
        }
    }
}

function checkWin() {
    for (let row = 0; row < state.difficulty.rows; row++) {
        for (let col = 0; col < state.difficulty.cols; col++) {
            const cell = state.board[row][col];
            if (!cell.isMine && !cell.isRevealed) return;
        }
    }

    state.gameWon = true;
    state.gameOver = true;
    calculateScore();

    if (state.mode === 'multiplayer') {
        state.socket.emit('game_finished', {
            score: state.score,
            time: state.elapsedTime
        });
    } else {
        setTimeout(() => showGameResult(true, state.score), 500);
    }
}

function calculateScore() {
    if (!state.gameWon) {
        state.score = 0;
        return;
    }

    const timeScore = Math.max(0, 1000 - state.elapsedTime * 2);
    const hintBonus = state.hintsRemaining * 100;
    state.score = Math.floor(timeScore + hintBonus);
}

function useHint() {
    if (state.gameOver || !state.startTime || state.hintsRemaining <= 0) return;

    const safeCells = [];
    for (let row = 0; row < state.difficulty.rows; row++) {
        for (let col = 0; col < state.difficulty.cols; col++) {
            const cell = state.board[row][col];
            if (!cell.isRevealed && !cell.isMine && !cell.isFlagged) {
                safeCells.push({ row, col });
            }
        }
    }

    if (safeCells.length > 0) {
        const hint = safeCells[Math.floor(Math.random() * safeCells.length)];
        state.hintCell = hint;
        state.hintsRemaining--;
        updateStats();
        drawBoard();

        setTimeout(() => {
            state.hintCell = null;
            drawBoard();
        }, 2000);
    }
}

function handleCanvasClick(e) {
    if (state.gameOver) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / state.cellSize);
    const row = Math.floor(y / state.cellSize);

    if (state.hintCell && state.hintCell.row === row && state.hintCell.col === col) {
        state.hintCell = null;
    }

    revealCell(row, col);
}

function handleCanvasRightClick(e) {
    e.preventDefault();
    if (state.gameOver) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / state.cellSize);
    const row = Math.floor(y / state.cellSize);

    toggleFlag(row, col);
}

function drawBoard() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < state.difficulty.rows; row++) {
        for (let col = 0; col < state.difficulty.cols; col++) {
            const cell = state.board[row][col];
            const x = col * state.cellSize;
            const y = row * state.cellSize;

            // Cell background
            if (cell.isRevealed) {
                ctx.fillStyle = '#ecf0f1';
            } else {
                ctx.fillStyle = '#95a5a6';
            }
            ctx.fillRect(x, y, state.cellSize - 1, state.cellSize - 1);

            // Hint highlight
            if (state.hintCell && state.hintCell.row === row && state.hintCell.col === col) {
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, state.cellSize - 1, state.cellSize - 1);
            }

            // Content
            if (cell.isRevealed) {
                if (cell.isMine) {
                    // Draw mine
                    ctx.fillStyle = '#e74c3c';
                    ctx.beginPath();
                    ctx.arc(x + state.cellSize / 2, y + state.cellSize / 2, state.cellSize / 4, 0, Math.PI * 2);
                    ctx.fill();
                } else if (cell.adjacentMines > 0 && state.gameMode !== 'luck') {
                    // Draw number (not in Luck Mode)
                    const colors = ['', '#3498db', '#2ecc71', '#e74c3c', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#2c3e50'];
                    ctx.fillStyle = colors[cell.adjacentMines];
                    ctx.font = 'bold ' + (state.cellSize / 2) + 'px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(cell.adjacentMines, x + state.cellSize / 2, y + state.cellSize / 2);
                }
            } else if (cell.isFlagged) {
                // Draw flag
                ctx.fillStyle = '#2ecc71';
                ctx.beginPath();
                ctx.moveTo(x + state.cellSize / 4, y + state.cellSize / 4);
                ctx.lineTo(x + state.cellSize / 4, y + state.cellSize * 3 / 4);
                ctx.lineTo(x + state.cellSize * 3 / 4, y + state.cellSize / 2);
                ctx.closePath();
                ctx.fill();
            }
        }
    }
}

function updateStats() {
    const minesLeft = state.difficulty.mines - state.flagsPlaced;
    document.getElementById('mines-left').textContent = `Mines: ${minesLeft}`;
    document.getElementById('hints-left').textContent = `Hints: ${state.hintsRemaining}`;
}

function updateTimer() {
    if (state.startTime && !state.gameOver) {
        state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
        document.getElementById('timer').textContent = `Time: ${state.elapsedTime}s`;
    }
}

function updateLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = '';

    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);

    sortedPlayers.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-entry';
        div.innerHTML = `
            <span>${index + 1}. ${player.username}</span>
            <span>${player.finished ? player.score + ' pts' : 'Playing...'}</span>
        `;
        leaderboard.appendChild(div);
    });
}

function showGameResult(won, score, customMessage) {
    const overlay = document.getElementById('result-overlay');
    const resultText = document.getElementById('result-text');
    const resultEmoji = document.getElementById('result-emoji');
    const resultScore = document.getElementById('result-score');

    if (customMessage) {
        resultText.textContent = customMessage;
        resultEmoji.textContent = '💀';
    } else if (won) {
        resultText.textContent = 'YOU WIN!';
        resultEmoji.textContent = '🎉';
    } else {
        resultText.textContent = 'Game Over';
        resultEmoji.textContent = '💥';
    }

    resultScore.textContent = score > 0 ? `Score: ${score}` : '';
    overlay.classList.add('active');
}

function quitGame() {
    if (state.timerInterval) clearInterval(state.timerInterval);

    if (state.mode === 'multiplayer') {
        leaveRoom();
        showScreen('lobby-screen');
    } else {
        showScreen('mode-screen');
    }
}
