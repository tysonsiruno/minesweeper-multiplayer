/**
 * Authentication Handler for Minesweeper Multiplayer
 * Handles login, registration, token management, and user sessions
 */

const AUTH_API = '/api/auth';

// ============================================================================
// AUTH STATE MANAGEMENT
// ============================================================================

const AuthState = {
    user: null,
    accessToken: null,
    refreshToken: null,
    isGuest: false,
    isAuthenticated: false,
    isVerified: false
};

/**
 * Initialize authentication on page load
 */
function initAuth() {
    // Check for stored tokens
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');

    if (accessToken) {
        AuthState.accessToken = accessToken;
        AuthState.refreshToken = refreshToken;

        // Verify token is still valid
        verifyCurrentUser().then(valid => {
            if (!valid) {
                // Token expired, try to refresh
                refreshAccessToken().catch(() => {
                    // Refresh failed, clear auth
                    clearAuth();
                });
            }
        });
    }

    // Check for URL parameters (email verification, password reset)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (window.location.pathname === '/verify-email' && token) {
        handleEmailVerification(token);
    } else if (window.location.pathname === '/reset-password' && token) {
        showResetPasswordForm(token);
    }
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Save tokens to localStorage
 */
function saveTokens(accessToken, refreshToken) {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
    }
    AuthState.accessToken = accessToken;
    AuthState.refreshToken = refreshToken;
}

/**
 * Clear authentication tokens and state
 */
function clearAuth() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');

    AuthState.user = null;
    AuthState.accessToken = null;
    AuthState.refreshToken = null;
    AuthState.isGuest = false;
    AuthState.isAuthenticated = false;
    AuthState.isVerified = false;
}

/**
 * Get authorization header for API requests
 */
function getAuthHeader() {
    if (AuthState.accessToken) {
        return { 'Authorization': `Bearer ${AuthState.accessToken}` };
    }
    return {};
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken() {
    if (!AuthState.refreshToken) {
        throw new Error('No refresh token available');
    }

    try {
        const response = await fetch(`${AUTH_API}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthState.refreshToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            saveTokens(data.access_token, data.refresh_token);
            return true;
        } else {
            clearAuth();
            return false;
        }
    } catch (error) {
        console.error('Token refresh failed:', error);
        clearAuth();
        return false;
    }
}

/**
 * Verify current user is still valid
 */
async function verifyCurrentUser() {
    try {
        const response = await fetch(`${AUTH_API}/me`, {
            headers: getAuthHeader()
        });

        const data = await response.json();

        if (data.success && data.user) {
            AuthState.user = data.user;
            AuthState.isAuthenticated = true;
            AuthState.isVerified = data.user.is_verified;
            localStorage.setItem('user_data', JSON.stringify(data.user));
            updateUIForAuthState();
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('User verification failed:', error);
        return false;
    }
}

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register a new user account (with retry logic)
 */
async function register(username, email, password, retryCount = 0) {
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');

    // Clear previous messages
    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';

    // Client-side validation
    if (!username || username.length < 3) {
        if (errorEl) {
            errorEl.textContent = 'Username must be at least 3 characters';
            errorEl.style.display = 'block';
        }
        return false;
    }

    if (!email || !email.includes('@')) {
        if (errorEl) {
            errorEl.textContent = 'Please enter a valid email address';
            errorEl.style.display = 'block';
        }
        return false;
    }

    if (!password || password.length < 8) {
        if (errorEl) {
            errorEl.textContent = 'Password must be at least 8 characters';
            errorEl.style.display = 'block';
        }
        return false;
    }

    // Show loading state
    if (errorEl && retryCount === 0) {
        errorEl.textContent = 'Creating account...';
        errorEl.style.color = '#667eea';
        errorEl.style.display = 'block';
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${AUTH_API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.success) {
            if (successEl) {
                successEl.textContent = data.message || 'Registration successful! You can now log in.';
                successEl.style.display = 'block';
            }

            // Hide error message
            if (errorEl) errorEl.style.display = 'none';

            // Clear form
            const usernameEl = document.getElementById('register-username');
            const emailEl = document.getElementById('register-email');
            const passwordEl = document.getElementById('register-password');
            const passwordConfirmEl = document.getElementById('register-password-confirm');
            if (usernameEl) usernameEl.value = '';
            if (emailEl) emailEl.value = '';
            if (passwordEl) passwordEl.value = '';
            if (passwordConfirmEl) passwordConfirmEl.value = '';

            // Switch to login screen after 2 seconds
            setTimeout(() => {
                showScreen('login-screen');
            }, 2000);

            return true;
        } else {
            if (errorEl) {
                errorEl.textContent = data.message || 'Registration failed';
                errorEl.style.color = '#ff6b6b';
                errorEl.style.display = 'block';
            }
            return false;
        }
    } catch (error) {
        console.error('Registration error (attempt ' + (retryCount + 1) + '):', error);

        // Retry logic (max 2 retries)
        if (retryCount < 2 && (error.name === 'AbortError' || error.name === 'TypeError')) {
            console.log('Retrying registration in ' + ((retryCount + 1) * 1000) + 'ms...');
            if (errorEl) {
                errorEl.textContent = 'Connection issue, retrying... (' + (retryCount + 1) + '/2)';
                errorEl.style.color = '#f39c12';
            }
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
            return register(username, email, password, retryCount + 1);
        }

        // Failed after retries
        if (errorEl) {
            errorEl.textContent = 'Network error. Please check your connection and try again.';
            errorEl.style.color = '#ff6b6b';
            errorEl.style.display = 'block';
        }
        return false;
    }
}

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Login with username/email and password (with retry logic)
 */
async function login(usernameOrEmail, password, rememberMe = false, retryCount = 0) {
    const errorEl = document.getElementById('login-error');

    // Clear previous errors
    if (errorEl) errorEl.textContent = '';

    if (!usernameOrEmail || !password) {
        if (errorEl) errorEl.textContent = 'Please enter username and password';
        return false;
    }

    // Show loading state
    if (errorEl && retryCount === 0) {
        errorEl.textContent = 'Logging in...';
        errorEl.style.color = '#667eea';
        errorEl.style.display = 'block';
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${AUTH_API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username_or_email: usernameOrEmail,
                password: password,
                remember_me: rememberMe
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Check if response is OK
        if (!response.ok) {
            console.error('Login HTTP error:', response.status, response.statusText);
        }

        const data = await response.json();

        if (data.success) {
            // Save tokens
            saveTokens(data.access_token, data.refresh_token);

            // Save user data
            AuthState.user = data.user;
            AuthState.isAuthenticated = true;
            AuthState.isVerified = data.user.is_verified;
            localStorage.setItem('user_data', JSON.stringify(data.user));

            // Update UI
            updateUIForAuthState();

            // Show main game screen
            showScreen('main-screen');

            return true;
        } else {
            if (errorEl) {
                errorEl.textContent = data.message || 'Login failed';
                errorEl.style.color = '#ff6b6b';
                errorEl.style.display = 'block';
            }
            return false;
        }
    } catch (error) {
        console.error('Login error (attempt ' + (retryCount + 1) + '):', error);

        // Retry logic (max 2 retries)
        if (retryCount < 2 && (error.name === 'AbortError' || error.name === 'TypeError')) {
            console.log('Retrying login in ' + ((retryCount + 1) * 1000) + 'ms...');
            if (errorEl) {
                errorEl.textContent = 'Connection issue, retrying... (' + (retryCount + 1) + '/2)';
                errorEl.style.color = '#f39c12';
            }
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
            return login(usernameOrEmail, password, rememberMe, retryCount + 1);
        }

        // Failed after retries
        if (errorEl) {
            errorEl.textContent = 'Network error. Please check your connection and try again.';
            errorEl.style.color = '#ff6b6b';
            errorEl.style.display = 'block';
        }
        return false;
    }
}

/**
 * Logout current user
 */
async function logout() {
    try {
        // Call logout endpoint to invalidate session
        if (AuthState.accessToken) {
            await fetch(`${AUTH_API}/logout`, {
                method: 'POST',
                headers: getAuthHeader()
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Clear local auth state
        clearAuth();

        // Update UI
        updateUIForAuthState();

        // Show login screen
        showScreen('login-screen');
    }
}

/**
 * Continue as guest (no account required)
 */
function continueAsGuest() {
    AuthState.isGuest = true;
    AuthState.isAuthenticated = false;

    // Generate random guest username
    const guestId = Math.floor(Math.random() * 10000);
    AuthState.user = {
        username: `Guest${guestId}`,
        is_verified: false
    };

    // Update UI
    updateUIForAuthState();

    // Show main game screen
    showScreen('main-screen');
}

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

/**
 * Handle email verification from URL token
 */
async function handleEmailVerification(token) {
    const messageEl = document.getElementById('verification-message');

    if (messageEl) {
        messageEl.textContent = 'Verifying your email...';
        messageEl.className = 'info-message';
    }

    try {
        const response = await fetch(`${AUTH_API}/verify-email?token=${token}`);
        const data = await response.json();

        if (data.success) {
            if (messageEl) {
                messageEl.textContent = 'Email verified successfully! You can now log in.';
                messageEl.className = 'success-message';
            }

            // Redirect to login after 3 seconds
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        } else {
            if (messageEl) {
                messageEl.textContent = data.message || 'Verification failed';
                messageEl.className = 'error-message';
            }
        }
    } catch (error) {
        console.error('Verification error:', error);
        if (messageEl) {
            messageEl.textContent = 'Network error. Please try again.';
            messageEl.className = 'error-message';
        }
    }
}

/**
 * Resend verification email
 */
async function resendVerificationEmail() {
    if (!AuthState.user || !AuthState.user.email) {
        alert('No email address found. Please log in again.');
        return;
    }

    try {
        const response = await fetch(`${AUTH_API}/resend-verification`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            alert('Verification email sent! Please check your inbox.');
        } else {
            alert(data.message || 'Failed to send verification email');
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        alert('Network error. Please try again.');
    }
}

// ============================================================================
// PASSWORD RESET
// ============================================================================

/**
 * Request password reset email
 */
async function requestPasswordReset(email) {
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');

    // Clear previous messages
    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';

    if (!email || !email.includes('@')) {
        if (errorEl) errorEl.textContent = 'Please enter a valid email address';
        return false;
    }

    try {
        const response = await fetch(`${AUTH_API}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            if (successEl) {
                successEl.textContent = 'If that email exists, a reset link has been sent.';
                successEl.style.display = 'block';
            }
            return true;
        } else {
            if (errorEl) {
                errorEl.textContent = data.message || 'Failed to send reset email';
                errorEl.style.display = 'block';
            }
            return false;
        }
    } catch (error) {
        console.error('Password reset request error:', error);
        if (errorEl) {
            errorEl.textContent = 'Network error. Please try again.';
            errorEl.style.display = 'block';
        }
        return false;
    }
}

/**
 * Reset password with token
 */
async function resetPassword(token, newPassword) {
    const errorEl = document.getElementById('reset-error');
    const successEl = document.getElementById('reset-success');

    // Clear previous messages
    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';

    if (!newPassword || newPassword.length < 8) {
        if (errorEl) errorEl.textContent = 'Password must be at least 8 characters';
        return false;
    }

    try {
        const response = await fetch(`${AUTH_API}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_password: newPassword })
        });

        const data = await response.json();

        if (data.success) {
            if (successEl) {
                successEl.textContent = 'Password reset successful! Redirecting to login...';
                successEl.style.display = 'block';
            }

            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);

            return true;
        } else {
            if (errorEl) {
                errorEl.textContent = data.message || 'Password reset failed';
                errorEl.style.display = 'block';
            }
            return false;
        }
    } catch (error) {
        console.error('Password reset error:', error);
        if (errorEl) {
            errorEl.textContent = 'Network error. Please try again.';
            errorEl.style.display = 'block';
        }
        return false;
    }
}

/**
 * Show reset password form (when coming from email link)
 */
function showResetPasswordForm(token) {
    // Store token for form submission
    window.resetToken = token;

    // Show reset password screen
    showScreen('reset-password-screen');
}

// ============================================================================
// UI UPDATES
// ============================================================================

/**
 * Update UI based on authentication state
 */
function updateUIForAuthState() {
    const usernameDisplays = document.querySelectorAll('.username-display');
    const loginButtons = document.querySelectorAll('.login-required');
    const logoutButtons = document.querySelectorAll('.logout-button');
    const guestNotices = document.querySelectorAll('.guest-notice');
    const verifiedNotices = document.querySelectorAll('.verification-notice');

    if (AuthState.isAuthenticated && AuthState.user) {
        // Show username
        usernameDisplays.forEach(el => {
            el.textContent = AuthState.user.username;
            el.style.display = 'inline';
        });

        // Show logout buttons
        logoutButtons.forEach(el => el.style.display = 'inline-block');

        // Hide login buttons
        loginButtons.forEach(el => el.style.display = 'none');

        // Show verification notice if not verified
        if (!AuthState.isVerified) {
            verifiedNotices.forEach(el => {
                el.textContent = 'Email not verified. Some features may be limited.';
                el.style.display = 'block';
            });
        } else {
            verifiedNotices.forEach(el => el.style.display = 'none');
        }

        // Hide guest notices
        guestNotices.forEach(el => el.style.display = 'none');

    } else if (AuthState.isGuest) {
        // Show guest username
        usernameDisplays.forEach(el => {
            el.textContent = AuthState.user.username;
            el.style.display = 'inline';
        });

        // Show guest notice
        guestNotices.forEach(el => {
            el.textContent = 'Playing as guest. Create an account to save your progress!';
            el.style.display = 'block';
        });

        // Show login buttons
        loginButtons.forEach(el => el.style.display = 'inline-block');

        // Hide logout buttons
        logoutButtons.forEach(el => el.style.display = 'none');

    } else {
        // Not authenticated - show login buttons
        loginButtons.forEach(el => el.style.display = 'inline-block');
        logoutButtons.forEach(el => el.style.display = 'none');
        usernameDisplays.forEach(el => el.style.display = 'none');
        guestNotices.forEach(el => el.style.display = 'none');
        verifiedNotices.forEach(el => el.style.display = 'none');
    }
}

/**
 * Get current username for game
 */
function getCurrentUsername() {
    if (AuthState.user) {
        return AuthState.user.username;
    }
    return 'Guest';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return AuthState.isAuthenticated && !AuthState.isGuest;
}

/**
 * Check if user is verified
 */
function isVerified() {
    return AuthState.isVerified;
}

/**
 * Get current user data
 */
function getCurrentUser() {
    return AuthState.user;
}

// ============================================================================
// FORM HANDLERS
// ============================================================================

/**
 * Handle login form submission
 */
function handleLoginSubmit(e) {
    e.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('login-remember').checked;

    login(username, password, rememberMe);
}

/**
 * Handle registration form submission
 */
function handleRegisterSubmit(e) {
    e.preventDefault();

    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;

    // Check if passwords match
    const errorEl = document.getElementById('register-error');
    if (password !== passwordConfirm) {
        if (errorEl) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.style.display = 'block';
        }
        return;
    }

    register(username, email, password);
}

/**
 * Handle forgot password form submission
 */
function handleForgotPasswordSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('forgot-email').value.trim();
    requestPasswordReset(email);
}

/**
 * Handle reset password form submission
 */
function handleResetPasswordSubmit(e) {
    e.preventDefault();

    const password = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-password-confirm').value;

    if (password !== confirmPassword) {
        const errorEl = document.getElementById('reset-error');
        if (errorEl) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.style.display = 'block';
        }
        return;
    }

    resetPassword(window.resetToken, password);
}

// ============================================================================
// UI HELPERS (for cross-file compatibility)
// ============================================================================

/**
 * Show a specific screen (compatible with game.js)
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize auth on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
