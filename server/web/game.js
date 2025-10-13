// Configuration
const SERVER_URL = 'https://minesweeper-server-production-ecec.up.railway.app';

// Game State
const state = {
    username: '',
    displayUsername: '', // Display name (masked for ICantLose cheat)
    mode: 'solo', // 'solo' or 'multiplayer'
    gameMode: 'standard', // 'standard', 'luck', 'timebomb', 'survival'
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
    timerInterval: null,
    tilesClicked: 0, // Track tiles clicked for new scoring system
    totalGameClicks: 0, // For multiplayer: total clicks from all players

    // Time Bomb mode variables
    timebombDifficulty: 'medium', // 'easy', 'medium', 'hard', 'impossible', 'hacker'
    timeRemaining: 60, // Countdown timer
    timebombStartTime: { easy: 90, medium: 60, hard: 45, impossible: 30, hacker: 20 },
    timebombTimeBonus: { easy: 1.0, medium: 0.5, hard: 0.2, impossible: 0.05, hacker: 0.01 }, // Seconds per tile

    // Survival mode variables
    survivalLevel: 1,
    survivalTotalTiles: 0,
    survivalMineCount: 40,
    survivalBaseMines: 40,
    survivalMineIncrease: 5 // Add 5 more mines per level
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
    document.getElementById('solo-btn').addEventListener('click', () => showScreen('gamemode-screen'));
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

            // Time Bomb mode needs difficulty selection first
            if (mode === 'timebomb') {
                showScreen('timebomb-difficulty-screen');
                return;
            }

            // Check if we're in solo or multiplayer flow
            if (state.socket && state.socket.connected) {
                createRoom(mode);
            } else {
                startSoloGame(mode);
            }
        });
    });
    document.getElementById('back-to-lobby2').addEventListener('click', () => {
        // Back to lobby if multiplayer, otherwise back to mode selection
        if (state.socket && state.socket.connected) {
            showScreen('lobby-screen');
        } else {
            showScreen('mode-screen');
        }
    });

    // Time Bomb difficulty selection
    document.querySelectorAll('.select-difficulty').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const difficulty = e.target.closest('.mode-card').dataset.difficulty;
            state.timebombDifficulty = difficulty;

            // Check if we're in solo or multiplayer flow
            if (state.socket && state.socket.connected) {
                createRoom('timebomb');
            } else {
                startSoloGame('timebomb');
            }
        });
    });
    document.getElementById('back-to-gamemode').addEventListener('click', () => {
        showScreen('gamemode-screen');
    });

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

    // ICantLose cheat: Mask the username for display purposes
    if (username.toLowerCase() === 'icantlose') {
        // Toxic/cocky usernames
        const toxicNames = [
            'RUEVNTRYNG?', 'EZWIN', 'UshouldPracticeMore', 'uhhhhisthatit?',
            'TooEZ4Me', 'GetGoodKid', 'NiceAttemptTho', 'IsThisEasyMode?',
            'YallTryingRight?', 'LiterallyAFK', 'OneHandedBTW', 'DidntEvenTry',
            'WasThatSupposedToBeHard', 'ImNotEvenWarmedUp', 'zzzzz',
            'WakeUpPeople', 'ThisIsTrainingMode?', 'CanIGetASmurf',
            'MyGrandmaBetter', 'PlayingWithFeet', 'MiceOnlyChallenge',
            'FirstTimeAndWhat', 'AmIPlayingBots?', 'YallSeriousRN',
            'TryHarderNextTime', 'LaggedForThat', 'AlmostHadMe',
            'NiceWarmup', 'BackToTutorial', 'UninstallPls', 'Outplayed',
            'SkillDiff', 'TouchGrassMaybe', 'GGNoRe', 'ThanksForTheWin',
            'StillLearning?', 'BetterLuckNextGame', 'ICarriedTbh',
            'SoloQueueThings', 'NeedAHandicap?', 'YawnFest',
            'WhatsMinesweeper', 'JustClickedRandom', 'BlindPlaythrough',
            'ControllerDisconnected', 'WrongGameBro', 'CasualPlayers',
            'WhereTheChallenge', 'ThisWasRanked?', 'FreeElo',
            'NoSweatGG', 'HowYouLoseThat', 'MustBeLagging', 'Built Different',
            'WasEatingBTW', 'PhoneInOtherHand', 'WatchingNetflix',
            'TabbledOut', 'MyDogPlayingRN', 'AutoPilotMode',
            'CantBelieveYouTried', 'NoCompetition', 'FreeLobby',
            'WhereTheSkilled1s', 'ThisTheMainEvent?', 'DefinitelyNotTrying',
            'CanILeaveYet', 'ThatsAllYouGot?', 'ExpectedMore',
            'BackToTheMenu', 'NextVictimPls', 'SpeedrunningLife',
            'ClickClickWin', 'WhyYouMad?', 'SomeoneSalty?', 'StayMadKid',
            'CryAboutIt', 'CopeHarder', 'Malding', 'BigMad',
            'ActuallyEZ', 'NotEvenClose', 'DominatedLOL', 'Stomped',
            'DestroyedYou', 'ClappedCheeks', 'GetRekt', 'Demolished',
            'Bodied', 'Destroyed', 'Annihilated', 'Wrecked',
            'RanThrough', 'DiffedHard', 'GapIsHuge', 'MilesAhead',
            'NotMyLevel', 'OutOfYourLeague', 'DifferentTier', 'SmurfingUnranked',
            'HowYouThisBad', 'UseTutorial', 'PracticeVsBots', 'WatchAGuide',
            'LearnTheGame', 'StopEmbarrassing', 'DeleteTheGame', 'TryAnotherGame'
        ];
        state.displayUsername = toxicNames[Math.floor(Math.random() * toxicNames.length)];
    } else {
        state.displayUsername = username;
    }

    showScreen('mode-screen');
}

function startSoloGame(gameMode = 'standard') {
    state.mode = 'solo';
    state.gameMode = gameMode;
    showScreen('game-screen');
    document.getElementById('username-display').textContent = state.displayUsername;
    document.getElementById('room-display').textContent = '';

    // Reset survival level when starting fresh
    if (gameMode === 'survival') {
        state.survivalLevel = 1;
        state.survivalTotalTiles = 0;
        state.survivalMineCount = state.survivalBaseMines;
    }

    // Set title based on game mode
    if (gameMode === 'luck') {
        document.getElementById('leaderboard-title').textContent = 'Russian Roulette';
    } else if (gameMode === 'timebomb') {
        document.getElementById('leaderboard-title').textContent = `Time Bomb - ${state.timebombDifficulty.toUpperCase()}`;
    } else if (gameMode === 'survival') {
        document.getElementById('leaderboard-title').textContent = 'Survival - Level 1';
    } else {
        document.getElementById('leaderboard-title').textContent = 'Standard';
    }

    resetGame();
    updateTurnIndicator(); // Show turn indicator for special modes
    loadLeaderboard(); // Load leaderboard for this game mode
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
        // Increment total clicks for multiplayer scoring
        if (data.action === 'reveal') {
            state.totalGameClicks++;
        }
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
        username: state.displayUsername, // Use display name for multiplayer
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
        username: state.displayUsername // Use display name for multiplayer
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
    document.getElementById('username-display').textContent = state.displayUsername;
    document.getElementById('room-display').textContent = `Room: ${state.roomCode}`;

    // Show game mode name in title
    let modeTitle = 'Multiplayer';
    if (state.gameMode === 'luck') modeTitle = 'Russian Roulette';
    else if (state.gameMode === 'timebomb') modeTitle = `Time Bomb - ${state.timebombDifficulty.toUpperCase()}`;
    else if (state.gameMode === 'survival') modeTitle = 'Survival';
    else if (state.gameMode === 'standard') modeTitle = 'Standard Race';
    document.getElementById('leaderboard-title').textContent = modeTitle;

    // Seed random for consistent board
    Math.seedrandom = (seed) => {
        const m = 2 ** 35 - 31;
        const a = 185852;
        let s = seed % m;
        return () => (s = s * a % m) / m;
    };

    resetGame();
    updateTurnIndicator();
    loadGlobalLeaderboard(); // Load global leaderboard for this mode
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');

    if (state.gameMode === 'timebomb') {
        // Show countdown timer for Time Bomb mode
        const timeClass = state.timeRemaining <= 10 ? 'time-critical' : '';
        indicator.textContent = `⏰ TIME: ${state.timeRemaining}s`;
        indicator.className = `turn-indicator ${timeClass}`;
        indicator.style.display = 'block';
    } else if (state.gameMode === 'survival') {
        // Show survival level
        indicator.textContent = `🏃 Level ${state.survivalLevel} | ${state.survivalMineCount} Mines`;
        indicator.className = 'turn-indicator';
        indicator.style.display = 'block';
    } else if (state.gameMode === 'luck') {
        if (state.mode === 'solo') {
            indicator.textContent = '🎲 Russian Roulette - No Numbers!';
            indicator.className = 'turn-indicator';
            indicator.style.display = 'block';
        } else if (state.currentTurn) {
            if (state.currentTurn === state.username) {
                indicator.textContent = '🎯 YOUR TURN!';
                indicator.className = 'turn-indicator';
                indicator.style.display = 'block';
            } else {
                indicator.textContent = `⏳ ${state.currentTurn}'s turn`;
                indicator.className = 'turn-indicator';
                indicator.style.display = 'block';
            }
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
    state.tilesClicked = 0;
    state.totalGameClicks = 0;

    if (state.timerInterval) clearInterval(state.timerInterval);

    // Initialize Time Bomb mode countdown
    if (state.gameMode === 'timebomb') {
        state.timeRemaining = state.timebombStartTime[state.timebombDifficulty];
        // ICantLose cheat: infinite time
        if (state.username.toLowerCase() === 'icantlose') {
            state.timeRemaining = 9999;
        }
    }

    // Initialize Survival mode
    if (state.gameMode === 'survival') {
        // Reset to level 1 only if this is a fresh game (not a level progression)
        if (!state.survivalLevel || state.survivalLevel === 1) {
            state.survivalLevel = 1;
            state.survivalTotalTiles = 0;
            state.survivalMineCount = state.survivalBaseMines;
        }
        // Update difficulty to use survival mine count
        state.difficulty.mines = state.survivalMineCount;
    }

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
    updateTurnIndicator();
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

function revealCell(row, col, isUserClick = true) {
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

        // Start appropriate timer based on game mode
        if (state.gameMode === 'timebomb') {
            state.timerInterval = setInterval(updateTimeBombTimer, 1000);
        } else {
            state.timerInterval = setInterval(updateTimer, 1000);
        }
        placeMines(row, col);
    }

    // Time Bomb: Add time bonus ONLY for direct user clicks (not flood fill)
    if (state.gameMode === 'timebomb' && !cell.isMine && isUserClick && state.username.toLowerCase() !== 'icantlose') {
        state.timeRemaining += state.timebombTimeBonus[state.timebombDifficulty];
        updateTurnIndicator();
    }

    if (cell.isMine) {
        // ICantLose cheat: Skip mine death
        if (state.username.toLowerCase() === 'icantlose') {
            // Just reveal the mine but don't die
            cell.isMine = false;
            cell.adjacentMines = 0;
            // Recalculate adjacent numbers for nearby cells
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = row + dr;
                    const c = col + dc;
                    if (r >= 0 && r < state.difficulty.rows && c >= 0 && c < state.difficulty.cols) {
                        if (!state.board[r][c].isMine) {
                            let count = 0;
                            for (let dr2 = -1; dr2 <= 1; dr2++) {
                                for (let dc2 = -1; dc2 <= 1; dc2++) {
                                    if (dr2 === 0 && dc2 === 0) continue;
                                    const r2 = r + dr2;
                                    const c2 = c + dc2;
                                    if (r2 >= 0 && r2 < state.difficulty.rows && c2 >= 0 && c2 < state.difficulty.cols) {
                                        if (state.board[r2][c2].isMine) count++;
                                    }
                                }
                            }
                            state.board[r][c].adjacentMines = count;
                        }
                    }
                }
            }
            updateStats();
            drawBoard();
            checkWin();
            return;
        }

        state.gameOver = true;
        revealAllMines();
        calculateScore(); // Calculate score based on clicks

        if (state.mode === 'multiplayer' && state.gameMode === 'luck') {
            state.socket.emit('game_action', { action: 'eliminated', row, col, clicks: state.tilesClicked });
        }

        drawBoard();
        if (state.mode === 'solo') {
            // Show level reached in Survival mode
            if (state.gameMode === 'survival') {
                setTimeout(() => showGameResult(false, state.score, `Level ${state.survivalLevel} Complete!`), 500);
            } else {
                setTimeout(() => showGameResult(false, state.score), 500);
            }
        }
        return;
    }

    // Only count safe tiles (not mines) for scoring
    state.tilesClicked++;
    state.totalGameClicks++;

    // Send action to server if multiplayer
    if (state.mode === 'multiplayer' && state.gameStarted) {
        state.socket.emit('game_action', { action: 'reveal', row, col, clicks: state.tilesClicked });
    }

    // Update stats display
    updateStats();

    // Flood fill if no adjacent mines (not in Luck Mode)
    if (state.gameMode !== 'luck' && cell.adjacentMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                revealCell(row + dr, col + dc, false); // Pass false = not a user click
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

    const wasFlagged = cell.isFlagged;
    cell.isFlagged = !cell.isFlagged;
    state.flagsPlaced += cell.isFlagged ? 1 : -1;

    // Time Bomb: Add +1 second for placing flag (not removing, not for cheat username)
    if (state.gameMode === 'timebomb' && cell.isFlagged && !wasFlagged && state.username.toLowerCase() !== 'icantlose') {
        state.timeRemaining += 1;
        updateTurnIndicator();
    }

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

    // Survival mode: Advance to next level
    if (state.gameMode === 'survival' && state.mode === 'solo') {
        advanceSurvivalLevel();
        return;
    }

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

function advanceSurvivalLevel() {
    // Update total tiles for final score
    state.survivalTotalTiles += state.tilesClicked;

    // Advance level
    state.survivalLevel++;
    state.survivalMineCount = state.survivalBaseMines + (state.survivalLevel - 1) * state.survivalMineIncrease;

    // Cap at reasonable max (board can only fit 256 - safe tiles)
    const maxMines = (state.difficulty.rows * state.difficulty.cols) - 20; // Keep at least 20 safe tiles
    if (state.survivalMineCount > maxMines) {
        state.survivalMineCount = maxMines;
    }

    // Update difficulty
    state.difficulty.mines = state.survivalMineCount;

    // Update title
    document.getElementById('leaderboard-title').textContent = `Survival - Level ${state.survivalLevel}`;

    // Show level up message briefly
    const indicator = document.getElementById('turn-indicator');
    indicator.textContent = `🎉 LEVEL ${state.survivalLevel}! 🎉`;
    indicator.className = 'turn-indicator';
    indicator.style.display = 'block';

    // Reset board state for new level
    state.gameWon = false;
    state.firstClick = true;
    state.flagsPlaced = 0;
    state.tilesClicked = 0;

    // Clear and refill board
    for (let row = 0; row < state.difficulty.rows; row++) {
        for (let col = 0; col < state.difficulty.cols; col++) {
            state.board[row][col] = {
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                adjacentMines: 0
            };
        }
    }

    drawBoard();
    updateStats();

    // Reset indicator after 2 seconds
    setTimeout(() => {
        updateTurnIndicator();
    }, 2000);
}

function calculateScore() {
    // New click-based scoring system
    if (state.mode === 'solo') {
        // Survival mode: score = total tiles across all levels
        if (state.gameMode === 'survival') {
            state.score = state.survivalTotalTiles + state.tilesClicked;
        } else {
            // Solo: score = tiles clicked (whether won or lost)
            state.score = state.tilesClicked;
        }
    } else {
        // Multiplayer: winner gets total clicks from all players
        if (state.gameWon) {
            state.score = state.totalGameClicks;
        } else {
            state.score = state.tilesClicked;
        }
    }
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
    // Update timer display to show clicks instead
    document.getElementById('timer').textContent = `Clicks: ${state.tilesClicked}`;
}

function updateTimer() {
    if (state.startTime && !state.gameOver) {
        state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
        // Display clicks instead of time
        document.getElementById('timer').textContent = `Clicks: ${state.tilesClicked}`;
    }
}

function updateTimeBombTimer() {
    if (state.gameOver) return;

    // Countdown timer for Time Bomb mode
    state.timeRemaining--;
    updateTurnIndicator();

    // Time's up! Game over
    if (state.timeRemaining <= 0) {
        state.gameOver = true;
        state.timeRemaining = 0;
        revealAllMines();
        calculateScore();
        drawBoard();
        setTimeout(() => showGameResult(false, state.score, 'Time\'s Up!'), 500);
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

    resultScore.textContent = score > 0 ? `Tiles Clicked: ${score}` : '';
    overlay.classList.add('active');

    // Submit score to leaderboard for solo games
    if (state.mode === 'solo' && score > 0) {
        submitScoreToBackend(won, score);
    }
}

// Leaderboard Backend Integration
async function submitScoreToBackend(won, score) {
    try {
        const response = await fetch(`${SERVER_URL}/api/leaderboard/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: state.displayUsername,
                score: score,
                time: state.elapsedTime,
                difficulty: state.gameMode, // Use gameMode as difficulty filter
                hints_used: 3 - state.hintsRemaining,
                won: won
            })
        });
        const data = await response.json();
        console.log('Score submitted to leaderboard:', data);
    } catch (error) {
        console.error('Failed to submit score to leaderboard:', error);
    }
}

async function loadLeaderboard() {
    if (state.mode === 'solo') {
        loadGlobalLeaderboard();
    }
}

async function loadGlobalLeaderboard() {
    try {
        const response = await fetch(
            `${SERVER_URL}/api/leaderboard/global?difficulty=${state.gameMode}`
        );
        const data = await response.json();
        displayGlobalLeaderboard(data.leaderboard);
    } catch (error) {
        console.error('Failed to load global leaderboard:', error);
    }
}

function displayGlobalLeaderboard(scores) {
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = '';

    if (scores.length === 0) {
        leaderboard.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No scores yet. Be the first!</p>';
        return;
    }

    scores.slice(0, 10).forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-entry';

        // Add medal for top 3
        let medal = '';
        if (index === 0) medal = '🥇 ';
        else if (index === 1) medal = '🥈 ';
        else if (index === 2) medal = '🥉 ';

        div.innerHTML = `
            <span>${medal}${index + 1}. ${entry.username}</span>
            <span>${entry.score} tiles</span>
        `;
        leaderboard.appendChild(div);
    });
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
