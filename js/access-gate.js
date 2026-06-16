/** Access Gate - Site-wide security code protection */

const ACCESS_CODE_HASH = "9738d1f2e2dc2b0de768d02c841acb0c0ba43c74a1698cf7183b992ebebf1a5e";

const SESSION_KEY = "sk_access_granted";
const SESSION_TOKEN = "verified_session_active";

// Check if already verified this session
const isVerified = () => sessionStorage.getItem(SESSION_KEY) === SESSION_TOKEN;

// Hash a string using SHA-256
const hashCode = async (code) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Create and show the access gate UI
const showAccessGate = () => {
    // Hide page content
    document.body.style.visibility = 'hidden';
    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.id = 'access-gate-overlay';
    overlay.innerHTML = `
        <style>
            #access-gate-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 99999;
                background: linear-gradient(135deg, #0b141a 0%, #1a2a33 50%, #0b141a 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                visibility: visible !important;
            }
            #access-gate-overlay * {
                visibility: visible !important;
            }
            .gate-container {
                background: #1f2c34;
                border-radius: 16px;
                padding: 40px 36px;
                width: 90%;
                max-width: 380px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
                text-align: center;
                animation: gateSlideUp 0.4s ease-out;
            }
            @keyframes gateSlideUp {
                from { opacity: 0; transform: translateY(30px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .gate-lock-icon {
                width: 64px; height: 64px;
                margin: 0 auto 20px;
                background: rgba(0, 168, 132, 0.12);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .gate-lock-icon svg {
                width: 30px; height: 30px;
                stroke: #00a884;
                fill: none;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }
            .gate-title {
                color: #e9edef;
                font-size: 20px;
                font-weight: 500;
                margin-bottom: 8px;
            }
            .gate-subtitle {
                color: #8696a0;
                font-size: 13px;
                line-height: 1.5;
                margin-bottom: 28px;
            }
            .gate-input-wrapper {
                position: relative;
                margin-bottom: 14px;
            }
            .gate-input {
                width: 100%;
                padding: 14px 44px 14px 16px;
                background: #2a3942;
                border: 1.5px solid #3b4a54;
                border-radius: 10px;
                color: #e9edef;
                font-size: 15px;
                outline: none;
                transition: border-color 0.2s;
                box-sizing: border-box;
                letter-spacing: 1px;
            }
            .gate-input:focus {
                border-color: #00a884;
            }
            .gate-input::placeholder {
                color: #5a6b75;
                letter-spacing: 0;
            }
            .gate-toggle-pwd {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                cursor: pointer;
                color: #8696a0;
                padding: 4px;
                display: flex;
                align-items: center;
            }
            .gate-toggle-pwd:hover { color: #e9edef; }
            .gate-error {
                color: #ea4335;
                font-size: 12px;
                min-height: 18px;
                margin-bottom: 12px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .gate-error.visible { opacity: 1; }
            .gate-btn {
                width: 100%;
                padding: 13px;
                background: #00a884;
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s, transform 0.1s;
            }
            .gate-btn:hover { background: #008069; }
            .gate-btn:active { transform: scale(0.98); }
            .gate-btn:disabled {
                background: #3b4a54;
                cursor: not-allowed;
            }
            .gate-shake {
                animation: gateShake 0.4s ease;
            }
            @keyframes gateShake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-8px); }
                40% { transform: translateX(8px); }
                60% { transform: translateX(-5px); }
                80% { transform: translateX(5px); }
            }
            .gate-footer {
                margin-top: 24px;
                color: #5a6b75;
                font-size: 11px;
            }
        </style>
        <div class="gate-container">
            <div class="gate-lock-icon">
                <svg viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>
            <div class="gate-title">Access Restricted</div>
            <div class="gate-subtitle">This app is private. Enter the security code to continue.</div>
            <div class="gate-input-wrapper">
                <input type="password" class="gate-input" id="gate-code-input" placeholder="Enter security code" autocomplete="off" spellcheck="false">
                <button type="button" class="gate-toggle-pwd" id="gate-toggle-pwd" title="Show/Hide">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </div>
            <div class="gate-error" id="gate-error">Incorrect security code. Access denied.</div>
            <button class="gate-btn" id="gate-submit-btn">Unlock</button>
            <div class="gate-footer">🔒 Protected by SkChatApp Security</div>
        </div>
    `;

    document.body.appendChild(overlay);

    // DOM refs
    const input = document.getElementById('gate-code-input');
    const submitBtn = document.getElementById('gate-submit-btn');
    const errorDiv = document.getElementById('gate-error');
    const toggleBtn = document.getElementById('gate-toggle-pwd');
    const container = overlay.querySelector('.gate-container');

    // Toggle password visibility
    toggleBtn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggleBtn.innerHTML = isPassword
            ? `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
            : `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });

    // Verify code
    const verifyCode = async () => {
        const code = input.value.trim();
        if (!code) {
            input.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Verifying...';
        errorDiv.classList.remove('visible');

        const hashed = await hashCode(code);

        if (hashed === ACCESS_CODE_HASH) {
            // Success!
            sessionStorage.setItem(SESSION_KEY, SESSION_TOKEN);
            container.style.transition = 'opacity 0.3s, transform 0.3s';
            container.style.opacity = '0';
            container.style.transform = 'translateY(-20px) scale(0.95)';
            setTimeout(() => {
                overlay.remove();
                document.body.style.visibility = 'visible';
                document.body.style.overflow = '';
            }, 300);
        } else {
            // Failure
            errorDiv.classList.add('visible');
            container.classList.add('gate-shake');
            setTimeout(() => container.classList.remove('gate-shake'), 400);
            submitBtn.disabled = false;
            submitBtn.innerText = 'Unlock';
            input.value = '';
            input.focus();
        }
    };

    submitBtn.addEventListener('click', verifyCode);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyCode();
    });

    // Focus input
    setTimeout(() => input.focus(), 100);
};

// Initialize gate check
const initAccessGate = () => {
    if (isVerified()) {
        // Already verified this session, allow through
        return;
    }
    showAccessGate();
};

// Run immediately
initAccessGate();
