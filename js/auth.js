import { db, auth } from './firebase-config.js?v=5';
import { collection, setDoc, getDoc, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Check if user is already logged in
const checkAuth = () => {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser && !window.location.href.includes('chat.html') && !window.location.href.includes('admin.html')) {
        window.location.href = 'chat.html';
    }
};



// Helper to resize avatar
const resizeAvatar = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 120;
                const MAX_HEIGHT = 120;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85)); // 85% JPEG quality
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

// DOM Elements
const profileSetupForm = document.getElementById('form-profile-setup');
const adminForm = document.getElementById('form-admin');

// Google Sign-In Helper (shared by both login and register Google buttons)
const handleGoogleSignIn = async (btn, errorDiv, buttonLabel) => {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="border-top-color: #4285F4; border-color: rgba(66,133,244,.3);"></span>';
    if (errorDiv) errorDiv.innerText = '';

    const googleSvg = `
        <svg viewBox="0 0 24 24" width="20" height="20" style="margin-right: 10px; flex-shrink: 0;">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>`;

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Check if user already exists in Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            // Existing user — login directly
            const userData = userDocSnap.data();

            await updateDoc(userDocRef, {
                status: 'online',
                lastSeen: serverTimestamp()
            });

            localStorage.setItem('currentUser', JSON.stringify({
                docId: user.uid,
                userId: user.uid,
                fullName: userData.fullName,
                email: user.email,
                phoneNumber: userData.phoneNumber || '',
                profilePic: userData.profilePic || user.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
            }));

            window.location.href = 'chat.html';
        } else {
            // New user — show profile setup, pre-fill with Google data
            const setupName = document.getElementById('setup-fullname');
            const avatarPreview = document.getElementById('avatar-preview');

            if (setupName && user.displayName) {
                setupName.value = user.displayName;
            }
            if (avatarPreview && user.photoURL) {
                avatarPreview.src = user.photoURL;
                window._googlePhotoURL = user.photoURL;
            }

            if (typeof window.switchTab === 'function') {
                window.switchTab('setup');
            }
        }
    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            if (errorDiv) errorDiv.innerText = error.message || 'Google sign-in failed. Please try again.';
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = googleSvg + ' ' + buttonLabel;
    }
};

// Login page Google button
const googleBtn = document.getElementById('btn-google-signin');
if (googleBtn) {
    googleBtn.addEventListener('click', () => {
        handleGoogleSignIn(googleBtn, document.getElementById('google-error'), 'Sign in with Google');
    });
}

// "Create a New Account" button (also uses Google sign-in)
const googleRegBtn = document.getElementById('btn-google-register');
if (googleRegBtn) {
    googleRegBtn.addEventListener('click', () => {
        handleGoogleSignIn(googleRegBtn, document.getElementById('google-error'), 'Create a New Account');
    });
}

// 2. Profile Setup Form Submit (Complete Registration)
if (profileSetupForm) {
    profileSetupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-complete-setup');
        const errorDiv = document.getElementById('setup-error');
        const fullName = document.getElementById('setup-fullname').value.trim();
        const phoneNumber = document.getElementById('setup-phone').value.trim();

        if (fullName.toLowerCase() === 'admin') {
            errorDiv.innerText = 'Cannot register as Admin.';
            return;
        }

        if (!phoneNumber.startsWith('+') || phoneNumber.length < 10) {
            errorDiv.innerText = 'Include country code starting with + (e.g. +919999999999).';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        errorDiv.innerText = '';

        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error("No authenticated session found. Please login again.");
            }

            // Handle Profile picture upload & resizing
            const fileInput = document.getElementById('setup-profile-pic');
            let profilePicUrl = window._googlePhotoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; // default or Google avatar
            window._googlePhotoURL = null; // clear after use

            if (fileInput && fileInput.files && fileInput.files[0]) {
                btn.innerHTML = 'Processing Image...';
                try {
                    profilePicUrl = await resizeAvatar(fileInput.files[0]);
                } catch (err) {
                    console.error("Error resizing avatar:", err);
                }
                btn.innerHTML = '<span class="spinner"></span>';
            }

            // Save user document in Firestore under users/{uid}
            const userDocRef = doc(db, "users", user.uid);
            const newUserData = {
                userId: user.uid,
                fullName: fullName,
                phoneNumber: phoneNumber,
                email: user.email,
                status: 'online',
                lastSeen: serverTimestamp(),
                profilePic: profilePicUrl
            };

            await setDoc(userDocRef, newUserData);

            // Store in LocalStorage
            localStorage.setItem('currentUser', JSON.stringify({
                docId: user.uid,
                userId: user.uid,
                fullName: fullName,
                email: user.email,
                phoneNumber: phoneNumber,
                profilePic: profilePicUrl
            }));

            window.location.href = 'chat.html';
        } catch (error) {
            console.error("Error creating user profile:", error);
            errorDiv.innerText = error.message || 'An error occurred during profile setup.';
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Complete Registration';
        }
    });
}

// 3. Admin Portal Login Submit
if (adminForm) {
    adminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('admin-error');
        const adminUser = document.getElementById('admin-fullname').value.trim();
        const adminPass = document.getElementById('admin-password').value;

        if (adminUser === 'Admin' && adminPass === 'Admin@0022') {
            localStorage.setItem('adminAuth', 'true');
            window.location.href = 'admin.html';
        } else {
            errorDiv.innerText = 'Invalid username or password.';
        }
    });
}

// Initial triggers
checkAuth();

export { checkAuth };
