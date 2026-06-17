import { db } from './firebase-config.js';
import { collection, getDocs, deleteDoc, doc, query, onSnapshot, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_HASH = "1f4927a6ba1c3e5b72b165d7c0a14d864340cfe6c446a314d573389a20450cb5";

const hashAdminCode = async (code) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

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
        let pendingCount = 0;
        usersTableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const user = { docId: docSnap.id, ...docSnap.data() };
            if (!user.fullName || user.fullName.toLowerCase() === 'admin') return; // Skip admin if in db
            
            const isApproved = user.isApproved !== false; // If undefined or true, treat as approved
            if (!isApproved) {
                pendingCount++;
            }
            
            const tr = document.createElement('tr');
            const approvalStatus = isApproved 
                ? '<span style="color: var(--wa-green-light); font-weight: 600;">Approved</span>' 
                : '<span style="color: var(--wa-error); font-weight: 600;">Pending Approval</span>';
                
            const approveBtn = isApproved 
                ? `<button class="btn-secondary btn-small" onclick="toggleApproval('${user.docId}', false)">Revoke</button>`
                : `<button class="btn-primary btn-small" style="background-color: var(--wa-green-light); margin-top: 0; width: auto; padding: 6px 12px;" onclick="toggleApproval('${user.docId}', true)">Approve</button>`;
            
            tr.innerHTML = `
                <td><img src="${user.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="admin-avatar"></td>
                <td>
                    <div style="font-weight: 600; color: var(--wa-text-dark);">${user.fullName}</div>
                    <div style="font-size: 12px; color: var(--wa-text-light); margin-top: 2px;">${user.email || 'No email registered'}</div>
                </td>
                <td>${approvalStatus}</td>
                <td>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${approveBtn}
                        <button class="btn-danger btn-small" onclick="deleteUser('${user.docId}', '${user.userId}')">Delete</button>
                    </div>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
        
        const statPending = document.getElementById('stat-pending');
        if (statPending) {
            statPending.innerText = pendingCount;
        }
    }, (error) => {
        console.error("Firestore onSnapshot error (users):", error);
    });

    // Listen Chats
    onSnapshot(collection(db, "chats"), (snapshot) => {
        let size = 0;
        chatsTableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            if (docSnap.id === "SYSTEM_WIPE_METADATA") return;
            size++;
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
        statChats.innerText = size;
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
        
        // Delete all chats associated with this user
        const qChats = query(collection(db, "chats"), where("participants", "array-contains", userId));
        const chatSnaps = await getDocs(qChats);
        const delChatPromises = [];
        chatSnaps.forEach((d) => {
            delChatPromises.push(deleteDoc(doc(db, "chats", d.id)));
        });
        await Promise.all(delChatPromises);
        
        alert('User and associated chats deleted.');
    } catch (e) {
        console.error(e);
        alert('Error deleting user.');
    }
};

window.toggleApproval = async (docId, approveState) => {
    try {
        const userRef = doc(db, "users", docId);
        await updateDoc(userRef, {
            isApproved: approveState
        });
        alert(approveState ? 'User approved successfully.' : 'User approval revoked.');
    } catch (e) {
        console.error("Error toggling user approval:", e);
        alert("Error updating approval status.");
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
        if (!confirm('WARNING: This will delete ALL users and ALL chats. Are you sure?')) return;
        try {
            const qs = await getDocs(collection(db, "users"));
            const delPromises = [];
            qs.forEach((d) => delPromises.push(deleteDoc(doc(db, "users", d.id))));
            await Promise.all(delPromises);
            
            // Also delete all chats just to be completely safe
            const chats = await getDocs(collection(db, "chats"));
            const delChatPromises = [];
            chats.forEach((d) => delChatPromises.push(deleteDoc(doc(db, "chats", d.id))));
            await Promise.all(delChatPromises);
            
            alert('All users and chats cleared.');
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
const startAdmin = async () => {
    if (!localStorage.getItem('adminAuth') && window.location.pathname.includes('admin.html')) {
        const pwd = prompt("Enter Admin Password:");
        if (!pwd) {
            window.location.href = 'index.html';
            return;
        }
        const hash = await hashAdminCode(pwd);
        if (hash !== ADMIN_HASH) {
            window.location.href = 'index.html';
            return;
        } else {
            localStorage.setItem('adminAuth', 'true');
        }
    }
    initAdmin();
};

startAdmin();
