import { db } from './firebase-config.js';
import { collection, getDocs, deleteDoc, doc, query, onSnapshot, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Basic Auth check for Admin
if (!localStorage.getItem('adminAuth') && window.location.pathname.includes('admin.html')) {
    // Just a fallback in case someone accesses directly
    const pwd = prompt("Enter Admin Password:");
    if (pwd !== 'Admin@0022') {
        window.location.href = 'index.html';
    } else {
        localStorage.setItem('adminAuth', 'true');
    }
}

// DOM Elements
const navLinks = document.querySelectorAll('.admin-nav a');
const sections = document.querySelectorAll('.admin-section');
const btnLogout = document.getElementById('btn-admin-logout');

const statUsers = document.getElementById('stat-users');
const statChats = document.getElementById('stat-chats');
const statMessages = document.getElementById('stat-messages');

const usersTableBody = document.getElementById('users-table-body');
const chatsTableBody = document.getElementById('chats-table-body');

const btnClearAllUsers = document.getElementById('btn-clear-all-users');
const btnClearAllChats = document.getElementById('btn-clear-all-chats');

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');
        
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

// Logout
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('adminAuth');
        window.location.href = 'index.html';
    });
}

// Format time
const formatTime = (timestamp) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleString();
};

// Data Listeners
const initAdmin = () => {
    // Listen Users
    onSnapshot(collection(db, "users"), (snapshot) => {
        statUsers.innerText = snapshot.size;
        usersTableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const user = { docId: docSnap.id, ...docSnap.data() };
            if (!user.fullName || user.fullName.toLowerCase() === 'admin') return; // Skip admin if in db
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${user.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="admin-avatar"></td>
                <td>${user.fullName}</td>
                <td><span style="color: ${user.status === 'online' ? 'var(--wa-green-light)' : 'inherit'}">${user.status}</span></td>
                <td>
                    <button class="btn-danger btn-small" onclick="deleteUser('${user.docId}', '${user.userId}')">Delete User</button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
    }, (error) => {
        console.error("Firestore onSnapshot error (users):", error);
    });

    // Listen Chats
    onSnapshot(collection(db, "chats"), (snapshot) => {
        statChats.innerText = snapshot.size;
        chatsTableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const chat = { docId: docSnap.id, ...docSnap.data() };
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${chat.docId.substring(0, 15)}...</td>
                <td>${chat.lastMessage || 'N/A'}</td>
                <td>${formatTime(chat.lastMessageTime)}</td>
                <td>
                    <button class="btn-danger btn-small" onclick="deleteChat('${chat.docId}')">Delete Chat</button>
                </td>
            `;
            chatsTableBody.appendChild(tr);
        });
    }, (error) => {
        console.error("Firestore onSnapshot error (chats):", error);
    });

    // Listen Messages count
    onSnapshot(collection(db, "messages"), (snapshot) => {
        statMessages.innerText = snapshot.size;
    }, (error) => {
        console.error("Firestore onSnapshot error (messages):", error);
    });
};

// Global Functions for inline onclick handlers
window.deleteUser = async (docId, userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
        await deleteDoc(doc(db, "users", docId));
        alert('User deleted.');
    } catch (e) {
        console.error(e);
        alert('Error deleting user.');
    }
};

window.deleteChat = async (chatId) => {
    if (!confirm('Are you sure you want to delete this chat and all its messages?')) return;
    try {
        // Delete messages in chat
        const q = query(collection(db, "messages"), where("chatId", "==", chatId));
        const qs = await getDocs(q);
        const delPromises = [];
        qs.forEach((d) => delPromises.push(deleteDoc(doc(db, "messages", d.id))));
        await Promise.all(delPromises);
        
        // Delete chat document
        await deleteDoc(doc(db, "chats", chatId));
        
        alert('Chat deleted.');
    } catch (e) {
        console.error(e);
        alert('Error deleting chat.');
    }
};

// Clear All Handlers
if (btnClearAllUsers) {
    btnClearAllUsers.addEventListener('click', async () => {
        if (!confirm('WARNING: This will delete ALL users. Are you sure?')) return;
        try {
            const qs = await getDocs(collection(db, "users"));
            const delPromises = [];
            qs.forEach((d) => delPromises.push(deleteDoc(doc(db, "users", d.id))));
            await Promise.all(delPromises);
            alert('All users cleared.');
        } catch (e) {
            console.error(e);
            alert('Error clearing users.');
        }
    });
}

if (btnClearAllChats) {
    btnClearAllChats.addEventListener('click', async () => {
        if (!confirm('WARNING: This will delete ALL chats AND messages. Are you sure?')) return;
        try {
            // Delete all messages
            const msgs = await getDocs(collection(db, "messages"));
            const delMsgPromises = [];
            msgs.forEach((d) => delMsgPromises.push(deleteDoc(doc(db, "messages", d.id))));
            await Promise.all(delMsgPromises);

            // Delete all chats
            const chats = await getDocs(collection(db, "chats"));
            const delChatPromises = [];
            chats.forEach((d) => delChatPromises.push(deleteDoc(doc(db, "chats", d.id))));
            await Promise.all(delChatPromises);

            alert('All chats and messages cleared.');
        } catch (e) {
            console.error(e);
            alert('Error clearing chats.');
        }
    });
}

// Start
initAdmin();
