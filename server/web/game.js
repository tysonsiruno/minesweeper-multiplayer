// Configuration
const SERVER_URL = 'https://minesweeper-server-production-ecec.up.railway.app';

// Game State
const state = {
    username: '',
    displayUsername: '', // Display name (masked for ICantLose cheat)
    mode: 'solo', // 'solo' or 'multiplayer'
    gameMode: 'standard', // 'standard', 'luck', 'timebomb', 'survival'
    currentScreen: 'login-screen',
    socket: null,
    roomCode: null,
    players: [],
    gameStarted: false,
    currentTurn: null,
    seededRandom: null, // Store seeded random for multiplayer

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
    hoverCell: null, // Track cell under cursor
    score: 0,
    timerInterval: null,
    tilesClicked: 0, // Track tiles clicked for new scoring system
    totalGameClicks: 0, // For multiplayer: total clicks from all players
    soundEnabled: true, // Sound system toggle

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

    // Recalculate canvas size on window resize
    window.addEventListener('resize', () => {
        if (state.currentScreen === 'game-screen') {
            initCanvas();
            drawBoard();
        }
    });
});

function setupEventListeners() {
    // Helper to prevent both touch and click from firing
    let touchHandled = false;
    const preventClickAfterTouch = () => {
        touchHandled = true;
        setTimeout(() => { touchHandled = false; }, 500);
    };

    // Mode selection - with proper mobile support
    const soloBtn = document.getElementById('solo-btn');
    if (soloBtn) {
        soloBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preventClickAfterTouch();
            console.log('Solo button TOUCH');
            state.mode = 'solo';
            showScreen('gamemode-screen');
        }, { passive: false });

        soloBtn.addEventListener('click', (e) => {
            if (touchHandled) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            console.log('Solo button CLICK');
            state.mode = 'solo';
            showScreen('gamemode-screen');
        });
        console.log('✓ Solo button listeners attached');
    } else {
        console.error('✗ solo-btn NOT FOUND');
    }

    const multiplayerBtn = document.getElementById('multiplayer-btn');
    if (multiplayerBtn) {
        multiplayerBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preventClickAfterTouch();
            console.log('Multiplayer button TOUCH');
            state.mode = 'multiplayer';
            showMultiplayerLobby();
        }, { passive: false });

        multiplayerBtn.addEventListener('click', (e) => {
            if (touchHandled) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            console.log('Multiplayer button CLICK');
            state.mode = 'multiplayer';
            showMultiplayerLobby();
        });
        console.log('✓ Multiplayer button listeners attached');
    } else {
        console.error('✗ multiplayer-btn NOT FOUND');
    }

    const backToMainBtn = document.getElementById('back-to-main');
    if (backToMainBtn) {
        backToMainBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preventClickAfterTouch();
            console.log('Back button TOUCH');
            showScreen('main-screen');
        }, { passive: false });

        backToMainBtn.addEventListener('click', (e) => {
            if (touchHandled) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            console.log('Back button CLICK');
            showScreen('main-screen');
        });
        console.log('✓ Back button listeners attached');
    } else {
        console.error('✗ back-to-main NOT FOUND');
    }

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

    // Game mode selection - with proper mobile support (prevent double-fire)
    document.querySelectorAll('.select-mode').forEach(btn => {
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preventClickAfterTouch();
            const mode = e.target.closest('.mode-card').dataset.mode;
            console.log('Mode selected (TOUCH):', mode);

            // Time Bomb mode needs difficulty selection first
            if (mode === 'timebomb') {
                showScreen('timebomb-difficulty-screen');
                return;
            }

            // Check if we're already in a room (post-game mode selection)
            if (state.roomCode && state.socket && state.socket.connected) {
                // Change mode in existing room
                state.socket.emit('change_game_mode', { game_mode: mode });
            } else if (state.socket && state.socket.connected) {
                // Create new room
                createRoom(mode);
            } else {
                // Solo mode
                startSoloGame(mode);
            }
        }, { passive: false });

        btn.addEventListener('click', (e) => {
            if (touchHandled) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            const mode = e.target.closest('.mode-card').dataset.mode;
            console.log('Mode selected (CLICK):', mode);

            // Time Bomb mode needs difficulty selection first
            if (mode === 'timebomb') {
                showScreen('timebomb-difficulty-screen');
                return;
            }

            // Check if we're already in a room (post-game mode selection)
            if (state.roomCode && state.socket && state.socket.connected) {
                // Change mode in existing room
                state.socket.emit('change_game_mode', { game_mode: mode });
            } else if (state.socket && state.socket.connected) {
                // Create new room
                createRoom(mode);
            } else {
                // Solo mode
                startSoloGame(mode);
            }
        });
    });

    const backToLobby2Btn = document.getElementById('back-to-lobby2');
    if (backToLobby2Btn) {
        backToLobby2Btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preventClickAfterTouch();
            console.log('Back to lobby2 (TOUCH)');
            if (state.socket && state.socket.connected) {
                showScreen('lobby-screen');
            } else {
                showScreen('mode-screen');
            }
        }, { passive: false });

        backToLobby2Btn.addEventListener('click', (e) => {
            if (touchHandled) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            console.log('Back to lobby2 (CLICK)');
            if (state.socket && state.socket.connected) {
                showScreen('lobby-screen');
            } else {
                showScreen('mode-screen');
            }
        });
    }

    // Time Bomb difficulty selection - with proper mobile support (prevent double-fire)
    document.querySelectorAll('.select-difficulty').forEach(btn => {
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preventClickAfterTouch();
            const difficulty = e.target.closest('.mode-card').dataset.difficulty;
            state.timebombDifficulty = difficulty;
            console.log('Difficulty selected (TOUCH):', difficulty);

            // Check if we're already in a room (post-game mode selection)
            if (state.roomCode && state.socket && state.socket.connected) {
                // Change mode in existing room
                state.socket.emit('change_game_mode', { game_mode: 'timebomb' });
            } else if (state.socket && state.socket.connected) {
                // Create new room
                createRoom('timebomb');
            } else {
                // Solo mode
                startSoloGame('timebomb');
            }
        }, { passive: false });

        btn.addEventListener('click', (e) => {
            if (touchHandled) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            const difficulty = e.target.closest('.mode-card').dataset.difficulty;
            state.timebombDifficulty = difficulty;
            console.log('Difficulty selected (CLICK):', difficulty);

            // Check if we're already in a room (post-game mode selection)
            if (state.roomCode && state.socket && state.socket.connected) {
                // Change mode in existing room
                state.socket.emit('change_game_mode', { game_mode: 'timebomb' });
            } else if (state.socket && state.socket.connected) {
                // Create new room
                createRoom('timebomb');
            } else {
                // Solo mode
                startSoloGame('timebomb');
            }
        });
    });

    const backToGamemodeBtn = document.getElementById('back-to-gamemode');
    if (backToGamemodeBtn) {
        backToGamemodeBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            preventClickAfterTouch();
            console.log('Back to gamemode (TOUCH)');
            showScreen('gamemode-screen');
        }, { passive: false });

        backToGamemodeBtn.addEventListener('click', (e) => {
            if (touchHandled) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            console.log('Back to gamemode (CLICK)');
            showScreen('gamemode-screen');
        });
    }

    // Waiting room
    document.getElementById('ready-btn').addEventListener('click', markReady);
    document.getElementById('leave-room-btn').addEventListener('click', leaveRoom);

    // Game controls
    document.getElementById('hint-btn').addEventListener('click', useHint);
    document.getElementById('new-game-btn').addEventListener('click', handleNewGame);
    document.getElementById('mute-btn').addEventListener('click', toggleSound);
    document.getElementById('quit-btn').addEventListener('click', quitGame);
    document.getElementById('result-ok-btn').addEventListener('click', () => {
        document.getElementById('result-overlay').classList.remove('active');

        // In multiplayer, host picks next mode, others wait
        if (state.mode === 'multiplayer') {
            // Check if we're the host (first player in the room)
            const isHost = state.players.length > 0 && state.players[0].username === state.displayUsername;

            if (isHost) {
                // Host goes to mode selection
                showScreen('gamemode-screen');
            } else {
                // Non-host goes to waiting room
                showWaitingRoom();
            }
        }
    });

    document.getElementById('shortcuts-ok-btn').addEventListener('click', () => {
        document.getElementById('shortcuts-overlay').classList.remove('active');
    });

    // Canvas events
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('contextmenu', handleCanvasRightClick);

    // Mouse hover effect
    canvas.addEventListener('mousemove', (e) => {
        const CANVAS_BORDER_WIDTH = 3;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - CANVAS_BORDER_WIDTH;
        const y = e.clientY - rect.top - CANVAS_BORDER_WIDTH;

        const col = Math.floor(x / state.cellSize);
        const row = Math.floor(y / state.cellSize);

        // Bounds checking to prevent hover outside board
        if (row < 0 || row >= state.difficulty.rows || col < 0 || col >= state.difficulty.cols) {
            if (state.hoverCell !== null) {
                state.hoverCell = null;
                drawBoard();
            }
            return;
        }

        // Only update if hover cell changed
        if (!state.hoverCell || state.hoverCell.row !== row || state.hoverCell.col !== col) {
            state.hoverCell = { row, col };
            drawBoard();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        state.hoverCell = null;
        drawBoard();
    });

    // Touch events for mobile
    let touchStartTime = 0;
    let touchStartPos = null;
    const CANVAS_BORDER_WIDTH = 3; // Canvas has 3px border in CSS

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchStartTime = Date.now();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();

        // Account for border width - subtract border from coordinates
        const x = touch.clientX - rect.left - CANVAS_BORDER_WIDTH;
        const y = touch.clientY - rect.top - CANVAS_BORDER_WIDTH;

        touchStartPos = { x, y };

        console.log('Touch start:', { x, y, cellSize: state.cellSize });
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (!touchStartPos) return;

        const touchDuration = Date.now() - touchStartTime;
        const col = Math.floor(touchStartPos.x / state.cellSize);
        const row = Math.floor(touchStartPos.y / state.cellSize);

        // Bounds checking - ensure we're within the board
        if (row < 0 || row >= state.difficulty.rows || col < 0 || col >= state.difficulty.cols) {
            console.log('Touch out of bounds:', { row, col, rows: state.difficulty.rows, cols: state.difficulty.cols });
            touchStartPos = null;
            return;
        }

        console.log('Touch end:', { row, col, duration: touchDuration, username: state.username });

        if (touchDuration > 500) {
            // Long press = flag
            toggleFlag(row, col);
        } else {
            // Quick tap = reveal
            if (!state.gameOver && state.hintCell && state.hintCell.row === row && state.hintCell.col === col) {
                state.hintCell = null;
            }
            revealCell(row, col);
        }

        touchStartPos = null;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Global shortcuts
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            const overlay = document.getElementById('shortcuts-overlay');
            overlay.classList.toggle('active');
        }

        if (e.key === 'Escape') {
            document.getElementById('shortcuts-overlay').classList.remove('active');
            document.getElementById('result-overlay').classList.remove('active');
        }

        // Game screen shortcuts
        if (state.currentScreen === 'game-screen') {
            if (e.key === 'h' || e.key === 'H') useHint();
        }
    });
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (!screen) {
        console.error(`Screen not found: ${screenId}`);
        return;
    }
    screen.classList.add('active');
    state.currentScreen = screenId;

    // Initialize username when entering main screen
    if (screenId === 'main-screen') {
        initializeUsername();
    }

    // Populate profile data when entering profile screen
    if (screenId === 'profile-screen') {
        populateProfile();
    }
}

/**
 * Initialize username from authentication state
 * Called when user enters main screen after login/guest mode
 */
function initializeUsername() {
    // Get account username from auth.js (for stats)
    const accountUsername = getCurrentUsername();

    // Get display name from localStorage (what players see)
    const displayName = localStorage.getItem('display_name') || accountUsername;

    // Store account username for stats tracking
    state.accountUsername = accountUsername;

    // Use display name for gameplay
    state.username = displayName;

    // ICantLose cheat: Mask the username for display purposes
    if (displayName.toLowerCase() === 'icantlose') {
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
        state.displayUsername = displayName;
    }
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

    // Disable buttons until connected
    document.getElementById('create-room-btn').disabled = true;
    document.getElementById('join-room-btn').disabled = true;

    connectToServer();
}

function connectToServer() {
    if (state.socket) return;

    document.getElementById('connection-status').textContent = 'Connecting to server...';

    state.socket = io(SERVER_URL);

    state.socket.on('connect', () => {
        console.log('Connected to server');
        const statusEl = document.getElementById('connection-status');
        if (statusEl) statusEl.textContent = '✅ Connected to server';
        const createBtn = document.getElementById('create-room-btn');
        if (createBtn) createBtn.disabled = false;
        const joinBtn = document.getElementById('join-room-btn');
        if (joinBtn) joinBtn.disabled = false;
    });

    state.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        const statusEl = document.getElementById('connection-status');
        if (statusEl) statusEl.textContent = '❌ Disconnected from server';
    });

    state.socket.on('room_created', (data) => {
        if (!data || !data.room_code) {
            console.error('Invalid room_created data:', data);
            return;
        }
        state.roomCode = data.room_code;
        state.gameMode = data.game_mode || 'standard';
        showWaitingRoom();
    });

    state.socket.on('room_joined', (data) => {
        if (!data || !data.room_code) {
            console.error('Invalid room_joined data:', data);
            return;
        }
        state.roomCode = data.room_code;
        state.players = data.players || [];
        showWaitingRoom();
    });

    state.socket.on('player_joined', (data) => {
        state.players = data.players;
        updatePlayersList();
    });

    state.socket.on('player_left', (data) => {
        if (data.players) {
            state.players = data.players;
        }
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
        if (!data || !data.action) {
            console.error('Invalid player_action data:', data);
            return;
        }

        // Handle other players' actions
        console.log(`Player ${data.username} performed action: ${data.action} at (${data.row}, ${data.col})`);

        // Validate row/col bounds before accessing board
        if (data.action === 'reveal' && data.row !== undefined && data.col !== undefined) {
            if (data.row < 0 || data.row >= state.difficulty.rows || data.col < 0 || data.col >= state.difficulty.cols) {
                console.error('player_action out of bounds:', data);
                return;
            }

            // SYNC FIX: If this is the first click in multiplayer, place mines with the same exclusion zone
            if (state.firstClick && state.mode === 'multiplayer') {
                state.firstClick = false;
                state.startTime = Date.now();

                // Start appropriate timer based on game mode
                if (state.gameMode === 'timebomb') {
                    state.timerInterval = setInterval(updateTimeBombTimer, 1000);
                } else {
                    state.timerInterval = setInterval(updateTimer, 1000);
                }

                // Place mines using the first player's click coordinates for consistent board
                placeMines(data.row, data.col);
                console.log('Mines placed from player_action at:', data.row, data.col);
            }

            // ONLY sync cell reveals in Russian Roulette (turn-based mode)
            // In Standard Race, each player plays their own board independently
            if (state.gameMode === 'luck') {
                const cell = state.board[data.row][data.col];
                if (cell && !cell.isRevealed) {
                    cell.isRevealed = true;
                    state.totalGameClicks++;
                    drawBoard();
                }
            }
        } else if (data.action === 'flag' && data.row !== undefined && data.col !== undefined) {
            if (data.row < 0 || data.row >= state.difficulty.rows || data.col < 0 || data.col >= state.difficulty.cols) {
                console.error('player_action out of bounds:', data);
                return;
            }

            // ONLY sync flags in Russian Roulette mode
            if (state.gameMode === 'luck') {
                const cell = state.board[data.row][data.col];
                if (cell && !cell.isRevealed) {
                    cell.isFlagged = !cell.isFlagged;
                    drawBoard();
                }
            }
        }
    });

    state.socket.on('turn_changed', (data) => {
        console.log('Turn changed:', { oldTurn: state.currentTurn, newTurn: data.current_turn, myUsername: state.displayUsername });
        state.currentTurn = data.current_turn;
        updateTurnIndicator();
        drawBoard(); // Redraw to show any visual changes
    });

    state.socket.on('player_finished', (data) => {
        if (!data || !data.players) {
            console.error('Invalid player_finished data:', data);
            return;
        }
        state.players = data.players;
        updateLeaderboard();
    });

    state.socket.on('game_ended', (data) => {
        if (!data || !data.results || !Array.isArray(data.results) || data.results.length === 0) {
            console.error('Invalid game_ended data:', data);
            return;
        }
        const results = data.results;
        const myResult = results.find(p => p.username === state.displayUsername);
        const won = results[0] && results[0].username === state.displayUsername;
        showGameResult(won, myResult ? myResult.score : 0);
    });

    state.socket.on('player_eliminated', (data) => {
        console.log('Player eliminated:', data.username);
        // Don't show result here - wait for game_ended event
        // This just notifies that a player died
        // The game_ended event will show the final results
    });

    state.socket.on('error', (data) => {
        const message = data && data.message ? data.message : 'Unknown error occurred';
        console.log('Server error:', message);

        // If on join screen, show error there
        if (state.currentScreen === 'join-screen') {
            const errorEl = document.getElementById('join-error');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.style.color = '#ff6b6b'; // Red error color
            }
        } else {
            alert('Error: ' + message);
        }
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
    // Trim whitespace
    const roomCode = document.getElementById('room-code-input').value.trim();

    console.log('Joining room with code:', roomCode);

    if (!roomCode || roomCode.length !== 6 || !/^\d{6}$/.test(roomCode)) {
        document.getElementById('join-error').textContent = 'Please enter a valid 6-digit room code';
        return;
    }

    // Check socket connection
    if (!state.socket || !state.socket.connected) {
        document.getElementById('join-error').textContent = 'Not connected to server. Please go back to lobby and try again.';
        console.error('Socket not connected:', { socket: state.socket, connected: state.socket?.connected });
        return;
    }

    // Clear any error messages and show loading state
    document.getElementById('join-error').textContent = 'Joining room...';
    document.getElementById('join-error').style.color = '#667eea';

    console.log('Emitting join_room event:', { room_code: roomCode, username: state.displayUsername });

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

    // Re-enable ready button for next room
    document.getElementById('ready-btn').disabled = false;
    document.getElementById('ready-btn').textContent = 'Ready';

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

    // Seed random for consistent board across players
    state.seededRandom = (() => {
        const m = 2 ** 35 - 31;
        const a = 185852;
        let s = boardSeed % m;
        return () => (s = s * a % m) / m;
    })();

    resetGame();
    updateTurnIndicator();
    loadGlobalLeaderboard(); // Load global leaderboard for this mode
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');

    if (state.gameMode === 'timebomb') {
        // Show countdown timer for Time Bomb mode
        const timeClass = state.timeRemaining <= 10 ? 'time-critical' : '';
        // Format time to 1 decimal place to avoid floating point precision errors
        const displayTime = state.timeRemaining.toFixed(1);
        indicator.textContent = `⏰ TIME: ${displayTime}s`;
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
            if (state.currentTurn === state.displayUsername) {
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

    // Calculate responsive cell size based on screen size
    const maxWidth = Math.min(window.innerWidth - 40, 600);  // 20px padding each side, max 600px
    const maxHeight = Math.min(window.innerHeight - 300, 600);  // Leave room for UI, max 600px

    // Calculate cell size that fits screen
    const cellSizeByWidth = Math.floor(maxWidth / state.difficulty.cols);
    const cellSizeByHeight = Math.floor(maxHeight / state.difficulty.rows);

    // Use the smaller dimension to ensure it fits, with min 15px and max 40px
    state.cellSize = Math.max(15, Math.min(cellSizeByWidth, cellSizeByHeight, 40));

    const width = state.difficulty.cols * state.cellSize;
    const height = state.difficulty.rows * state.cellSize;
    canvas.width = width;
    canvas.height = height;
}

function handleNewGame() {
    // New Game button only works in solo mode
    if (state.mode === 'multiplayer') {
        alert('Cannot start new game in multiplayer. Please return to lobby.');
        return;
    }

    // In survival mode, reset to level 1
    if (state.gameMode === 'survival') {
        state.survivalLevel = 1;
        state.survivalTotalTiles = 0;
        state.survivalMineCount = state.survivalBaseMines;
        state.difficulty.mines = state.survivalBaseMines;
        document.getElementById('leaderboard-title').textContent = 'Survival - Level 1';
    }

    resetGame();
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
        // ICantLose cheat: infinite time (works in all modes)
        if (state.username.toLowerCase() === 'icantlose') {
            state.timeRemaining = 9999;
        }
    }

    // Initialize Survival mode (only set mines, level is handled by handleNewGame or advanceSurvivalLevel)
    if (state.gameMode === 'survival') {
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

    // Larger exclusion zone (5x5) to ensure first click always flood fills
    // This guarantees the clicked cell and its neighbors have 0 adjacent mines
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            const r = excludeRow + dr;
            const c = excludeCol + dc;
            if (r >= 0 && r < state.difficulty.rows && c >= 0 && c < state.difficulty.cols) {
                excludeCells.add(`${r},${c}`);
            }
        }
    }

    // Use seeded random for multiplayer, Math.random for solo
    const getRandom = state.mode === 'multiplayer' && state.seededRandom ? state.seededRandom : Math.random;

    while (minesPlaced < state.difficulty.mines) {
        const row = Math.floor(getRandom() * state.difficulty.rows);
        const col = Math.floor(getRandom() * state.difficulty.cols);

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
        if (state.currentTurn !== state.displayUsername) {
            console.log('Not your turn!', { currentTurn: state.currentTurn, displayUsername: state.displayUsername });
            return;
        }
        console.log('Your turn - revealing cell', { row, col });
        // Immediately clear turn to prevent double-clicking before server response
        state.currentTurn = null;
        updateTurnIndicator();
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
    // Skip time bonus for ICantLose cheat (they have infinite time already)
    if (state.gameMode === 'timebomb' && !cell.isMine && isUserClick && state.username.toLowerCase() !== 'icantlose') {
        state.timeRemaining += state.timebombTimeBonus[state.timebombDifficulty];
        updateTurnIndicator();
    }

    if (cell.isMine) {
        // ICantLose cheat: Skip mine death and remove the bomb
        // Works in all modes for trolling purposes - let them figure it out!
        if (state.username.toLowerCase() === 'icantlose') {
            // Just reveal the mine but don't die - convert it to a safe tile
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

        // In multiplayer, notify server that this player died
        if (state.mode === 'multiplayer') {
            state.socket.emit('game_action', { action: 'eliminated', row, col, clicks: state.tilesClicked });
            // Don't show result immediately - wait for server to send game_ended event
        } else {
            // Solo mode - show result immediately
            drawBoard();
            if (state.gameMode === 'survival') {
                setTimeout(() => showGameResult(false, state.score, `Died on Level ${state.survivalLevel}`), 500);
            } else {
                setTimeout(() => showGameResult(false, state.score), 500);
            }
        }

        drawBoard();
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

    // Time Bomb: Add +1 second for placing flag (not removing, not for cheat)
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

    // Hints don't work in Luck Mode since numbers are hidden
    if (state.gameMode === 'luck') {
        alert('Hints are not available in Russian Roulette mode!');
        return;
    }

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

    const CANVAS_BORDER_WIDTH = 3;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left - CANVAS_BORDER_WIDTH;
    const y = e.clientY - rect.top - CANVAS_BORDER_WIDTH;

    const col = Math.floor(x / state.cellSize);
    const row = Math.floor(y / state.cellSize);

    // Bounds checking
    if (row < 0 || row >= state.difficulty.rows || col < 0 || col >= state.difficulty.cols) {
        return;
    }

    if (state.hintCell && state.hintCell.row === row && state.hintCell.col === col) {
        state.hintCell = null;
    }

    revealCell(row, col);
}

function handleCanvasRightClick(e) {
    e.preventDefault();
    if (state.gameOver) return;

    const CANVAS_BORDER_WIDTH = 3;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left - CANVAS_BORDER_WIDTH;
    const y = e.clientY - rect.top - CANVAS_BORDER_WIDTH;

    const col = Math.floor(x / state.cellSize);
    const row = Math.floor(y / state.cellSize);

    // Bounds checking
    if (row < 0 || row >= state.difficulty.rows || col < 0 || col >= state.difficulty.cols) {
        return;
    }

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
                // Hover effect for unrevealed cells
                if (state.hoverCell && state.hoverCell.row === row && state.hoverCell.col === col && !state.gameOver) {
                    ctx.fillStyle = '#7f8c8d';
                } else {
                    ctx.fillStyle = '#95a5a6';
                }
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
    // Show flags placed vs total mines - more intuitive than "mines left"
    document.getElementById('mines-left').textContent = `🚩 Flags: ${state.flagsPlaced}/${state.difficulty.mines}`;
    document.getElementById('hints-left').textContent = `💡 Hints: ${state.hintsRemaining}`;

    // Show time and clicks
    if (state.startTime && !state.gameOver) {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timer').textContent = `⏱️ ${timeStr} | Clicks: ${state.tilesClicked}`;
    } else {
        document.getElementById('timer').textContent = `Clicks: ${state.tilesClicked}`;
    }
}

function updateTimer() {
    if (state.startTime && !state.gameOver) {
        state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
        updateStats(); // Update display with current time
    }
}

function updateTimeBombTimer() {
    if (state.gameOver) return;

    // Countdown timer for Time Bomb mode - use Math.max to prevent negative values
    state.timeRemaining = Math.max(0, state.timeRemaining - 1);
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

    // Show detailed game stats
    const minutes = Math.floor(state.elapsedTime / 60);
    const seconds = state.elapsedTime % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Calculate accuracy (safe clicks / total clicks)
    const totalSafeTiles = (state.difficulty.rows * state.difficulty.cols) - state.difficulty.mines;
    const accuracy = state.tilesClicked > 0 ? Math.round((state.tilesClicked / totalSafeTiles) * 100) : 0;

    resultScore.innerHTML = `
        <div style="margin: 20px 0; line-height: 1.8;">
            <div><strong>Tiles Clicked:</strong> ${score}</div>
            <div><strong>Time Taken:</strong> ${timeStr}</div>
            <div><strong>Flags Placed:</strong> ${state.flagsPlaced}/${state.difficulty.mines}</div>
            <div><strong>Hints Used:</strong> ${3 - state.hintsRemaining}/3</div>
            ${won ? `<div><strong>Completion:</strong> ${accuracy}%</div>` : ''}
        </div>
    `;

    overlay.classList.add('active');

    // Submit score to leaderboard for both solo and multiplayer games
    if (score > 0) {
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

// Sound System
function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    const btn = document.getElementById('mute-btn');
    btn.textContent = state.soundEnabled ? '🔊 Sound' : '🔇 Muted';

    // Save preference to localStorage
    localStorage.setItem('soundEnabled', state.soundEnabled);
}

function playSound(soundType) {
    if (!state.soundEnabled) return;

    // Foundation for future sound implementation
    // soundType can be: 'click', 'flag', 'mine', 'win', 'hint'
    // For now, this is a placeholder that does nothing
    // Future: Add Web Audio API or HTML5 Audio elements

    // Example for future implementation:
    // const audio = new Audio(`/sounds/${soundType}.mp3`);
    // audio.volume = 0.3;
    // audio.play().catch(e => console.log('Audio play failed:', e));
}

// Load sound preference from localStorage on init
document.addEventListener('DOMContentLoaded', () => {
    const savedSound = localStorage.getItem('soundEnabled');
    if (savedSound !== null) {
        state.soundEnabled = savedSound === 'true';
        const btn = document.getElementById('mute-btn');
        if (btn) btn.textContent = state.soundEnabled ? '🔊 Sound' : '🔇 Muted';
    }
});

function quitGame() {
    // Confirm before quitting if game is in progress
    if (state.startTime && !state.gameOver) {
        if (!confirm('Are you sure you want to quit? Your progress will be lost.')) {
            return;
        }
    }

    if (state.timerInterval) clearInterval(state.timerInterval);

    if (state.mode === 'multiplayer') {
        leaveRoom();
        showScreen('lobby-screen');
    } else {
        showScreen('mode-screen');
    }
}

/**
 * Populate profile screen with user data
 */
function populateProfile() {
    const user = getCurrentUser();

    if (!user || typeof getCurrentUser !== 'function') {
        console.warn('Cannot populate profile: user not found or auth.js not loaded');
        showScreen('login-screen');
        return;
    }

    // Populate account info
    document.getElementById('profile-username').textContent = user.username || 'Unknown';
    document.getElementById('profile-email').textContent = user.email || 'N/A';

    // Show verification status
    const verifiedEl = document.getElementById('profile-verified');
    if (user.is_verified) {
        verifiedEl.textContent = '✓ Verified';
        verifiedEl.style.color = '#2ecc71';
        // Hide resend verification button
        document.getElementById('resend-verification-btn').style.display = 'none';
    } else {
        verifiedEl.textContent = '⚠ Not Verified';
        verifiedEl.style.color = '#f1c40f';
        // Show resend verification button
        document.getElementById('resend-verification-btn').style.display = 'block';
    }

    // Show member since date
    const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';
    document.getElementById('profile-created').textContent = createdDate;

    // Populate game statistics
    document.getElementById('profile-games-played').textContent = user.total_games_played || 0;
    document.getElementById('profile-wins').textContent = user.total_wins || 0;
    document.getElementById('profile-losses').textContent = user.total_losses || 0;

    // Calculate and display win rate
    const winRate = user.win_rate || 0;
    document.getElementById('profile-win-rate').textContent = winRate + '%';

    // Show high score
    document.getElementById('profile-high-score').textContent = user.highest_score || 0;
}
