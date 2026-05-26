import { db, auth } from './firebase-config.js?v=4';
import { collection, setDoc, getDoc, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Check if user is already logged in
const checkAuth = () => {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser && !window.location.href.includes('chat.html') && !window.location.href.includes('admin.html')) {
        window.location.href = 'chat.html';
    }
};

// Check for redirect link on load
const handleEmailSignInRedirect = async () => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            // Prompt user for email if not found in local storage (e.g. opened in different browser)
            email = window.prompt('Please enter your email to confirm sign-in:');
        }

        if (!email) {
            alert('Email verification required to complete sign-in.');
            return;
        }

        try {
            const result = await signInWithEmailLink(auth, email, window.location.href);
            const user = result.user;

            // Remove stored email
            window.localStorage.removeItem('emailForSignIn');

            // Clean query params from address bar
            window.history.replaceState({}, document.title, window.location.pathname);

            // Look up user in Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();

                // Set user to online
                await updateDoc(userDocRef, {
                    status: 'online',
                    lastSeen: serverTimestamp()
                });

                // Store in localStorage
                localStorage.setItem('currentUser', JSON.stringify({
                    docId: user.uid,
                    userId: user.uid,
                    fullName: userData.fullName,
                    email: user.email,
                    phoneNumber: userData.phoneNumber || '',
                    profilePic: userData.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
                }));

                window.location.href = 'chat.html';
            } else {
                // User is registering for the first time
                if (typeof window.switchTab === 'function') {
                    window.switchTab('setup');
                }
            }
        } catch (error) {
            console.error("Error completing email sign-in:", error);
            alert("This sign-in link is invalid or has expired. Please request a new link.");
        }
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
const emailForm = document.getElementById('form-email');
const profileSetupForm = document.getElementById('form-profile-setup');
const adminForm = document.getElementById('form-admin');

// 1. Email Form Submit (Send Link)
if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-send-link');
        const errorDiv = document.getElementById('email-error');
        const email = document.getElementById('login-email').value.trim();

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        errorDiv.innerText = '';

        try {
            const actionCodeSettings = {
                // Must point back to index.html and be authorized in Firebase Console (default localhost is authorized)
                url: window.location.href.split('?')[0],
                handleCodeInApp: true
            };

            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);

            document.getElementById('display-email-addr').innerText = email;
            if (typeof window.switchTab === 'function') {
                window.switchTab('sent');
            }
        } catch (error) {
            console.error("Error sending sign-in link:", error);
            errorDiv.innerText = error.message || 'Failed to send login link. Please try again.';
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Send Sign-In Link';
        }
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
            let profilePicUrl = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; // default avatar

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
handleEmailSignInRedirect();

export { checkAuth };
