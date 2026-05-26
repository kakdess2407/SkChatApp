import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, doc, deleteDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Check Auth
const currentUserRaw = localStorage.getItem('currentUser');
if (!currentUserRaw && window.location.pathname.includes('chat.html')) {
    window.location.href = 'index.html';
}
const currentUser = JSON.parse(currentUserRaw);

// DOM Elements
const myName = document.getElementById('my-name');
const chatList = document.getElementById('chat-list');
const btnLogout = document.getElementById('btn-logout');
const emptyState = document.getElementById('empty-state');
const activeChat = document.getElementById('active-chat');
const activeUserName = document.getElementById('active-user-name');
const activeUserStatus = document.getElementById('active-user-status');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const searchUsers = document.getElementById('search-users');
const btnClearChat = document.getElementById('btn-clear-chat');

// State
let activeChatUserId = null;
let activeChatId = null;
let currentMessagesUnsubscribe = null;
let allUsers = [];
let userChats = new Map();

// Initialize UI
if (myName && currentUser) {
    myName.innerText = currentUser.fullName;
    const myProfilePic = document.getElementById('my-profile-pic');
    if (myProfilePic && currentUser.profilePic) {
        myProfilePic.src = currentUser.profilePic;
    }
}

// Mobile back button listener
const btnBack = document.getElementById('btn-back');
if (btnBack) {
    btnBack.onclick = () => {
        const chatArea = document.getElementById('chat-area');
        if (chatArea) {
            chatArea.classList.remove('mobile-active');
        }
        activeChatUserId = null;
    };
}

// Logout
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        // Set offline status
        if(currentUser) {
            try {
                const userRef = doc(db, "users", currentUser.docId);
                await updateDoc(userRef, {
                    status: 'offline',
                    lastSeen: serverTimestamp()
                });
            } catch(e) {}
        }
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

// Generate consistent chat ID for two users
const getChatId = (uid1, uid2) => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

// Format time
const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
        const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
};

// Render user list
const renderUsers = (users) => {
    if(!chatList) return;
    chatList.innerHTML = '';
    
    // Retrieve removed chats from localStorage
    const storageKey = `removedChats_${currentUser.userId}`;
    const removedChats = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    // Filter out removed chats/users (unless search is active!)
    const searchVal = searchUsers ? searchUsers.value.trim().toLowerCase() : '';
    const filteredUsers = users.filter(user => {
        if (searchVal !== '') return true; // Show in search results
        return !removedChats.hasOwnProperty(user.userId);
    });

    filteredUsers.forEach(user => {
        const chatId = getChatId(currentUser.userId, user.userId);
        const chatData = userChats.get(chatId);
        
        const lastMsg = chatData ? chatData.lastMessage : '';
        const lastTime = chatData ? formatTime(chatData.lastMessageTime) : '';
        
        const div = document.createElement('div');
        div.className = `chat-item ${activeChatUserId === user.userId ? 'active' : ''}`;
        div.onclick = () => selectUser(user);
        
        div.innerHTML = `
            <img src="${user.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar">
            <div class="chat-item-info">
                <div class="chat-item-header">
                    <span class="chat-item-name">${user.fullName}</span>
                    <span class="chat-item-time" style="color: ${user.status === 'online' ? 'var(--wa-green-light)' : ''}">
                        ${lastTime || (user.status === 'online' ? 'Online' : '')}
                    </span>
                </div>
                <div class="chat-item-last-msg-container" style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                    <span class="chat-item-last-msg" style="max-width: 85%;">${lastMsg || (user.status === 'online' ? 'Click to chat' : 'Offline')}</span>
                    <button class="remove-chat-btn" title="Remove Chat" onclick="event.stopPropagation(); removeChat('${user.userId}')">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
        `;
        chatList.appendChild(div);
    });
};

// Listen to users collection
if (currentUser && chatList) {
    const q = query(collection(db, "users"));
    onSnapshot(q, (snapshot) => {
        allUsers = [];
        snapshot.forEach((doc) => {
            const userData = { docId: doc.id, ...doc.data() };
            if (userData.userId !== currentUser.userId && userData.fullName.toLowerCase() !== 'admin') {
                allUsers.push(userData);
            }
        });
        renderUsers(allUsers);
        
        // Update active user status if selected
        if (activeChatUserId) {
            const activeUser = allUsers.find(u => u.userId === activeChatUserId);
            if (activeUser) {
                activeUserStatus.innerText = activeUser.status === 'online' ? 'online' : 'offline';
            }
        }
    });
}

// Listen to chats collection for the current user to get last message previews and unhide removed chats on new messages
if (currentUser) {
    const qChats = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser.userId)
    );
    onSnapshot(qChats, (snapshot) => {
        userChats.clear();
        snapshot.forEach((docSnap) => {
            userChats.set(docSnap.id, docSnap.data());
        });
        
        // Check if any removed chats have new messages and need to be un-hidden
        const storageKey = `removedChats_${currentUser.userId}`;
        const removedChats = JSON.parse(localStorage.getItem(storageKey) || '{}');
        let updated = false;
        
        for (const [userId, removedAtStr] of Object.entries(removedChats)) {
            const chatId = getChatId(currentUser.userId, userId);
            const chatData = userChats.get(chatId);
            if (chatData && chatData.lastMessageTime) {
                try {
                    const lastMsgTime = chatData.lastMessageTime.toDate ? chatData.lastMessageTime.toDate().getTime() : new Date(chatData.lastMessageTime).getTime();
                    const removedAt = new Date(removedAtStr).getTime();
                    
                    // If a new message arrived after the user removed the chat
                    if (lastMsgTime > removedAt) {
                        delete removedChats[userId];
                        updated = true;
                    }
                } catch(e) {
                    console.error("Error parsing timestamps for auto-unhide:", e);
                }
            }
        }
        
        if (updated) {
            localStorage.setItem(storageKey, JSON.stringify(removedChats));
        }
        
        // Re-render users list to show any updated chat previews
        renderUsers(allUsers);
    }, (error) => {
        console.error("Firestore onSnapshot error (chats):", error);
    });
}

// Remove chat from list
window.removeChat = (userId) => {
    if (!confirm('Are you sure you want to remove this chat from your list?')) return;
    
    const storageKey = `removedChats_${currentUser.userId}`;
    const removedChats = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    // Save the current timestamp of removal
    removedChats[userId] = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(removedChats));
    
    // If the removed chat is currently active, reset the chat view
    if (activeChatUserId === userId) {
        activeChatUserId = null;
        activeChatId = null;
        if (currentMessagesUnsubscribe) {
            currentMessagesUnsubscribe();
            currentMessagesUnsubscribe = null;
        }
        emptyState.style.display = 'flex';
        activeChat.style.display = 'none';
        if (window.innerWidth <= 768) {
            const chatArea = document.getElementById('chat-area');
            if (chatArea) {
                chatArea.classList.remove('mobile-active');
            }
        }
    }
    
    // Re-render list
    renderUsers(allUsers);
};

// Search users
if(searchUsers) {
    searchUsers.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = allUsers.filter(u => u.fullName.toLowerCase().includes(val));
        renderUsers(filtered);
    });
}

// Select User and Start Chat
const selectUser = (user) => {
    activeChatUserId = user.userId;
    activeChatId = getChatId(currentUser.userId, user.userId);
    
    emptyState.style.display = 'none';
    activeChat.style.display = 'flex';
    
    activeUserName.innerText = user.fullName;
    activeUserStatus.innerText = user.status === 'online' ? 'online' : 'offline';
    
    const activeUserPic = document.getElementById('active-user-pic');
    if (activeUserPic) {
        activeUserPic.src = user.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    }
    
    // Mobile transition (evaluated dynamically)
    if (window.innerWidth <= 768) {
        const chatArea = document.getElementById('chat-area');
        if (chatArea) {
            chatArea.classList.add('mobile-active');
        }
    }

    // Render users to update active class
    renderUsers(allUsers);

    // Load Messages
    loadMessages();
};

// Load Messages
const loadMessages = () => {
    if (currentMessagesUnsubscribe) {
        currentMessagesUnsubscribe();
    }

    // Query without orderBy to avoid needing a Firestore composite index immediately
    const q = query(
        collection(db, "messages"),
        where("chatId", "==", activeChatId)
    );

    currentMessagesUnsubscribe = onSnapshot(q, (snapshot) => {
        chatMessagesContainer.innerHTML = '';
        
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push(doc.data());
        });
        
        // Sort messages locally by timestamp
        messages.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toMillis() : Date.now();
            const timeB = b.timestamp ? b.timestamp.toMillis() : Date.now();
            return timeA - timeB;
        });

        messages.forEach((msg) => {
            renderMessage(msg);
        });
        scrollToBottom();
    });
};

const renderMessage = (msg) => {
    const isMe = msg.senderId === currentUser.userId;
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'message-out' : 'message-in'}`;
    
    let contentHtml = '';
    
    if (msg.fileUrl) {
        if (msg.fileType && msg.fileType.startsWith('image/')) {
            contentHtml = `<img src="${msg.fileUrl}" class="message-image" onclick="window.open('${msg.fileUrl}', '_blank')">`;
        } else {
            contentHtml = `
                <a href="${msg.fileUrl}" target="_blank" class="message-file">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    View Document
                </a>
            `;
        }
    }
    
    if (msg.text) {
        contentHtml += `<span class="message-text">${msg.text}</span>`;
    }
    
    contentHtml += `<span class="message-time">
        ${formatTime(msg.timestamp)}
        ${isMe ? '<svg viewBox="0 0 16 15" width="16" height="15"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" fill="#53bdeb"/></svg>' : ''}
    </span>`;
    
    div.innerHTML = contentHtml;
    chatMessagesContainer.appendChild(div);
};

const scrollToBottom = () => {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
};

// Send Message
const sendMessage = async (text = '', fileUrl = null, fileType = null) => {
    if ((!text.trim() && !fileUrl) || !activeChatId) return;

    messageInput.value = '';

    try {
        await addDoc(collection(db, "messages"), {
            chatId: activeChatId,
            senderId: currentUser.userId,
            text: text.trim(),
            fileUrl: fileUrl,
            fileType: fileType,
            timestamp: serverTimestamp()
        });

        // Also update chats collection for last message
        const chatRef = doc(db, "chats", activeChatId);
        await setDoc(chatRef, {
            lastMessage: text || (fileType?.startsWith('image/') ? '📷 Image' : '📄 File'),
            lastMessageTime: serverTimestamp(),
            participants: [currentUser.userId, activeChatUserId]
        }, { merge: true });

    } catch (error) {
        console.error("Error sending message:", error);
    }
};

if (btnSend) {
    btnSend.addEventListener('click', () => sendMessage(messageInput.value));
}

if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(messageInput.value);
        }
    });
}

// Clear Chat
if (btnClearChat) {
    btnClearChat.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear this chat? This cannot be undone.')) return;
        
        try {
            const q = query(collection(db, "messages"), where("chatId", "==", activeChatId));
            const querySnapshot = await getDocs(q);
            
            const deletePromises = [];
            querySnapshot.forEach((document) => {
                deletePromises.push(deleteDoc(doc(db, "messages", document.id)));
            });
            
            await Promise.all(deletePromises);
            
            // Delete the chat document from the chats collection to clear the last message preview
            await deleteDoc(doc(db, "chats", activeChatId));
            
            alert('Chat cleared successfully.');
        } catch(e) {
            console.error("Error clearing chat:", e);
            alert("Error clearing chat.");
        }
    });
}



// Keep Alive (Update online status)
setInterval(() => {
    if(currentUser) {
        try {
            const userRef = doc(db, "users", currentUser.docId);
            updateDoc(userRef, {
                status: 'online',
                lastSeen: serverTimestamp()
            });
        } catch(e) {}
    }
}, 60000); // Every 1 min
