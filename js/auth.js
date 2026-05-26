import { db } from './firebase-config.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Check if user is already logged in
const checkAuth = () => {
    const currentUser = localStorage.getItem('currentUser');
    // Don't redirect if we are already on chat.html, otherwise redirect
    if (currentUser && !window.location.href.includes('chat.html') && !window.location.href.includes('admin.html')) {
        window.location.href = 'chat.html';
    }
};

// Generate a random ID
const generateId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// DOM Elements
const loginForm = document.getElementById('form-login');
const registerForm = document.getElementById('form-register');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-login');
        const errorDiv = document.getElementById('login-error');
        const fullName = document.getElementById('login-fullname').value.trim();
        const password = document.getElementById('login-password').value;
        
        // Admin redirect bypass
        if(fullName === 'Admin' && password === 'Admin@0022') {
            localStorage.setItem('adminAuth', 'true');
            window.location.href = 'admin.html';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        errorDiv.innerText = '';

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("fullName", "==", fullName), where("password", "==", password));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                errorDiv.innerText = 'Invalid Full Name or Password.';
                btn.disabled = false;
                btn.innerHTML = 'Log In';
            } else {
                let userDoc = null;
                querySnapshot.forEach((doc) => {
                    userDoc = { id: doc.id, ...doc.data() };
                });
                
                // Update status to online
                const userRef = doc(db, "users", userDoc.id);
                await updateDoc(userRef, {
                    status: 'online',
                    lastSeen: serverTimestamp()
                });

                localStorage.setItem('currentUser', JSON.stringify({
                    docId: userDoc.id,
                    userId: userDoc.userId,
                    fullName: userDoc.fullName,
                    profilePic: userDoc.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
                }));
                
                window.location.href = 'chat.html';
            }
        } catch (error) {
            console.error("Error logging in:", error);
            errorDiv.innerText = 'An error occurred. Please try again.';
            btn.disabled = false;
            btn.innerHTML = 'Log In';
        }
    });
}

// Helper to resize avatar to fit inside Firestore document easily (~5-15KB for fast loading)
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

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-register');
        const errorDiv = document.getElementById('register-error');
        const successDiv = document.getElementById('register-success');
        const fullName = document.getElementById('reg-fullname').value.trim();
        const password = document.getElementById('reg-password').value;

        if (fullName.toLowerCase() === 'admin') {
            errorDiv.innerText = 'Cannot register as Admin.';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        errorDiv.innerText = '';
        successDiv.innerText = '';

        try {
            // Check if user already exists
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("fullName", "==", fullName));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                errorDiv.innerText = 'A user with this name already exists.';
                btn.disabled = false;
                btn.innerHTML = 'Register';
                return;
            }

            // Handle profile pic if selected
            const fileInput = document.getElementById('reg-profile-pic');
            let profilePicUrl = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; // Default
            
            if (fileInput && fileInput.files && fileInput.files[0]) {
                btn.innerHTML = 'Processing Image...';
                try {
                    profilePicUrl = await resizeAvatar(fileInput.files[0]);
                } catch(err) {
                    console.error("Error resizing avatar:", err);
                }
                btn.innerHTML = '<span class="spinner"></span>';
            }

            // Create new user
            const userId = generateId();
            const newUser = {
                userId: userId,
                fullName: fullName,
                password: password, // Note: plain text only for this specific assignment requirement
                status: 'offline',
                lastSeen: serverTimestamp(),
                profilePic: profilePicUrl
            };

            await addDoc(usersRef, newUser);
            
            successDiv.innerText = 'Registration successful! You can now log in.';
            registerForm.reset();
            
            // Auto switch to login tab after 2 seconds
            setTimeout(() => {
                if(typeof window.switchTab === 'function') {
                    window.switchTab('login');
                }
            }, 2000);

        } catch (error) {
            console.error("Error registering:", error);
            errorDiv.innerText = 'An error occurred. Please try again.';
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Register';
        }
    });
}

// Run auth check
checkAuth();

export { checkAuth };
