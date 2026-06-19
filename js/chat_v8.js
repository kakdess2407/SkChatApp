

import { db, auth } from './firebase-config.js?v=52';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, getDoc, doc, deleteDoc, updateDoc, setDoc, or, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Check Auth
const currentUserRaw = localStorage.getItem('currentUser');
if (!currentUserRaw && window.location.pathname.includes('chat.html')) {
    window.location.href = 'index.html';
}
const currentUser = JSON.parse(currentUserRaw);

// Global Status State
window.globalGroupedStatuses = {};
window.globalMyStatuses = [];

window.hasActiveStatus = (userId) => {
    if (currentUser && userId === currentUser.userId) {
        return window.globalMyStatuses.length > 0;
    }
    return window.globalGroupedStatuses[userId] && window.globalGroupedStatuses[userId].length > 0;
};

window.handleAvatarClick = (userId, profilePicUrl, fullName, e) => {
    if (e) e.stopPropagation();
    
    const isMyProfile = currentUser && userId === currentUser.userId;
    
    if (window.hasActiveStatus(userId)) {
        // Open Action Modal
        const modal = document.getElementById('avatar-action-modal');
        document.getElementById('avatar-action-pic').src = profilePicUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        document.getElementById('avatar-action-name').innerText = isMyProfile ? 'My Status' : (fullName || 'User');
        
        document.getElementById('btn-action-view-profile').onclick = () => {
            modal.style.display = 'none';
            if(window.openProfileViewer) window.openProfileViewer(profilePicUrl, isMyProfile);
        };
        
        document.getElementById('btn-action-view-status').onclick = () => {
            modal.style.display = 'none';
            if (isMyProfile) {
                openStatusViewer(userId, window.globalMyStatuses);
            } else {
                const userObj = allUsers.find(u => u.userId === userId) || { fullName: fullName, profilePic: profilePicUrl };
                openStatusViewer(userId, window.globalGroupedStatuses[userId], userObj);
            }
        };
        
        modal.style.display = 'flex';
        
        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
    } else {
        // No status, just open profile
        if(window.openProfileViewer) window.openProfileViewer(profilePicUrl, isMyProfile);
    }
};

if (currentUser && window.AndroidAuth) {
    window.AndroidAuth.startCallListener(currentUser.userId);
}

// Immediately set user online upon opening the web app
if (currentUser && currentUser.docId) {
    updateDoc(doc(db, "users", currentUser.docId), {
        status: 'online',
        lastSeen: serverTimestamp()
    }).catch(e => console.error("Could not set initial online status:", e));
}

// Real-time Admin Approval Check
window.openChatFromNative = function(userId) {
    if (typeof allUsers !== 'undefined' && allUsers.length > 0) {
        const user = allUsers.find(u => u.userId === userId);
        if (user) {
            if (typeof selectUser === 'function') {
                selectUser(user);
            }
        }
    } else {
        window.pendingNativeChatId = userId;
    }
};

let userApprovalUnsubscribe = null;
if (currentUser && window.location.pathname.includes('chat.html')) {
    const userDocRef = doc(db, "users", currentUser.userId);
    userApprovalUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            // Check removed (admin approval is bypassed)
        } else {
            if (userApprovalUnsubscribe) userApprovalUnsubscribe();
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        }
    }, (err) => {
        console.error("Error watching user approval status:", err);
    });
}

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
const btnBlockUser = document.getElementById('btn-block-user');
const btnBack = document.getElementById('btn-back');

// ImgBB API Key
const IMGBB_API_KEY = '114dfeeeb0e7a925c0811041e6e9cee4';

// Attachment elements
const btnAttach = document.getElementById('btn-attach');
const btnCamera = document.getElementById('btn-camera');
const fileInput = document.getElementById('file-input');
const cameraInput = document.getElementById('camera-input');
// Use the old imageUploadInput var for backward compatibility with uploadImage if it expects it
const imageUploadInput = fileInput;


// Lightbox Logic
const imageLightbox = document.getElementById('image-lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const btnCloseLightbox = document.getElementById('btn-close-lightbox');

window.openLightbox = function(url) {
    if (!imageLightbox) return;
    lightboxImg.src = url;
    imageLightbox.style.display = 'flex';
    history.pushState({ lightbox: true }, '');
};

window.closeLightbox = function() {
    if (!imageLightbox) return;
    imageLightbox.style.display = 'none';
    lightboxImg.src = '';
};

if (btnCloseLightbox) {
    btnCloseLightbox.addEventListener('click', () => {
        history.back(); // This will trigger popstate and close the lightbox
    });
}

const btnDownloadLightbox = document.getElementById('btn-download-lightbox');
if (btnDownloadLightbox) {
    const handleDownload = async (e) => {
        if(e) e.preventDefault();
        if (!lightboxImg || !lightboxImg.src) return;
        
        try {
            // Animate button
            btnDownloadLightbox.style.transform = 'scale(0.8)';
            setTimeout(() => btnDownloadLightbox.style.transform = 'scale(1)', 200);
            
            const url = lightboxImg.src;
            const filename = `SkChat_Image_${Date.now()}.jpg`;
            if (window.AndroidAuth && window.AndroidAuth.downloadImage) {
                alert("Triggering native download to Android Downloads folder...");
                window.AndroidAuth.downloadImage(url, filename);
            } else {
                // Fallback for Web browser
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            }
        } catch (err) {
            console.error("Failed to download image", err);
            alert("Could not download image. It might be blocked by browser security.");
        }
    };
    btnDownloadLightbox.addEventListener('click', handleDownload);
}


window.addEventListener('popstate', (e) => {
    // 1. Call Overlay (Highest priority)
    const callOverlay = document.getElementById('call-overlay');
    if (callOverlay && callOverlay.classList.contains('active')) {
        history.pushState({ view: 'call' }, '', '#call'); // Prevent closing
        if (typeof enterInAppPip === 'function') enterInAppPip();
        return;
    }

    // 2. Delete Modal
    const deleteModalOverlay = document.getElementById('delete-modal-overlay');
    if (deleteModalOverlay && deleteModalOverlay.style.display === 'flex') {
        deleteModalOverlay.style.display = 'none';
        history.pushState({ view: 'chat' }, '', '#chat'); // Restore chat state
        return;
    }

    // 3. Reaction Overlay
    if (reactionOverlay && reactionOverlay.style.display === 'flex') {
        reactionOverlay.style.display = 'none';
        history.pushState({ view: 'chat' }, '', '#chat'); // Restore chat state
        return;
    }

    // 3.5 Profile Viewer Overlay
    const profileViewerOverlay = document.getElementById('profile-viewer-overlay');
    if (profileViewerOverlay && profileViewerOverlay.classList.contains('active')) {
        profileViewerOverlay.classList.remove('active');
        return;
    }

    // 4. Image Lightbox
    if (imageLightbox && imageLightbox.style.display === 'flex') {
        window.closeLightbox();
        // closeLightbox doesn't pop or push, so we're good (it just hides). Actually we don't need to push state here because opening lightbox pushed a state, so popping it is correct!
        return;
    }

    // 5. Chat Area
    const chatArea = document.getElementById('chat-area');
    if (chatArea && chatArea.classList.contains('mobile-active')) {
        chatArea.classList.remove('mobile-active');
        activeChatId = null;
        activeChatUserId = null;
        if (currentMessagesUnsubscribe) {
            currentMessagesUnsubscribe();
            currentMessagesUnsubscribe = null;
        }
        if (window.AndroidAuth && typeof window.AndroidAuth.setChatOpen === 'function') {
            window.AndroidAuth.setChatOpen(false);
        }
        return;
    }
});

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
if (btnBack) {
    btnBack.onclick = () => {
        history.back(); // Trigger popstate
    };
}

// History API for Android Hardware Back Button
history.replaceState({ view: 'home' }, '', '#home');



// Logout
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        if (typeof incomingCallUnsubscribe === 'function') {
            incomingCallUnsubscribe();
        }
        if (typeof cleanupCall === 'function') {
            cleanupCall();
        }
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
        try {
            await signOut(auth);
        } catch(e) {}
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
        if (searchVal !== '') {
            return (user.fullName?.toLowerCase().includes(searchVal)) || 
                   (user.email && user.email.toLowerCase().includes(searchVal));
        }
        
        // Hide by default unless there is an existing chat/connection request
        const chatId = getChatId(currentUser.userId, user.userId);
        if (!userChats.has(chatId)) return false;
        
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
            <img src="${user.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar ${window.hasActiveStatus(user.userId) ? 'status-ring' : ''}" style="cursor: pointer;" onclick="window.handleAvatarClick('${user.userId}', this.src, '${user.fullName.replace(/'/g, "\'")}', event)">
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
            const fullName = userData.fullName || "";
            if (userData.userId !== currentUser.userId && fullName.toLowerCase() !== 'admin') {
                allUsers.push(userData);
            }
        });
        renderUsers(allUsers);
        
        // Update active user status if selected
        if (activeChatUserId) {
            const activeUser = allUsers.find(u => u.userId === activeChatUserId);
            if (activeUser) {
                if (activeUser.typingIn && activeUser.typingIn === activeChatId) {
                    activeUserStatus.innerText = 'typing...';
                    activeUserStatus.style.color = 'var(--wa-green-dark)';
                    activeUserStatus.style.fontStyle = 'italic';
                } else {
                    activeUserStatus.innerText = activeUser.status === 'online' ? 'online' : 'offline';
                    activeUserStatus.style.color = 'var(--wa-text-light)';
                    activeUserStatus.style.fontStyle = 'normal';
                }
            }
        }
        
        if (window.pendingNativeChatId) {
            const pendingUserId = window.pendingNativeChatId;
            window.pendingNativeChatId = null;
            window.openChatFromNative(pendingUserId);
        }
    });
}

// Listen to chats collection for the current user to get last message previews and unhide removed chats on new messages
if (currentUser) {
    // Global listener to mark incoming 'sent' messages as 'delivered' when app is open
    const qIncomingMessages = query(
        collection(db, "messages"),
        where("receiverId", "==", currentUser.userId),
        where("status", "==", "sent")
    );
    onSnapshot(qIncomingMessages, (snapshot) => {
        snapshot.forEach((docSnap) => {
            // Only update to delivered if the chat is not currently open
            // If it is open, the currentMessagesUnsubscribe will mark it as read
            const m = docSnap.data();
            if (activeChatId !== m.chatId) {
                updateDoc(docSnap.ref, { status: 'delivered' }).catch(e => { console.error(e); window.lastTickError = e.message; });
            }
        });
    });

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
                const removedAt = new Date(removedAtStr);
                const msgTime = chatData.lastMessageTime.toDate ? chatData.lastMessageTime.toDate() : new Date();
                
                if (msgTime > removedAt) {
                    delete removedChats[userId];
                    updated = true;
                }
            }
        }
        
        if (updated) {
            localStorage.setItem(storageKey, JSON.stringify(removedChats));
        }
        
        // Re-render users list to show any updated chat previews
        renderUsers(allUsers);
        
        // Update chat UI if the current chat changed
        if (activeChatId && userChats.has(activeChatId)) {
            updateChatUIState(userChats.get(activeChatId));
        }
    });
}

// Update Chat UI State (Connection Requests)
const updateChatUIState = (chatData) => {
    const chatInputArea = document.querySelector('.chat-input-container');
    let connectionBanner = document.getElementById('connection-banner');
    const btnAudioCall = document.getElementById('btn-audio-call');
    const btnVideoCall = document.getElementById('btn-video-call');
    
    if (!connectionBanner) {
        connectionBanner = document.createElement('div');
        connectionBanner.id = 'connection-banner';
        const activeChat = document.getElementById('active-chat');
        if (chatInputArea && activeChat) {
            activeChat.insertBefore(connectionBanner, chatInputArea);
        }
    }
    
    if (!chatData) {
        if (chatInputArea) chatInputArea.style.display = 'flex';
        if (connectionBanner) connectionBanner.style.display = 'none';
        if (btnAudioCall) btnAudioCall.style.display = 'none';
        if (btnVideoCall) btnVideoCall.style.display = 'none';
        return;
    }
    
    if ((!chatData.connectionStatus && !chatData.blockedBy) || chatData.connectionStatus === 'accepted') {
        if (!chatData.blockedBy || chatData.blockedBy.length === 0) {
            if (chatInputArea) chatInputArea.style.display = 'flex';
            if (connectionBanner) connectionBanner.style.display = 'none';
            if (btnAudioCall) btnAudioCall.style.display = '';
            if (btnVideoCall) btnVideoCall.style.display = '';
            return;
        }
    }
    
    // Hide call buttons for pending/rejected/blocked chats
    if (btnAudioCall) btnAudioCall.style.display = 'none';
    if (btnVideoCall) btnVideoCall.style.display = 'none';
    
    // Handle Blocked State
    if (chatData.blockedBy && chatData.blockedBy.length > 0) {
        // If we are currently on a call with this user, hang up immediately!
        if (currentCallId && chatData.participants && chatData.participants.includes(currentCallOtherUserId)) {
            if (typeof hangupCall === 'function') {
                hangupCall();
            }
        }
        
        if (chatInputArea) chatInputArea.style.display = 'none';
        connectionBanner.style.display = 'flex';
        
        if (chatData.blockedBy.includes(currentUser.userId)) {
            connectionBanner.innerHTML = `
                <p>You blocked this user.</p>
                <div class="connection-actions">
                    <button id="btn-unblock-user" class="btn-accept">Unblock</button>
                </div>
            `;
            document.getElementById('btn-unblock-user').onclick = () => window.toggleBlockUser(activeChatId);
        } else {
            connectionBanner.innerHTML = `<p>You cannot reply to this conversation.</p>`;
        }
        return;
    }

    // Handle Connection Requests
    if (chatData.connectionStatus === 'pending') {
        if (chatInputArea) chatInputArea.style.display = 'none';
        connectionBanner.style.display = 'flex';
        
        if (chatData.connectionInitiator === currentUser.userId) {
            connectionBanner.innerHTML = `<p>Waiting for the user to accept your request...</p>`;
        } else {
            connectionBanner.innerHTML = `
                <p><strong>${chatData.lastMessageSenderName}</strong> wants to connect with you.</p>
                <div class="connection-actions">
                    <button id="btn-accept-request" class="btn-accept">Accept</button>
                    <button id="btn-reject-request" class="btn-reject">Reject</button>
                </div>
            `;
            document.getElementById('btn-accept-request').onclick = () => respondToRequest(activeChatId, 'accepted');
            document.getElementById('btn-reject-request').onclick = () => respondToRequest(activeChatId, 'rejected');
        }
    } else if (chatData.connectionStatus === 'rejected') {
        if (chatInputArea) chatInputArea.style.display = 'none';
        connectionBanner.style.display = 'flex';
        
        const rejectTime = chatData.rejectionTimestamp?.toMillis ? chatData.rejectionTimestamp.toMillis() : 0;
        const hoursPassed = (Date.now() - rejectTime) / (1000 * 60 * 60);
        
        if (chatData.connectionInitiator === currentUser.userId) {
            if (hoursPassed >= 12) {
                connectionBanner.innerHTML = `<p>Your previous request was rejected. You can now send a new message to request again.</p>`;
                if (chatInputArea) chatInputArea.style.display = 'flex'; // allow sending a new request
            } else {
                const hoursLeft = Math.ceil(12 - hoursPassed);
                connectionBanner.innerHTML = `<p>Request rejected. You can try again in ${hoursLeft} hours.</p>`;
            }
        } else {
            connectionBanner.innerHTML = `<p>You rejected this request.</p>`;
        }
    }
};

window.respondToRequest = async (chatId, status) => {
    try {
        const chatRef = doc(db, "chats", chatId);
        const updateData = { connectionStatus: status };
        if (status === 'rejected') {
            updateData.rejectionTimestamp = serverTimestamp();
        }
        await updateDoc(chatRef, updateData);
    } catch(e) {
        console.error("Error updating connection status", e);
    }
};

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
        const filtered = allUsers.filter(u => 
            (u.fullName?.toLowerCase().includes(val)) || 
            (u.email && u.email.toLowerCase().includes(val))
        );
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
    
    if (user.typingIn && user.typingIn === activeChatId) {
        activeUserStatus.innerText = 'typing...';
        activeUserStatus.style.color = 'var(--wa-green-dark)';
        activeUserStatus.style.fontStyle = 'italic';
    } else {
        activeUserStatus.innerText = user.status === 'online' ? 'online' : 'offline';
        activeUserStatus.style.color = 'var(--wa-text-light)';
        activeUserStatus.style.fontStyle = 'normal';
    }
    const activeUserPic = document.getElementById('active-user-pic');
    if (activeUserPic) {
        activeUserPic.src = user.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    if (window.hasActiveStatus(user.userId)) {
        activeUserPic.classList.add('status-ring');
    } else {
        activeUserPic.classList.remove('status-ring');
    }
    
    // Bind click to the new handleAvatarClick
    activeUserPic.onclick = (e) => window.handleAvatarClick(user.userId, activeUserPic.src, user.fullName, e);
    }
    
    // Mobile transition (evaluated dynamically)
    if (window.innerWidth <= 768) {
        const chatArea = document.getElementById('chat-area');
        if (chatArea) {
            if (!chatArea.classList.contains('mobile-active')) {
                history.pushState({ view: 'chat' }, '', '#chat');
            }
            chatArea.classList.add('mobile-active');
            if (window.AndroidAuth && typeof window.AndroidAuth.setChatOpen === 'function') {
                window.AndroidAuth.setChatOpen(true);
            }
        }
    }

    // Render users to update active class
    renderUsers(allUsers);
    
    // Update Chat UI State
    if (userChats.has(activeChatId)) {
        updateChatUIState(userChats.get(activeChatId));
    } else {
        updateChatUIState(null);
    }

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
        snapshot.forEach((docSnap) => {
            let m = docSnap.data();
            m.id = docSnap.id;
            messages.push(m);
            
            // Mark as read if received by me and currently not read
            if (m.receiverId === currentUser.userId && m.status !== 'read') {
                updateDoc(docSnap.ref, { status: 'read' }).catch(e => { console.error(e); window.lastTickError = e.message; });
            }
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
    
    // Check if message is a call log
    if (msg.callLog) {
        const callType = msg.callLog.type; // 'audio' or 'video'
        const callStatus = msg.callLog.status; // 'missed' or 'completed'
        
        let title = '';
        let isMissed = callStatus === 'missed';
        
        if (isMe) {
            title = callType === 'video' ? 'Outgoing video call' : 'Outgoing voice call';
        } else {
            title = isMissed 
                ? (callType === 'video' ? 'Missed video call' : 'Missed voice call')
                : (callType === 'video' ? 'Incoming video call' : 'Incoming voice call');
        }
        
        div.className = `message message-call-log ${isMe ? 'message-out' : 'message-in'}`;
        const iconColorClass = isMissed && !isMe ? 'missed' : 'completed';
        
        let iconSvg = '';
        if (callType === 'video') {
            iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
        } else {
            iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
        }
        
        let callbackBtn = '';
        if (!isMe && isMissed) {
            callbackBtn = `<button class="call-log-callback" onclick="startCall('${callType}')">Call Back</button>`;
        }
        
        div.innerHTML = `
            <div class="call-log-icon ${iconColorClass}">
                ${iconSvg}
            </div>
            <div class="call-log-info">
                <span class="call-log-title" style="color: ${isMissed && !isMe ? '#ea4335' : 'var(--wa-text-dark)'}">${title}</span>
                <span class="call-log-subtitle">${formatTime(msg.timestamp)}</span>
            </div>
            ${callbackBtn}
        `;
        chatMessagesContainer.appendChild(div);
        return;
    }
    
    div.className = `message ${isMe ? 'message-out' : 'message-in'} ${msg.fileUrl ? 'message-has-image' : ''}`;
    div.setAttribute('data-id', msg.id || '');
    div.setAttribute('data-sender', msg.senderId || '');
    
    let contentHtml = '';
    
    if (msg.replyTo) {
        const senderName = msg.replyTo.senderId === currentUser.userId ? 'You' : (() => { const u = typeof allUsers !== 'undefined' ? allUsers.find(x => x.userId === msg.replyTo.senderId) : null; return u ? u.fullName : 'User'; })();
        contentHtml += `
            <div class="message-reply-block">
                <div class="message-reply-sender">${senderName}</div>
                <div class="message-reply-text">${msg.replyTo.text}</div>
            </div>
        `;
    }
    
    if (msg.fileUrl) {
        if (msg.fileType && msg.fileType.startsWith('image/')) {
            contentHtml = `<img src="${msg.fileUrl}" class="message-image" style="-webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-user-drag: none;">`;
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
    
    if (msg.reactions && Object.keys(msg.reactions).length > 0) {
        const emojis = [...new Set(Object.values(msg.reactions))]; // Unique emojis
        contentHtml += `
            <div class="message-reactions">
                ${emojis.join(' ')} <span style="font-size: 10px; margin-left: 2px;">${Object.values(msg.reactions).length > 1 ? Object.values(msg.reactions).length : ''}</span>
            </div>
        `;
    }
    
    
    let tickHtml = '';
    if (isMe) {
        let status = msg.status || 'sent';
        if (status === 'sent') {
            tickHtml = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #999; margin-left: 4px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (status === 'delivered') {
            tickHtml = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #999; margin-left: 4px; vertical-align: middle;"><polyline points="22 6 12 16 8 12"></polyline><path d="M12 6l-8 8"></path></svg>`;
        } else if (status === 'read') {
            tickHtml = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #53bdeb; margin-left: 4px; vertical-align: middle;"><polyline points="22 6 12 16 8 12"></polyline><path d="M12 6l-8 8"></path></svg>`;
        }
    }

    contentHtml += `<span class="message-time">
        ${formatTime(msg.timestamp)}
        ${tickHtml}
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
    
    // Security check: cannot send messages if chat is blocked
    const currentChatData = userChats.get(activeChatId);
    if (currentChatData && currentChatData.blockedBy && currentChatData.blockedBy.length > 0) {
        alert("You cannot send messages to a blocked chat.");
        return;
    }

    messageInput.value = '';

    try {
        const payload = {
            chatId: activeChatId,
            senderId: currentUser.userId,
            receiverId: activeChatUserId,
            text: text.trim(),
            fileUrl: fileUrl,
            fileType: fileType,
            timestamp: serverTimestamp()
        };
        if (replyToMessage) {
            payload.replyTo = replyToMessage;
        }
        payload.status = 'sent';
        await addDoc(collection(db, "messages"), payload);
        
        if (typeof btnCancelReply !== 'undefined' && btnCancelReply) btnCancelReply.click();
        
        const isNewChat = !userChats.has(activeChatId);
        const chatData = userChats.get(activeChatId);
        
        let connectionUpdates = {};
        if (isNewChat || (chatData && chatData.connectionStatus === 'rejected')) {
            // Check 12 hr cooldown if rejected
            if (chatData && chatData.connectionStatus === 'rejected') {
                const rejectTime = chatData.rejectionTimestamp?.toMillis ? chatData.rejectionTimestamp.toMillis() : 0;
                const hoursPassed = (Date.now() - rejectTime) / (1000 * 60 * 60);
                if (hoursPassed < 12) {
                    alert("You must wait 12 hours before sending another request.");
                    return;
                }
            }
            connectionUpdates = {
                connectionStatus: 'pending',
                connectionInitiator: currentUser.userId,
                rejectionTimestamp: null
            };
        }

        // Also update chats collection for last message
        const chatRef = doc(db, "chats", activeChatId);
        await setDoc(chatRef, {
            lastMessage: text || (fileType?.startsWith('image/') ? '📷 Image' : '📄 File'),
            lastMessageTime: serverTimestamp(),
            participants: [currentUser.userId, activeChatUserId],
            lastMessageSenderId: currentUser.userId,
            lastMessageSenderName: currentUser.fullName,
            ...connectionUpdates
        }, { merge: true });

    } catch (error) {
        console.error("Error sending message:", error);
    }
};

if (btnSend) {
    btnSend.addEventListener('click', () => sendMessage(messageInput.value));
}

if (btnAttach && imageUploadInput) {
    btnAttach.addEventListener('click', () => {
        fileInput.click();
    });
    
    if(btnCamera && cameraInput) {
        btnCamera.addEventListener('click', () => {
            cameraInput.click();
        });
        cameraInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!activeChatId) {
                alert("Please select a chat first");
                return;
            }
            
            try {
                const formData = new FormData();
                formData.append('image', file);
                
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    const imageUrl = data.data.url;
                    
                    const msgRef = doc(collection(db, "messages"));
                    await setDoc(msgRef, {
                        chatId: activeChatId,
                        senderId: currentUser.userId,
                        text: "📷 Photo",
                        timestamp: serverTimestamp(),
                        fileUrl: imageUrl,
                        fileType: "image",
                        isRead: false
                    });
                    
                    if (chatMsgsContainer) {
                        chatMsgsContainer.scrollTop = chatMsgsContainer.scrollHeight;
                    }
                }
            } catch (error) {
                console.error("Upload failed", error);
                alert("Upload failed. Please try again.");
            }
            e.target.value = '';
        });
    }

    imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Visual feedback
        const oldPlaceholder = messageInput.placeholder;
        messageInput.placeholder = "Uploading image...";
        messageInput.disabled = true;
        btnSend.disabled = true;
        btnAttach.disabled = true;

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                const imageUrl = data.data.url;
                // Send the image message
                await sendMessage('', imageUrl, file.type);
            } else {
                alert("Upload failed: " + data.error.message);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload failed. Please check console.");
        } finally {
            // Restore UI
            messageInput.placeholder = oldPlaceholder;
            messageInput.disabled = false;
            btnSend.disabled = false;
            btnAttach.disabled = false;
            imageUploadInput.value = ''; // Reset input
        }
    });
}


if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(messageInput.value);
        }
    });

    let typingTimeout = null;
    let isCurrentlyTyping = false;

    messageInput.addEventListener('input', () => {
        if (!currentUser || !activeChatId) return;
        
        if (!isCurrentlyTyping) {
            isCurrentlyTyping = true;
            updateDoc(doc(db, "users", currentUser.userId), {
                typingIn: activeChatId
            }).catch(err => console.error("Typing start error:", err));
        }
        
        if (typingTimeout) clearTimeout(typingTimeout);
        
        typingTimeout = setTimeout(() => {
            isCurrentlyTyping = false;
            updateDoc(doc(db, "users", currentUser.userId), {
                typingIn: null
            }).catch(err => console.error("Typing stop error:", err));
        }, 2000);
    });

    messageInput.addEventListener('blur', () => {
        if (!currentUser || !isCurrentlyTyping) return;
        if (typingTimeout) clearTimeout(typingTimeout);
        isCurrentlyTyping = false;
        updateDoc(doc(db, "users", currentUser.userId), {
            typingIn: null
        }).catch(err => console.error("Typing blur error:", err));
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
            await updateDoc(doc(db, "chats", activeChatId), {
                lastMessage: "",
                lastMessageTime: serverTimestamp()
            });
            
            alert('Chat cleared successfully.');
        } catch(e) {
            console.error("Error clearing chat:", e);
            alert('Error clearing chat.');
        }
    });
}

// Block / Unblock User
window.toggleBlockUser = async (chatId) => {
    if (!chatId) return;
    try {
        const chatData = userChats.get(chatId);
        let blockedBy = chatData?.blockedBy || [];
        
        if (blockedBy.includes(currentUser.userId)) {
            blockedBy = blockedBy.filter(id => id !== currentUser.userId);
        } else {
            blockedBy.push(currentUser.userId);
        }
        
        await updateDoc(doc(db, "chats", chatId), {
            blockedBy: blockedBy
        });
    } catch(e) {
        console.error("Error toggling block status:", e);
    }
};

if (btnBlockUser) {
    btnBlockUser.addEventListener('click', () => {
        if (confirm("Are you sure you want to block/unblock this user?")) {
            window.toggleBlockUser(activeChatId);
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

// Automatic Database Wipe every 12 hours (Serverless Client-Triggered Wiping)
const checkAndWipeChats = async () => {
    try {
        const metadataRef = doc(db, "chats", "SYSTEM_WIPE_METADATA");
        const metadataSnap = await getDoc(metadataRef);
        const now = Date.now();
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;

        let shouldWipe = false;

        if (metadataSnap.exists()) {
            const data = metadataSnap.data();
            if (data.lastWipeTime) {
                const lastWipeTime = data.lastWipeTime.toDate ? data.lastWipeTime.toDate().getTime() : new Date(data.lastWipeTime).getTime();
                if (now - lastWipeTime >= TWELVE_HOURS) {
                    shouldWipe = true;
                }
            } else {
                shouldWipe = true;
            }
        } else {
            // First time setup - create metadata tracker doc
            await setDoc(metadataRef, { lastWipeTime: serverTimestamp() });
        }

        if (shouldWipe) {
            console.log("12 hours have passed. Automatically clearing chats and messages...");
            
            // 1. Update lastWipeTime first to lock the operation against concurrent runs by other clients
            await setDoc(metadataRef, { lastWipeTime: serverTimestamp() }, { merge: true });

            // 2. Fetch and delete all messages
            const messagesRef = collection(db, "messages");
            const messagesSnap = await getDocs(messagesRef);
            const msgDelPromises = [];
            messagesSnap.forEach((doc) => {
                msgDelPromises.push(deleteDoc(doc.ref));
            });
            await Promise.all(msgDelPromises);

            // 3. Fetch and delete all chats except SYSTEM_WIPE_METADATA
            const chatsRef = collection(db, "chats");
            const chatsSnap = await getDocs(chatsRef);
            const chatDelPromises = [];
            chatsSnap.forEach((doc) => {
                if (doc.id !== "SYSTEM_WIPE_METADATA") {
                    chatDelPromises.push(deleteDoc(doc.ref));
                }
            });
            await Promise.all(chatDelPromises);

            // 4. Fetch and delete all calls
            try {
                const callsRef = collection(db, "calls");
                const callsSnap = await getDocs(callsRef);
                const callDelPromises = [];
                callsSnap.forEach((docSnap) => {
                    callDelPromises.push(deleteDoc(docSnap.ref));
                });
                await Promise.all(callDelPromises);
            } catch(callWipeErr) {
                console.error("Error wiping calls collection:", callWipeErr);
            }

            console.log("Automatic database wipe complete. Chats, messages and calls cleared.");
        }
    } catch (e) {
        console.error("Error checking or wiping chats:", e);
    }
};

// Check for auto-wipe when the app opens
if (currentUser) {
    checkAndWipeChats();
}

// Settings Modal Logic
const modalSettings = document.getElementById('modal-settings');
const myProfilePic = document.getElementById('my-profile-pic');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingsAvatarWrapper = document.getElementById('settings-avatar-wrapper');
const settingsProfilePic = document.getElementById('settings-profile-pic');
const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
const settingsFullname = document.getElementById('settings-fullname');
const settingsPhoneDisplay = document.getElementById('settings-phone-display');
const btnTriggerChangePhone = document.getElementById('btn-trigger-change-phone');
const changePhoneContainer = document.getElementById('change-phone-container');
const settingsMessage = document.getElementById('settings-message');
const settingsError = document.getElementById('settings-error');

// Simulated OTP state variables
let mockOtpOld = null;
let mockOtpNew = null;

// Helper to resize avatar (same as auth.js)
const resizeAvatar = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
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
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

// Open Settings
if (myProfilePic && modalSettings) {
    myProfilePic.addEventListener('click', () => {
        // Reset warnings / status
        settingsError.style.display = 'none';
        settingsMessage.style.display = 'none';
        changePhoneContainer.style.display = 'none';
        document.getElementById('change-phone-step-1').style.display = 'block';
        document.getElementById('change-phone-step-2').style.display = 'none';
        document.getElementById('otp-old-input-group').style.display = 'none';
        document.getElementById('otp-new-input-group').style.display = 'none';
        btnTriggerChangePhone.innerText = 'Change';
        
        // Reset input values
        document.getElementById('settings-otp-old').value = '';
        document.getElementById('settings-otp-new').value = '';
        document.getElementById('settings-phone-new').value = '';
        
        // Populate inputs
        settingsFullname.value = currentUser.fullName || '';
        settingsAvatarPreview.src = currentUser.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        settingsPhoneDisplay.innerText = currentUser.phoneNumber || 'N/A';
        
        // Open modal
        modalSettings.classList.add('active');
    });
}

// Close Settings
const closeSettingsModal = () => {
    if (modalSettings) {
        modalSettings.classList.remove('active');
    }
};
if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsModal);
if (btnCancelSettings) btnCancelSettings.addEventListener('click', closeSettingsModal);

// Avatar Edit Trigger
if (settingsAvatarWrapper && settingsProfilePic) {
    settingsAvatarWrapper.addEventListener('click', () => {
        if(window.openProfileViewer) {
            window.openProfileViewer(settingsAvatarPreview.src, true);
        } else {
            settingsProfilePic.click();
        }
    });
    
    settingsProfilePic.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                settingsAvatarPreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Save Settings Button
if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
        btnSaveSettings.disabled = true;
        btnSaveSettings.innerHTML = '<span class="spinner" style="border-top-color:#00a884; width:15px; height:15px; display:inline-block; border: 2px solid rgba(255,255,255,.3); border-radius:50%; border-top-color:#fff; animation:spin 1s linear infinite;"></span> Saving...';
        settingsError.style.display = 'none';
        settingsMessage.style.display = 'none';
        
        const newName = settingsFullname.value.trim();
        if (!newName) {
            settingsError.innerText = "Display Name cannot be empty.";
            settingsError.style.display = 'block';
            btnSaveSettings.disabled = false;
            btnSaveSettings.innerText = 'Save Settings';
            return;
        }

        try {
            let base64Avatar = currentUser.profilePic;
            
            // Check if profile picture changed
            if (settingsProfilePic.files && settingsProfilePic.files[0]) {
                base64Avatar = await resizeAvatar(settingsProfilePic.files[0]);
            }
            
            // Update Firestore Document
            const userRef = doc(db, "users", currentUser.docId);
            await updateDoc(userRef, {
                fullName: newName,
                profilePic: base64Avatar
            });
            
            // Update local storage
            currentUser.fullName = newName;
            currentUser.profilePic = base64Avatar;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Update header interface
            if (myName) myName.innerText = newName;
            const headerPic = document.getElementById('my-profile-pic');
            if (headerPic) headerPic.src = base64Avatar;
            
            settingsMessage.innerText = "Profile updated successfully!";
            settingsMessage.style.display = 'block';
            
            setTimeout(() => {
                closeSettingsModal();
            }, 1000);
            
        } catch (error) {
            console.error("Error saving settings:", error);
            settingsError.innerText = error.message || "Failed to save profile updates.";
            settingsError.style.display = 'block';
        } finally {
            btnSaveSettings.disabled = false;
            btnSaveSettings.innerText = 'Save Settings';
        }
    });
}

// Phone Number Change Container Toggle
if (btnTriggerChangePhone && changePhoneContainer) {
    btnTriggerChangePhone.addEventListener('click', () => {
        if (changePhoneContainer.style.display === 'none') {
            changePhoneContainer.style.display = 'block';
            btnTriggerChangePhone.innerText = 'Cancel Change';
        } else {
            changePhoneContainer.style.display = 'none';
            btnTriggerChangePhone.innerText = 'Change';
        }
    });
}

// Double-OTP Flow Logic (Simulated for free usage)
const btnSendOtpOld = document.getElementById('btn-send-otp-old');
const btnVerifyOtpOld = document.getElementById('btn-verify-otp-old');
const btnSendOtpNew = document.getElementById('btn-send-otp-new');
const btnVerifyOtpNew = document.getElementById('btn-verify-otp-new');

// STEP 1: Verify Old Number
if (btnSendOtpOld) {
    btnSendOtpOld.addEventListener('click', () => {
        btnSendOtpOld.disabled = true;
        btnSendOtpOld.innerText = 'Sending OTP...';
        settingsError.style.display = 'none';
        settingsMessage.style.display = 'none';

        setTimeout(() => {
            const oldPhoneNumber = currentUser.phoneNumber || 'N/A';
            
            // Generate a random 6-digit mock OTP
            mockOtpOld = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Display to user
            alert(`🔐 [SMS Simulator]\nVerification code sent to current number (${oldPhoneNumber}).\nUse code: ${mockOtpOld}`);
            
            document.getElementById('otp-old-input-group').style.display = 'block';
            btnSendOtpOld.innerText = 'Resend OTP';
            btnSendOtpOld.disabled = false;
            settingsMessage.innerText = `OTP sent to current number (${oldPhoneNumber}).`;
            settingsMessage.style.display = 'block';
        }, 800);
    });
}

if (btnVerifyOtpOld) {
    btnVerifyOtpOld.addEventListener('click', () => {
        const oldOtpInput = document.getElementById('settings-otp-old').value.trim();
        if (oldOtpInput.length !== 6) {
            settingsError.innerText = "OTP must be 6 digits.";
            settingsError.style.display = 'block';
            return;
        }

        btnVerifyOtpOld.disabled = true;
        btnVerifyOtpOld.innerText = 'Verifying...';
        settingsError.style.display = 'none';
        settingsMessage.style.display = 'none';

        setTimeout(() => {
            if (oldOtpInput === mockOtpOld) {
                // Show Step 2
                document.getElementById('change-phone-step-1').style.display = 'none';
                document.getElementById('change-phone-step-2').style.display = 'block';
                settingsMessage.innerText = "Current number verified. Proceed with entering new number.";
                settingsMessage.style.display = 'block';
            } else {
                settingsError.innerText = "Invalid OTP code. Please check the simulated pop-up code.";
                settingsError.style.display = 'block';
            }
            btnVerifyOtpOld.disabled = false;
            btnVerifyOtpOld.innerText = 'Verify Current Number';
        }, 600);
    });
}

// STEP 2: Verify New Number
if (btnSendOtpNew) {
    btnSendOtpNew.addEventListener('click', () => {
        const newPhoneNumber = document.getElementById('settings-phone-new').value.trim();
        if (!newPhoneNumber.startsWith('+') || newPhoneNumber.length < 10) {
            settingsError.innerText = "Please include country code starting with + (e.g. +918888888888)";
            settingsError.style.display = 'block';
            return;
        }

        btnSendOtpNew.disabled = true;
        btnSendOtpNew.innerText = 'Sending OTP...';
        settingsError.style.display = 'none';
        settingsMessage.style.display = 'none';

        setTimeout(() => {
            // Generate a random 6-digit mock OTP
            mockOtpNew = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Display to user
            alert(`🔐 [SMS Simulator]\nVerification code sent to new number (${newPhoneNumber}).\nUse code: ${mockOtpNew}`);
            
            document.getElementById('otp-new-input-group').style.display = 'block';
            btnSendOtpNew.innerText = 'Resend OTP';
            btnSendOtpNew.disabled = false;
            settingsMessage.innerText = `OTP sent to new number (${newPhoneNumber}).`;
            settingsMessage.style.display = 'block';
        }, 800);
    });
}

if (btnVerifyOtpNew) {
    btnVerifyOtpNew.addEventListener('click', async () => {
        const newOtpInput = document.getElementById('settings-otp-new').value.trim();
        const newPhoneNumber = document.getElementById('settings-phone-new').value.trim();
        
        if (newOtpInput.length !== 6) {
            settingsError.innerText = "OTP must be 6 digits.";
            settingsError.style.display = 'block';
            return;
        }

        btnVerifyOtpNew.disabled = true;
        btnVerifyOtpNew.innerText = 'Updating...';
        settingsError.style.display = 'none';
        settingsMessage.style.display = 'none';

        try {
            if (newOtpInput !== mockOtpNew) {
                throw new Error("Invalid OTP code. Please check the simulated pop-up code.");
            }

            // Update Firestore document
            const userRef = doc(db, "users", currentUser.docId);
            await updateDoc(userRef, {
                phoneNumber: newPhoneNumber
            });
            
            // Update LocalStorage
            currentUser.phoneNumber = newPhoneNumber;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Update Display
            settingsPhoneDisplay.innerText = newPhoneNumber;
            
            // Hide container and reset button
            changePhoneContainer.style.display = 'none';
            btnTriggerChangePhone.innerText = 'Change';
            
            settingsMessage.innerText = "Phone number updated successfully!";
            settingsMessage.style.display = 'block';
        } catch (error) {
            console.error("Error updating phone number:", error);
            settingsError.innerText = error.message || "Invalid OTP. Number update failed.";
            settingsError.style.display = 'block';
        } finally {
            btnVerifyOtpNew.disabled = false;
            btnVerifyOtpNew.innerText = 'Verify & Update Phone Number';
        }
    });
}

// ==========================================
// WebRTC Calling System Integration
// ==========================================

// Calling State
let localStream = null;
let peerConnection = null;
let currentCallId = null;
let callUnsubscribe = null;
let callerCandidatesUnsubscribe = null;
let receiverCandidatesUnsubscribe = null;
let incomingCallUnsubscribe = null;
let isAudioMuted = false;
let isVideoStopped = false;
let callTimeoutTimer = null;
let audioCtx = null;
let ringtoneInterval = null;
let isInPipMode = false;
let isScreenSharing = false;
let screenStream = null;
let callTimerInterval = null;
let callStartTime = null;
let currentCallType = null;
let currentFacingMode = 'user';
let currentCallReceiverName = '';
let currentCallOtherUserId = null;

// Call timer
const startCallTimer = () => {
    callStartTime = Date.now();
    const timerEl = document.getElementById('call-top-timer');
    const pipTimerEl = document.getElementById('pip-timer');
    const updateTimer = () => {
        if (!callStartTime) return;
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        const timeStr = `${mins}:${secs}`;
        if (timerEl) timerEl.innerText = timeStr;
        if (pipTimerEl) pipTimerEl.innerText = timeStr;
    };
    callTimerInterval = setInterval(updateTimer, 1000);
    updateTimer();
};

const stopCallTimer = () => {
    if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
    callStartTime = null;
    const timerEl = document.getElementById('call-top-timer');
    const pipTimerEl = document.getElementById('pip-timer');
    if (timerEl) timerEl.innerText = '00:00';
    if (pipTimerEl) pipTimerEl.innerText = '00:00';
};

// In-App PiP Mode
const enterInAppPip = () => {
    if (!currentCallId || isInPipMode) return;
    isInPipMode = true;

    const remoteVideo = document.getElementById('remote-video');
    const pipVideo = document.getElementById('pip-video');
    const pipPlayer = document.getElementById('pip-mini-player');
    const pipName = document.getElementById('pip-name');

    if (remoteVideo && remoteVideo.srcObject) {
        pipVideo.srcObject = remoteVideo.srcObject;
    }
    if (pipName) pipName.innerText = currentCallReceiverName;

    document.getElementById('call-overlay').classList.remove('active');
    pipPlayer.classList.add('active');
    
    if (window.AndroidAuth && typeof window.AndroidAuth.setInAppPipModeActive === 'function') {
        window.AndroidAuth.setInAppPipModeActive(true);
    }
};

window.triggerInAppPip = enterInAppPip;

const exitInAppPip = () => {
    if (!isInPipMode) return;
    isInPipMode = false;

    const pipPlayer = document.getElementById('pip-mini-player');
    const pipVideo = document.getElementById('pip-video');

    pipPlayer.classList.remove('active');
    pipVideo.srcObject = null;

    if (currentCallId) {
        document.getElementById('call-overlay').classList.add('active');
    }
    
    if (window.AndroidAuth && typeof window.AndroidAuth.setInAppPipModeActive === 'function') {
        window.AndroidAuth.setInAppPipModeActive(false);
    }
};

// Browser PiP (native)
const enterBrowserPip = async () => {
    if (!document.pictureInPictureEnabled) return;
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo && remoteVideo.srcObject && !document.pictureInPictureElement) {
        try { await remoteVideo.requestPictureInPicture(); } catch (e) { console.warn('Browser PiP failed:', e); }
    }
};

const exitBrowserPip = async () => {
    if (document.pictureInPictureElement) {
        try { await document.exitPictureInPicture(); } catch (e) {}
    }
};

// Native PiP is handled by the autopictureinpicture attribute on the video tag.

// Draggable PiP
const initDraggablePip = () => {
    const pip = document.getElementById('pip-mini-player');
    if (!pip) return;
    let isDragging = false, startX, startY, startLeft, startTop;

    pip.addEventListener('mousedown', (e) => {
        if (e.target.closest('.pip-btn')) return;
        isDragging = true;
        pip.classList.add('dragging');
        startX = e.clientX; startY = e.clientY;
        const rect = pip.getBoundingClientRect();
        startLeft = rect.left; startTop = rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        pip.style.left = (startLeft + dx) + 'px';
        pip.style.top = (startTop + dy) + 'px';
        pip.style.right = 'auto'; pip.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        pip.classList.remove('dragging');
    });

    // Touch support
    pip.addEventListener('touchstart', (e) => {
        if (e.target.closest('.pip-btn')) return;
        isDragging = true;
        pip.classList.add('dragging');
        const touch = e.touches[0];
        startX = touch.clientX; startY = touch.clientY;
        const rect = pip.getBoundingClientRect();
        startLeft = rect.left; startTop = rect.top;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX, dy = touch.clientY - startY;
        pip.style.left = (startLeft + dx) + 'px';
        pip.style.top = (startTop + dy) + 'px';
        pip.style.right = 'auto'; pip.style.bottom = 'auto';
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        pip.classList.remove('dragging');
    });
};
initDraggablePip();

// Switch Camera
const switchCamera = async () => {
    if (!localStream || !peerConnection) return;

    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: currentFacingMode }
        });

        const newVideoTrack = newStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');

        if (sender) {
            await sender.replaceTrack(newVideoTrack);
        }

        // Replace local track
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) oldVideoTrack.stop();
        localStream.removeTrack(oldVideoTrack);
        localStream.addTrack(newVideoTrack);

        const localVideo = document.getElementById('local-video');
        if (localVideo) localVideo.srcObject = localStream;
    } catch (err) {
        console.error('Error switching camera:', err);
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    }
};

// Screen Sharing
const toggleScreenShare = async () => {
    if (!peerConnection) return;

    const btnShare = document.getElementById('btn-call-share-screen');

    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const screenTrack = screenStream.getVideoTracks()[0];

            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(screenTrack);
            }

            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = screenStream;

            isScreenSharing = true;
            if (btnShare) btnShare.classList.add('sharing');

            // When user stops sharing via browser UI
            screenTrack.onended = () => { stopScreenShare(); };
        } catch (err) {
            console.error('Screen share failed:', err);
        }
    } else {
        stopScreenShare();
    }
};

const stopScreenShare = async () => {
    if (!isScreenSharing) return;

    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }

    // Revert to camera
    try {
        const camStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode }
        });
        const camTrack = camStream.getVideoTracks()[0];

        const sender = peerConnection?.getSenders()?.find(s => s.track && s.track.kind === 'video');
        if (sender) {
            await sender.replaceTrack(camTrack);
        }

        const oldCamTrack = localStream?.getVideoTracks()[0];
        if (oldCamTrack) { oldCamTrack.stop(); localStream.removeTrack(oldCamTrack); }
        if (localStream) localStream.addTrack(camTrack);

        const localVideo = document.getElementById('local-video');
        if (localVideo) localVideo.srcObject = localStream;
    } catch (err) {
        console.error('Error reverting to camera:', err);
    }

    isScreenSharing = false;
    const btnShare = document.getElementById('btn-call-share-screen');
    if (btnShare) btnShare.classList.remove('sharing');
};

// Helper to log call status inside message history
const logCallMessage = async (callerId, receiverId, callType, callStatus, callId = null) => {
    const chatId = getChatId(callerId, receiverId);
    const text = callType === 'video' 
        ? (callStatus === 'missed' ? 'Missed video call' : 'Video call')
        : (callStatus === 'missed' ? 'Missed voice call' : 'Voice call');
        
    try {
        await addDoc(collection(db, "messages"), {
            chatId: chatId,
            senderId: callerId,
            text: text,
            callLog: {
                type: callType,
                status: callStatus,
                callId: callId
            },
            timestamp: serverTimestamp()
        });
        
        // Update chats preview
        const chatRef = doc(db, "chats", chatId);
        await setDoc(chatRef, {
            lastMessage: callType === 'video'
                ? (callStatus === 'missed' ? '📹 Missed video call' : '📹 Video call')
                : (callStatus === 'missed' ? '📞 Missed voice call' : '📞 Voice call'),
            lastMessageTime: serverTimestamp(),
            participants: [callerId, receiverId],
            lastMessageSenderId: callerId,
            lastMessageSenderName: currentUser.fullName
        }, { merge: true });
    } catch (e) {
        console.error("Error logging call message:", e);
    }
};

const servers = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302'
            ]
        }
    ],
    iceCandidatePoolSize: 10
};

// Ringtone generator using Web Audio API
const startRingtone = (isOutgoing = false) => {
    try {
        stopRingtone();
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        let playTone = () => {
            if (!audioCtx || audioCtx.state === 'closed') return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            if (isOutgoing) {
                // Outgoing sound: US Ringback tone (440Hz + 480Hz)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(480, audioCtx.currentTime);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
                
                osc.start();
                osc2.start();
                
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 2.0);
                gain2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 2.0);
                
                osc.stop(audioCtx.currentTime + 2.1);
                osc2.stop(audioCtx.currentTime + 2.1);
            } else {
                // Incoming sound: Dual-frequency ringing tone (400Hz + 450Hz pulsating)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, audioCtx.currentTime);
                
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(450, audioCtx.currentTime);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                
                gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
                gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
                
                osc.start();
                osc2.start();
                
                gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
                gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
                gain2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
                
                osc.stop(audioCtx.currentTime + 1.3);
                osc2.stop(audioCtx.currentTime + 1.3);
            }
        };
        
        playTone();
        ringtoneInterval = setInterval(playTone, isOutgoing ? 4000 : 2500);
    } catch (e) {
        console.error("Failed to start synthetic ringtone:", e);
    }
};

const stopRingtone = () => {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
};

// Start outgoing call
const startCall = async (type = 'video') => {
    if (!activeChatId || !activeChatUserId) return;
    
    // Security check: cannot start call if chat is blocked or pending
    const currentChatData = userChats.get(activeChatId);
    if (currentChatData) {
        if (currentChatData.blockedBy && currentChatData.blockedBy.length > 0) {
            alert("You cannot call a blocked user.");
            return;
        }
        if (currentChatData.connectionStatus && currentChatData.connectionStatus !== 'accepted') {
            alert("You cannot call a user until they accept your connection request.");
            return;
        }
    }

    const receiverUser = allUsers.find(u => u.userId === activeChatUserId);
    if (!receiverUser) {
        alert("Cannot call user: not found.");
        return;
    }

    const callDocRef = doc(collection(db, "calls"));
    currentCallId = callDocRef.id;
    if (window.AndroidAuth && typeof window.AndroidAuth.setActiveCallId === 'function') {
        window.AndroidAuth.setActiveCallId(currentCallId);
    }

    if (window.AndroidAuth && typeof window.AndroidAuth.startNativeCall === 'function') {
        window.AndroidAuth.startNativeCall(currentCallId, type, true);
        await setDoc(callDocRef, {
            callerId: currentUser.userId,
            callerName: currentUser.fullName,
            callerEmail: currentUser.email || '',
            callerPic: currentUser.profilePic || '',
            receiverId: receiverUser.userId,
            receiverName: receiverUser.fullName,
            receiverEmail: receiverUser.email || '',
            receiverPic: receiverUser.profilePic || '',
            type: type,
            status: 'ringing',
            createdAt: serverTimestamp()
        });
        return; // Exit completely, Android handles the rest natively
    }

    try {
        const constraints = { audio: true, video: type === 'video' };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
        console.error("Camera/Mic access denied or unavailable:", err);
        alert("Could not access camera or microphone.");
        return;
    }

    currentCallType = type;
    currentCallReceiverName = receiverUser.fullName;
    currentCallOtherUserId = receiverUser.userId;
    currentFacingMode = 'user';

    document.getElementById('call-name').innerText = receiverUser.fullName;
    const callTopName = document.getElementById('call-top-name');
    if (callTopName) callTopName.innerText = receiverUser.fullName;
    document.getElementById('call-avatar').src = receiverUser.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('call-status').innerText = "Ringing...";
    document.getElementById('call-avatar').classList.add('ringing');
    if (!document.getElementById('call-overlay').classList.contains('active')) {
        history.pushState({ view: 'call' }, '', '#call');
    }
    document.getElementById('call-overlay').classList.add('active');

    document.getElementById('btn-call-toggle-video').style.display = type === 'video' ? 'flex' : 'none';
    const screenShareWrapper = document.getElementById('screen-share-wrapper');
    const supportsDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    if (screenShareWrapper) screenShareWrapper.style.display = (type === 'video' && supportsDisplayMedia) ? 'flex' : 'none';
    const topBar = document.getElementById('call-top-bar');
    if (topBar) topBar.style.display = type === 'video' ? 'flex' : 'none';
    isAudioMuted = false;
    isVideoStopped = false;
    updateControlButtonsUI();

    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const videoContainer = document.getElementById('video-container');

    if (type === 'video') {
        localVideo.srcObject = localStream;
        localVideo.style.display = 'block';
        videoContainer.style.display = 'block';
    } else {
        localVideo.srcObject = null;
        localVideo.style.display = 'none';
        videoContainer.style.display = 'none';
    }

    startRingtone(true);

    try {
        const callDocRef = doc(collection(db, "calls"));
        currentCallId = callDocRef.id;
        if (window.AndroidAuth && typeof window.AndroidAuth.setActiveCallId === 'function') {
            window.AndroidAuth.setActiveCallId(currentCallId);
        }

        if (window.AndroidAuth && typeof window.AndroidAuth.startNativeCall === 'function') {
            // Let Android Native handle the WebRTC connection entirely
            window.AndroidAuth.startNativeCall(currentCallId, type, true);
            // Just write the initial status to Firestore, Android will write the offer
            await setDoc(callDocRef, {
                callerId: currentUser.userId,
                callerName: currentUser.fullName,
                callerEmail: currentUser.email || '',
                callerPic: currentUser.profilePic || '',
                receiverId: receiverUser.userId,
                receiverName: receiverUser.fullName,
                receiverEmail: receiverUser.email || '',
                receiverPic: receiverUser.profilePic || '',
                type: type,
                status: 'ringing',
                createdAt: serverTimestamp()
            });
        } else {
            // Standard JS WebRTC flow
            peerConnection = new RTCPeerConnection(servers);

            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            peerConnection.ontrack = (event) => {
                const remoteStream = event.streams[0];
                if (type === 'video') {
                    remoteVideo.srcObject = remoteStream;
                } else {
                    document.getElementById('remote-audio').srcObject = remoteStream;
                }
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    addDoc(collection(db, "calls", currentCallId, "callerCandidates"), event.candidate.toJSON());
                }
            };

            const offerDescription = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offerDescription);

            const offer = {
                sdp: offerDescription.sdp,
                type: offerDescription.type
            };

            await setDoc(callDocRef, {
                callerId: currentUser.userId,
                callerName: currentUser.fullName,
                callerEmail: currentUser.email || '',
                callerPic: currentUser.profilePic || '',
                receiverId: receiverUser.userId,
                receiverName: receiverUser.fullName,
                receiverEmail: receiverUser.email || '',
                receiverPic: receiverUser.profilePic || '',
                type: type,
                status: 'ringing',
                offer: offer,
                createdAt: serverTimestamp()
            });
        }

        // timeout timer for ringing (30 seconds)
        callTimeoutTimer = setTimeout(async () => {
            if (currentCallId) {
                await updateDoc(doc(db, "calls", currentCallId), { status: 'no-answer' });
                await logCallMessage(currentUser.userId, receiverUser.userId, type, 'missed', currentCallId);
                cleanupCall("No Answer");
            }
        }, 30000);

        callUnsubscribe = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            if (data.status === 'rejected') {
                cleanupCall("Call Declined");
            } else if (data.status === 'ended') {
                cleanupCall("Call Ended");
            } else if (data.status === 'no-answer') {
                cleanupCall("No Answer");
            } else if (data.status === 'connected' && data.answer) {
                clearTimeout(callTimeoutTimer);
                callTimeoutTimer = null;
                stopRingtone();
                document.getElementById('call-status').innerText = "Connected";
                document.getElementById('call-avatar').classList.remove('ringing');
                
                if (type === 'video') {
                    if (window.AndroidAuth) window.AndroidAuth.setVideoCallActive(true);
                    document.getElementById('call-overlay').classList.add('video-connected');
                    startCallTimer();
                }

                const answerDesc = new RTCSessionDescription(data.answer);
                if (!peerConnection.currentRemoteDescription) {
                    await peerConnection.setRemoteDescription(answerDesc);
                }

                const receiverCandidatesCol = collection(db, "calls", currentCallId, "receiverCandidates");
                receiverCandidatesUnsubscribe = onSnapshot(receiverCandidatesCol, (candSnapshot) => {
                    candSnapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const candData = change.doc.data();
                            const candidate = new RTCIceCandidate(candData);
                            peerConnection.addIceCandidate(candidate);
                        }
                    });
                });
            }
        });

    } catch (error) {
        console.error("Error creating call connection:", error);
        alert("An error occurred starting the call.");
        cleanupCall();
    }
};

// Monitor incoming calls in Firestore
const listenForIncomingCalls = () => {
    if (!currentUser) return;

    const q = query(
        collection(db, "calls"),
        where("receiverId", "==", currentUser.userId),
        where("status", "==", "ringing")
    );

    incomingCallUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const callData = change.doc.data();
                const callId = change.doc.id;

                if (currentCallId) {
                    // Auto decline if already in a call
                    updateDoc(doc(db, "calls", callId), { status: 'rejected' });
                    return;
                }

                showIncomingCallPopup(callId, callData);
            }
        });
    });
};

// Show incoming call banner
const showIncomingCallPopup = (callId, callData) => {
    currentCallId = callId;
    if (window.AndroidAuth && typeof window.AndroidAuth.setActiveCallId === 'function') {
        window.AndroidAuth.setActiveCallId(currentCallId);
    }
    startRingtone(false);

    document.getElementById('incoming-name').innerText = callData.callerName;
    document.getElementById('incoming-avatar').src = callData.callerPic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('incoming-type').innerText = `Incoming ${callData.type} call...`;
    document.getElementById('incoming-call-overlay').style.display = 'flex';

    const callRef = doc(db, "calls", callId);
    callUnsubscribe = onSnapshot(callRef, (snapshot) => {
        const data = snapshot.data();
        if (!data || data.status === 'ended' || data.status === 'no-answer') {
            cleanupIncomingCallPopup();
        }
    });
};

const cleanupIncomingCallPopup = () => {
    stopRingtone();
    document.getElementById('incoming-call-overlay').style.display = 'none';
    if (callUnsubscribe) {
        callUnsubscribe();
        callUnsubscribe = null;
    }
    currentCallId = null;
    if (window.AndroidAuth && typeof window.AndroidAuth.setActiveCallId === 'function') {
        window.AndroidAuth.setActiveCallId(null);
    }
};

// Accept call
const acceptIncomingCall = async () => {
    if (!currentCallId) return;

    const callRef = doc(db, "calls", currentCallId);
    const callSnapshot = await getDoc(callRef);
    if (!callSnapshot.exists()) {
        cleanupIncomingCallPopup();
        return;
    }

    const callData = callSnapshot.data();
    const type = callData.type;

    stopRingtone();
    document.getElementById('incoming-call-overlay').style.display = 'none';

    if (callUnsubscribe) callUnsubscribe();

    if (window.AndroidAuth && typeof window.AndroidAuth.startNativeCall === 'function') {
        window.AndroidAuth.startNativeCall(currentCallId, type, false);
        return; // Android will handle everything natively
    }

    try {
        const constraints = {
            audio: true,
            video: type === 'video'
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
        console.error("Camera/Mic access denied:", err);
        alert("Could not access camera or microphone.");
        await updateDoc(callRef, { status: 'rejected' });
        cleanupCall();
        return;
    }

    currentCallType = type;
    currentCallReceiverName = callData.callerName;
    currentCallOtherUserId = callData.callerId;
    currentFacingMode = 'user';

    document.getElementById('call-name').innerText = callData.callerName;
    const callTopName = document.getElementById('call-top-name');
    if (callTopName) callTopName.innerText = callData.callerName;
    document.getElementById('call-avatar').src = callData.callerPic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('call-status').innerText = "Connecting...";
    document.getElementById('call-avatar').classList.remove('ringing');
    if (!document.getElementById('call-overlay').classList.contains('active')) {
        history.pushState({ view: 'call' }, '', '#call');
    }
    document.getElementById('call-overlay').classList.add('active');

    document.getElementById('btn-call-toggle-video').style.display = type === 'video' ? 'flex' : 'none';
    const screenShareWrapper = document.getElementById('screen-share-wrapper');
    const supportsDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    if (screenShareWrapper) screenShareWrapper.style.display = (type === 'video' && supportsDisplayMedia) ? 'flex' : 'none';
    const topBar = document.getElementById('call-top-bar');
    if (topBar) topBar.style.display = type === 'video' ? 'flex' : 'none';
    isAudioMuted = false;
    isVideoStopped = false;
    updateControlButtonsUI();

    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const videoContainer = document.getElementById('video-container');

    if (type === 'video') {
        localVideo.srcObject = localStream;
        localVideo.style.display = 'block';
        videoContainer.style.display = 'block';
    } else {
        localVideo.srcObject = null;
        localVideo.style.display = 'none';
        videoContainer.style.display = 'none';
    }

    try {
        if (window.AndroidAuth && typeof window.AndroidAuth.startNativeCall === 'function') {
            window.AndroidAuth.startNativeCall(currentCallId, type, false);
            // Android will handle answering
        } else {
            peerConnection = new RTCPeerConnection(servers);

            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            peerConnection.ontrack = (event) => {
                const remoteStream = event.streams[0];
                if (type === 'video') {
                    remoteVideo.srcObject = remoteStream;
                } else {
                    document.getElementById('remote-audio').srcObject = remoteStream;
                }
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    addDoc(collection(db, "calls", currentCallId, "receiverCandidates"), event.candidate.toJSON());
                }
            };

            const offerDesc = new RTCSessionDescription(callData.offer);
            await peerConnection.setRemoteDescription(offerDesc);

            const answerDescription = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answerDescription);

            const answer = {
                sdp: answerDescription.sdp,
                type: answerDescription.type
            };

            await updateDoc(callRef, {
                answer: answer,
                status: 'connected'
            });
        }

        document.getElementById('call-status').innerText = "Connected";
        
        if (type === 'video') {
            if (window.AndroidAuth) window.AndroidAuth.setVideoCallActive(true);
            document.getElementById('call-overlay').classList.add('video-connected');
            startCallTimer();
        }

        const callerCandidatesCol = collection(db, "calls", currentCallId, "callerCandidates");
        callerCandidatesUnsubscribe = onSnapshot(callerCandidatesCol, (candSnapshot) => {
            candSnapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candData = change.doc.data();
                    const candidate = new RTCIceCandidate(candData);
                    peerConnection.addIceCandidate(candidate);
                }
            });
        });

        callUnsubscribe = onSnapshot(callRef, (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            if (data.status === 'ended') {
                cleanupCall("Call Ended");
            }
        });

    } catch (error) {
        console.error("Error establishing call connection:", error);
        alert("An error occurred establishing connection.");
        cleanupCall();
    }
};

// Decline call
const declineIncomingCall = async () => {
    if (!currentCallId) return;
    try {
        const callRef = doc(db, "calls", currentCallId);
        const callSnap = await getDoc(callRef);
        if (callSnap.exists()) {
            const callData = callSnap.data();
            await logCallMessage(callData.callerId, currentUser.userId, callData.type, 'missed', currentCallId);
        }
        await updateDoc(callRef, { status: 'rejected' });
    } catch (e) {
        console.error("Error declining call:", e);
    }
    cleanupIncomingCallPopup();
};

// Hang up call
const hangupCall = async () => {
    if (currentCallId) {
        try {
            const callRef = doc(db, "calls", currentCallId);
            const callSnap = await getDoc(callRef);
            if (callSnap.exists()) {
                const callData = callSnap.data();
                if (callData.status === 'connected') {
                    await logCallMessage(callData.callerId, callData.receiverId, callData.type, 'completed', currentCallId);
                } else if (callData.status === 'ringing') {
                    await logCallMessage(callData.callerId, callData.receiverId, callData.type, 'missed', currentCallId);
                }
            }
            await updateDoc(callRef, { status: 'ended' });
        } catch (e) {
            console.error("Error setting call status to ended:", e);
        }
    }
    cleanupCall("Call Ended");
};

// Toggle microphone
const toggleMicrophone = () => {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            isAudioMuted = !isAudioMuted;
            audioTracks.forEach(track => {
                track.enabled = !isAudioMuted;
            });
            updateControlButtonsUI();
        }
    }
};

// Toggle camera
const toggleCamera = () => {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            isVideoStopped = !isVideoStopped;
            videoTracks.forEach(track => {
                track.enabled = !isVideoStopped;
            });
            updateControlButtonsUI();
            
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.style.opacity = isVideoStopped ? '0' : '1';
            }
        }
    }
};

const updateControlButtonsUI = () => {
    const btnMic = document.getElementById('btn-call-toggle-mic');
    const btnVid = document.getElementById('btn-call-toggle-video');

    if (btnMic) {
        if (isAudioMuted) {
            btnMic.classList.add('muted');
            btnMic.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-light"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
        } else {
            btnMic.classList.remove('muted');
            btnMic.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-light"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
        }
    }

    if (btnVid) {
        if (isVideoStopped) {
            btnVid.classList.add('muted');
            btnVid.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-light"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7"></path><path d="M23 7l-7 5 7 5V7z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            btnVid.classList.remove('muted');
            btnVid.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-light"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
        }
    }
};

// Cleanup calling resource
const cleanupCall = (statusMessage = null) => {
    if (window.AndroidAuth) window.AndroidAuth.setVideoCallActive(false);
    stopCallTimer();
    exitInAppPip();
    stopScreenShare();

    if (callTimeoutTimer) {
        clearTimeout(callTimeoutTimer);
        callTimeoutTimer = null;
    }

    stopRingtone();

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const remoteAudio = document.getElementById('remote-audio');
    
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    if (remoteAudio) remoteAudio.srcObject = null;

    const videoContainer = document.getElementById('video-container');
    if (videoContainer) {
        videoContainer.style.display = 'none';
        videoContainer.classList.remove('swapped');
    }

    if (callUnsubscribe) {
        callUnsubscribe();
        callUnsubscribe = null;
    }
    if (callerCandidatesUnsubscribe) {
        callerCandidatesUnsubscribe();
        callerCandidatesUnsubscribe = null;
    }
    if (receiverCandidatesUnsubscribe) {
        receiverCandidatesUnsubscribe();
        receiverCandidatesUnsubscribe = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    document.getElementById('call-overlay').classList.remove('active');
    document.getElementById('call-overlay').classList.remove('video-connected');
    document.getElementById('call-avatar').classList.remove('ringing');

    if (statusMessage) {
        alert(statusMessage);
    }
    
    currentCallId = null;
    if (window.AndroidAuth && typeof window.AndroidAuth.setActiveCallId === 'function') {
        window.AndroidAuth.setActiveCallId(null);
    }
};

// Handle tab closing and presence
window.addEventListener('beforeunload', async () => {
    if (currentUser) {
        try {
            await updateDoc(doc(db, "users", currentUser.docId), {
                status: 'offline',
                lastSeen: serverTimestamp()
            });
        } catch(e) {}
    }

    if (currentCallId) {
        const callRef = doc(db, "calls", currentCallId);
        try {
            const callSnap = await getDoc(callRef);
            if (callSnap.exists()) {
                const callData = callSnap.data();
                if (callData.status === 'ringing') {
                    await logCallMessage(callData.callerId, callData.receiverId, callData.type, 'missed', currentCallId);
                } else if (callData.status === 'connected') {
                    await logCallMessage(callData.callerId, callData.receiverId, callData.type, 'completed', currentCallId);
                }
            }
            await updateDoc(callRef, { status: 'ended' });
        } catch(e) {}
    }
});

// Immediately update presence when minimizing/switching tabs on mobile
document.addEventListener('visibilitychange', () => {
    if (currentUser) {
        if (document.visibilityState === 'hidden') {
            updateDoc(doc(db, "users", currentUser.docId), {
                status: 'offline',
                lastSeen: serverTimestamp()
            }).catch(e => {});
        } else if (document.visibilityState === 'visible') {
            updateDoc(doc(db, "users", currentUser.docId), {
                status: 'online',
                lastSeen: serverTimestamp()
            }).catch(e => {});
        }
    }
});

// Expose call triggers globally for "Call Back" action click inside bubbles
window.startCall = startCall;

// Event Listeners for Calling
const btnAudioCall = document.getElementById('btn-audio-call');
const btnVideoCall = document.getElementById('btn-video-call');
const btnIncomingAccept = document.getElementById('btn-incoming-accept');
const btnIncomingDecline = document.getElementById('btn-incoming-decline');
const btnCallHangup = document.getElementById('btn-call-hangup');
const btnCallToggleMic = document.getElementById('btn-call-toggle-mic');
const btnCallToggleVid = document.getElementById('btn-call-toggle-video');

if (btnAudioCall) {
    btnAudioCall.addEventListener('click', () => startCall('audio'));
}
if (btnVideoCall) {
    btnVideoCall.addEventListener('click', () => startCall('video'));
}
if (btnIncomingAccept) {
    btnIncomingAccept.addEventListener('click', acceptIncomingCall);
}
if (btnIncomingDecline) {
    btnIncomingDecline.addEventListener('click', declineIncomingCall);
}
if (btnCallHangup) {
    btnCallHangup.addEventListener('click', hangupCall);
}
if (btnCallToggleMic) {
    btnCallToggleMic.addEventListener('click', toggleMicrophone);
}
if (btnCallToggleVid) {
    btnCallToggleVid.addEventListener('click', toggleCamera);
}

const btnCallPip = document.getElementById('btn-call-pip');
const btnPipExpand = document.getElementById('btn-pip-expand');
const btnCallSwitchCam = document.getElementById('btn-call-switch-cam');
const btnCallShareScreen = document.getElementById('btn-call-share-screen');
const btnPipHangup = document.getElementById('btn-pip-hangup');

if (btnCallPip) btnCallPip.addEventListener('click', enterInAppPip);
if (btnPipExpand) btnPipExpand.addEventListener('click', exitInAppPip);
if (btnCallSwitchCam) btnCallSwitchCam.addEventListener('click', switchCamera);
if (btnCallShareScreen) btnCallShareScreen.addEventListener('click', toggleScreenShare);
if (btnPipHangup) btnPipHangup.addEventListener('click', hangupCall);

// Video Swap Logic
const localVideoEl = document.getElementById('local-video');
const remoteVideoEl = document.getElementById('remote-video');
const videoContainerEl = document.getElementById('video-container');

if (localVideoEl && remoteVideoEl && videoContainerEl) {
    localVideoEl.addEventListener('click', () => {
        if (!videoContainerEl.classList.contains('swapped')) {
            videoContainerEl.classList.add('swapped');
        } else {
            videoContainerEl.classList.remove('swapped');
        }
    });
    
    remoteVideoEl.addEventListener('click', () => {
        if (videoContainerEl.classList.contains('swapped')) {
            videoContainerEl.classList.remove('swapped');
        }
    });
}

// Start listening for incoming calls after initialization is complete
if (currentUser) {
    listenForIncomingCalls();
}

// ==========================================
// Bottom Navigation & Call History Logic
// ==========================================
const navTabs = document.querySelectorAll('.nav-tab');
const sidebarChats = document.getElementById('sidebar-chats');
const sidebarCalls = document.getElementById('sidebar-calls');

if (navTabs) {
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.getAttribute('data-target');
            const targetEl = document.getElementById(target);
            const sidebars = [document.getElementById('sidebar-chats'), document.getElementById('sidebar-calls'), document.getElementById('sidebar-status')];
            sidebars.forEach(s => { if (s) s.style.display = 'none'; });
            
            if (targetEl) targetEl.style.display = 'flex';
            if (target === 'sidebar-chats' && targetEl) targetEl.style.display = 'block';
            
            if (target === 'sidebar-calls') {
                fetchCallHistory();
            }
            
            // Sync active state across desktop and mobile navs
            navTabs.forEach(t => {
                if (t.getAttribute('data-target') === target) {
                    t.classList.add('active');
                } else {
                    t.classList.remove('active');
                }
            });
        });
    });
}

let callsUnsubscribe = null;
let isCallsEditMode = false;
let replyToMessage = null;
let touchStartX = 0;
let touchStartY = 0;
let activeMessageElement = null;
let longPressTimer = null;
let currentReactionMsgId = null;

const fetchCallHistory = () => {
    if (callsUnsubscribe) return; // Already listening
    
    const callsRef = collection(db, "calls");
    // Require composite index? No, we can just use simple OR without orderBy, then sort in JS if needed. 
    // Wait, OR with orderBy might require a composite index on (callerId, createdAt) and (receiverId, createdAt).
    // Let's query and then sort in memory to avoid breaking the app with index requirements.
    const q = query(
        callsRef,
        or(
            where("callerId", "==", currentUser.userId),
            where("receiverId", "==", currentUser.userId)
        )
    );
    
    callsUnsubscribe = onSnapshot(q, (snapshot) => {
        const callListEl = document.getElementById('call-list');
        callListEl.innerHTML = '';
        
        if (snapshot.empty) {
            callListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--wa-text-light); font-size: 14px;">No recent calls</div>';
            return;
        }
        
        const callsArray = [];
        snapshot.forEach(doc => {
            callsArray.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort descending by createdAt
        callsArray.sort((a, b) => {
            const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : a.createdAt) : 0;
            const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : b.createdAt) : 0;
            return timeB - timeA;
        });
        
        callsArray.forEach(data => {
            const isOutgoing = data.callerId === currentUser.userId;
            const otherName = isOutgoing ? data.receiverName : data.callerName;
            const otherPic = isOutgoing ? data.receiverPic : data.callerPic;
            
            // Format time
            let timeStr = '';
            if (data.createdAt) {
                const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                timeStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + 
                          date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            
            // Icon logic
            let iconClass = 'incoming';
            let iconSvg = '';
            if (isOutgoing) {
                iconClass = 'outgoing';
                iconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="17" y1="7" x2="7" y2="17"></line><polyline points="8 7 17 7 17 16"></polyline></svg>`;
            } else {
                iconClass = data.status === 'missed' || data.status === 'no-answer' ? 'missed' : 'incoming';
                iconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="16 17 7 17 7 8"></polyline></svg>`;
            }
            
            let statusText = isOutgoing ? 'Outgoing' : (iconClass === 'missed' ? 'Missed' : 'Incoming');
            statusText += ` ${data.type === 'video' ? 'Video' : 'Audio'}`;
            
            const callItem = document.createElement('div');
            callItem.className = 'call-log-item';
            callItem.innerHTML = `
                <input type="checkbox" class="call-log-checkbox" value="${data.id}">
                <img src="${otherPic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="call-log-avatar">
                <div class="call-log-details">
                    <h4 class="call-log-name">${otherName}</h4>
                    <div class="call-log-sub">
                        <span class="call-log-icon ${iconClass}">${iconSvg}</span>
                        <span>${statusText}</span>
                    </div>
                </div>
                <div class="call-log-time">${timeStr}</div>
            `;
            
            callListEl.appendChild(callItem);
        });
    }, (err) => {
        console.error("Error fetching calls:", err);
    });
};

// Edit / Delete Logic
const btnEditCalls = document.getElementById('btn-edit-calls');
const btnDeleteCalls = document.getElementById('btn-delete-calls');
const btnDeleteAllCalls = document.getElementById('btn-delete-all-calls');
const sidebarCallsPane = document.getElementById('sidebar-calls');

if (btnEditCalls && btnDeleteCalls) {
    btnEditCalls.addEventListener('click', () => {
        isCallsEditMode = !isCallsEditMode;
        if (isCallsEditMode) {
            sidebarCallsPane.classList.add('calls-edit-mode');
            btnEditCalls.innerText = 'Cancel';
            btnDeleteCalls.style.display = 'block';
            if (btnDeleteAllCalls) btnDeleteAllCalls.style.display = 'block';
        } else {
            sidebarCallsPane.classList.remove('calls-edit-mode');
            btnEditCalls.innerText = 'Edit';
            btnDeleteCalls.style.display = 'none';
            if (btnDeleteAllCalls) btnDeleteAllCalls.style.display = 'none';
            // Uncheck all
            document.querySelectorAll('.call-log-checkbox').forEach(cb => cb.checked = false);
        }
    });

    if (btnDeleteAllCalls) {
        btnDeleteAllCalls.addEventListener('click', async () => {
            const allBoxes = document.querySelectorAll('.call-log-checkbox');
            if (allBoxes.length === 0) return;
            allBoxes.forEach(cb => cb.checked = true);
            btnDeleteCalls.click();
        });
    }
    
    btnDeleteCalls.addEventListener('click', async () => {
        const checkedBoxes = document.querySelectorAll('.call-log-checkbox:checked');
        if (checkedBoxes.length === 0) return;
        
        if (confirm(`Delete ${checkedBoxes.length} selected call log(s)?`)) {
            for (let cb of checkedBoxes) {
                try {
                    // Fetch call data first for fallback deletion of old logs
                    const callSnap = await getDoc(doc(db, "calls", cb.value));
                    let callData = null;
                    if (callSnap.exists()) callData = callSnap.data();

                    await deleteDoc(doc(db, "calls", cb.value));
                    
                    // Also delete the associated system message in the chat history
                    const msgQuery = query(collection(db, "messages"), where("callLog.callId", "==", cb.value));
                    const msgSnap = await getDocs(msgQuery);
                    
                    if (!msgSnap.empty) {
                        msgSnap.forEach(async (msgDoc) => {
                            await deleteDoc(doc(db, "messages", msgDoc.id));
                        });
                    } else if (callData) {
                        // Fallback for older calls without callId
                        const chatId = getChatId(callData.callerId, callData.receiverId);
                        const chatMsgsQuery = query(collection(db, "messages"), where("chatId", "==", chatId));
                        const chatMsgsSnap = await getDocs(chatMsgsQuery);
                        chatMsgsSnap.forEach(async (msgDoc) => {
                            const mData = msgDoc.data();
                            if (mData.callLog && mData.callLog.type === callData.type) {
                                const mTime = mData.timestamp ? mData.timestamp.toMillis() : 0;
                                const cTime = callData.createdAt ? callData.createdAt.toMillis() : 0;
                                // If within 60 minutes (generous buffer for long calls)
                                if (Math.abs(mTime - cTime) < 3600000) {
                                    await deleteDoc(doc(db, "messages", msgDoc.id));
                                }
                            }
                        });
                    }
                } catch(e) {
                    console.error("Error deleting call:", e);
                }
            }
            // Exit edit mode after deletion
            btnEditCalls.click();
        }
    });
}
window.onNativePipModeChanged = function(isInPipMode) {
    if (isInPipMode) {
        document.body.classList.add('native-pip-mode');
        // Restore call overlay visibility by exiting in-app pip
        if (typeof exitInAppPip === 'function') {
            exitInAppPip();
        }
    } else {
        document.body.classList.remove('native-pip-mode');
    }
};
window.hangupCall = hangupCall;


// ---- Reply and Reaction Logic ----

const replyBanner = document.getElementById('reply-preview-banner');
const replySender = document.getElementById('reply-preview-sender');
const replyText = document.getElementById('reply-preview-text');
const btnCancelReply = document.getElementById('btn-cancel-reply');
const reactionOverlay = document.getElementById('reaction-picker-overlay');

if (btnCancelReply) {
    btnCancelReply.addEventListener('click', () => {
        replyToMessage = null;
        if (replyBanner) replyBanner.style.display = 'none';
    });
}


// --- Delete Message Logic ---
const deleteModalOverlay = document.getElementById('delete-modal-overlay');
const btnShowDeleteModal = document.getElementById('btn-show-delete-modal');
const btnDeleteMessage = document.getElementById('btn-delete-message');
const btnDeleteCancel = document.getElementById('btn-delete-cancel');

let messageToDelete = null;

if (btnShowDeleteModal) {
    const showDelete = (e) => {
        if(e && e.cancelable) e.preventDefault();
        if(e) e.stopPropagation();
        if (reactionOverlay) reactionOverlay.style.display = 'none';
        
        if (currentReactionMsgId && activeChatId) {
            messageToDelete = currentReactionMsgId;
            deleteModalOverlay.style.display = 'flex';
        }
    };
    btnShowDeleteModal.addEventListener('click', showDelete);
    btnShowDeleteModal.addEventListener('touchstart', showDelete);
}

if (btnDeleteCancel) {
    btnDeleteCancel.addEventListener('click', () => {
        deleteModalOverlay.style.display = 'none';
        messageToDelete = null;
    });
}

if (btnDeleteMessage) {
    btnDeleteMessage.addEventListener('click', async () => {
        if (!messageToDelete) return;
        deleteModalOverlay.style.display = 'none';
        try {
            const msgRef = doc(db, "messages", messageToDelete);
            await deleteDoc(msgRef);
        } catch (err) {
            console.error("Delete failed", err);
            alert("Failed to delete message.");
        } finally {
            messageToDelete = null;
        }
    });
}
// --- End Delete Message Logic ---

window.initiateReply = function(msgId, senderId, text) {
    replyToMessage = { msgId, senderId, text };
    if (replySender) replySender.innerText = (senderId === (currentUser ? currentUser.userId : '')) ? 'You' : (() => { const u = typeof allUsers !== 'undefined' ? allUsers.find(x => x.userId === senderId) : null; return u ? u.fullName : 'User'; })();
    if (replyText) replyText.innerText = text;
    if (replyBanner) replyBanner.style.display = 'block';
    const msgInput = document.getElementById('message-input');
    if (msgInput) msgInput.focus();
};

window.showReactionPicker = function(x, y, msgId) {
    currentReactionMsgId = msgId;
    if (reactionOverlay) {
        reactionOverlay.style.display = 'flex';
        // Wait for next frame to get accurate width
        setTimeout(() => {
            const overlayWidth = reactionOverlay.offsetWidth || 300;
            reactionOverlay.style.left = `${Math.max(10, Math.min(x - (overlayWidth/2), window.innerWidth - overlayWidth - 10))}px`;
            reactionOverlay.style.top = `${Math.max(y - 60, 10)}px`;
        }, 0);
    }
};

const chatMsgsContainer = document.getElementById('chat-messages-container');
if (chatMsgsContainer) {
    chatMsgsContainer.addEventListener('touchstart', (e) => {
        const msgEl = e.target.closest('.message');
        if (!msgEl || msgEl.classList.contains('message-call-log')) return;
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        activeMessageElement = msgEl;
        
        const msgId = msgEl.getAttribute('data-id');
        if (msgId) {
            longPressTimer = setTimeout(() => {
                window.showReactionPicker(touchStartX, touchStartY, msgId);
                activeMessageElement = null; 
            }, 500); 
        }
    }, {passive: true});

    chatMsgsContainer.addEventListener('touchmove', (e) => {
        if (!activeMessageElement) return;
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        if (Math.abs(touchX - touchStartX) > 10 || Math.abs(touchY - touchStartY) > 10) {
            clearTimeout(longPressTimer);
        }
        
        const diffX = touchX - touchStartX;
        const diffY = Math.abs(touchY - touchStartY);
        
        if (diffX > 0 && diffX > diffY) {
            const translate = Math.min(diffX, 80);
            activeMessageElement.style.transform = `translateX(${translate}px)`;
            if (translate > 50) {
                activeMessageElement.classList.add('swipe-reply-active');
            } else {
                activeMessageElement.classList.remove('swipe-reply-active');
            }
        }
    }, {passive: true});

    chatMsgsContainer.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimer);
        
        if (activeMessageElement) {
            activeMessageElement.style.transform = '';
            if (activeMessageElement.classList.contains('swipe-reply-active')) {
                activeMessageElement.classList.remove('swipe-reply-active');
                
                const msgId = activeMessageElement.getAttribute('data-id');
                const senderId = activeMessageElement.getAttribute('data-sender');
                const textEl = activeMessageElement.querySelector('.message-text');
                const text = textEl ? textEl.innerText : (activeMessageElement.querySelector('img') ? 'Image' : 'Document');
                
                window.initiateReply(msgId, senderId, text);
            } else {
                // Short tap detection!
                const touchX = e.changedTouches[0].clientX;
                const touchY = e.changedTouches[0].clientY;
                if (Math.abs(touchX - touchStartX) < 10 && Math.abs(touchY - touchStartY) < 10) {
                    // It was a tap, not a swipe
                    if (e.target.tagName === 'IMG' && e.target.classList.contains('message-image')) {
                        window.openLightbox(e.target.src);
                    }
                }
            }
            activeMessageElement = null;
        }
    });

    // Also add desktop click support
    chatMsgsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && e.target.classList.contains('message-image')) {
            window.openLightbox(e.target.src);
        }
    });

    chatMsgsContainer.addEventListener('contextmenu', (e) => {
        const msgEl = e.target.closest('.message');
        if (msgEl && !msgEl.classList.contains('message-call-log')) {
            e.preventDefault();
            const msgId = msgEl.getAttribute('data-id');
            if (msgId) window.showReactionPicker(e.clientX, e.clientY, msgId);
        }
    });

    chatMsgsContainer.addEventListener('dblclick', (e) => {
        const msgEl = e.target.closest('.message');
        if (msgEl && !msgEl.classList.contains('message-call-log')) {
            const msgId = msgEl.getAttribute('data-id');
            const senderId = msgEl.getAttribute('data-sender');
            const textEl = msgEl.querySelector('.message-text');
            const text = textEl ? textEl.innerText : (msgEl.querySelector('img') ? 'Image' : 'Document');
            if (msgId) window.initiateReply(msgId, senderId, text);
        }
    });
}

const closeReactionOutside = (e) => {
    if (reactionOverlay && reactionOverlay.style.display === 'flex') {
        if (!e.target.closest('.reaction-picker-overlay')) {
            reactionOverlay.style.display = 'none';
        }
    }
};
document.addEventListener('click', closeReactionOutside);
document.addEventListener('touchstart', closeReactionOutside);

const handleEmojiAction = async (e) => {
        if(e.cancelable) e.preventDefault();
        e.stopPropagation();
        const emoji = e.target.getAttribute('data-emoji');
        if (reactionOverlay) reactionOverlay.style.display = 'none';
        
        if (currentReactionMsgId && activeChatId) {
            try {
                const msgRef = doc(db, "messages", currentReactionMsgId);
                const msgSnap = await getDoc(msgRef);
                
                let isRemoving = false;
                if (msgSnap.exists()) {
                    const data = msgSnap.data();
                    if (data.reactions && data.reactions[currentUser.userId] === emoji) {
                        isRemoving = true;
                        await updateDoc(msgRef, {
                            [`reactions.${currentUser.userId}`]: deleteField()
                        });
                    }
                }
                
                if (!isRemoving) {
                    await setDoc(msgRef, {
                        reactions: {
                            [currentUser.userId]: emoji
                        }
                    }, { merge: true });
                }
            } catch (err) {
                console.error("Failed to add reaction", err);
            }
        }
    };

document.querySelectorAll('.reaction-emoji').forEach(el => {
    el.addEventListener('click', handleEmojiAction);
    el.addEventListener('touchstart', handleEmojiAction);
});


// ==========================================
// Biometric Lock Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const lockScreen = document.getElementById('biometric-lock-screen');
    const btnUnlockApp = document.getElementById('btn-unlock-app');
    const biometricContainer = document.getElementById('setting-biometric-container');
    const biometricToggle = document.getElementById('settings-biometric-toggle');

    const isBiometricEnabled = localStorage.getItem('biometric_enabled') === 'true';

    window.onBiometricSuccess = () => {
        if (lockScreen) lockScreen.style.display = 'none';
    };

    window.onBiometricFailed = () => {
        // Keep it locked
    };

    if (window.AndroidAuth) {
        if (biometricContainer) biometricContainer.style.display = 'flex';
        if (biometricToggle) biometricToggle.checked = isBiometricEnabled;
        
        if (isBiometricEnabled && window.AndroidAuth.promptBiometric) {
            if (lockScreen) lockScreen.style.display = 'flex';
            window.AndroidAuth.promptBiometric();
        }
    }

    if (btnUnlockApp) {
        btnUnlockApp.addEventListener('click', () => {
            if (window.AndroidAuth && window.AndroidAuth.promptBiometric) {
                window.AndroidAuth.promptBiometric();
            }
        });
    }

    if (biometricToggle) {
        biometricToggle.addEventListener('change', (e) => {
            localStorage.setItem('biometric_enabled', e.target.checked);
        });
    }
});

    // Debug helper for ticks
    window.showTickError = () => {
        alert("Last Tick Error: " + (window.lastTickError || "None"));
    };

document.addEventListener('DOMContentLoaded', () => {
    const headerTitle = document.querySelector('.header h2');
    if (headerTitle) {
        headerTitle.addEventListener('click', () => {
            if (window.showTickError) window.showTickError();
        });
    }
});

// Biometric App Lock Handlers
window.showLockScreen = () => {
    if (localStorage.getItem('biometric_enabled') === 'true') {
        const lockScreen = document.getElementById('biometric-lock-screen');
        if (lockScreen) lockScreen.style.display = 'flex';
    }
};

window.promptBiometricIfLocked = () => {
    if (localStorage.getItem('biometric_enabled') === 'true') {
        const lockScreen = document.getElementById('biometric-lock-screen');
        if (lockScreen && window.AndroidAuth && window.AndroidAuth.promptBiometric) {
            lockScreen.style.display = 'flex';
            window.AndroidAuth.promptBiometric();
        }
    }
};

// ==========================================
// Profile Viewer Modal Logic
// ==========================================
window.openProfileViewer = (src, isMyProfile) => {
    const overlay = document.getElementById('profile-viewer-overlay');
    const img = document.getElementById('profile-viewer-img');
    const btnEdit = document.getElementById('btn-edit-profile-viewer');
    
    if (overlay && img) {
        img.src = src;
        if (btnEdit) {
            btnEdit.style.display = isMyProfile ? 'block' : 'none';
        }
        overlay.classList.add('active');
        history.pushState({ view: 'profileViewer' }, '', '#profileViewer');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('profile-viewer-overlay');
    const btnClose = document.getElementById('btn-close-profile-viewer');
    const btnEdit = document.getElementById('btn-edit-profile-viewer');
    const settingsProfilePic = document.getElementById('settings-profile-pic');
    
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            if (overlay.classList.contains('active')) {
                history.back(); // triggers popstate which closes it
            }
        });
    }
    
    if (btnEdit && settingsProfilePic) {
        btnEdit.addEventListener('click', () => {
            settingsProfilePic.click();
        });
    }
});


// ==========================================
// STATUS (STORIES) FEATURE
// ==========================================

const sidebarStatus = document.getElementById('sidebar-status');
const statusList = document.getElementById('status-list');
const btnAddStatus = document.getElementById('btn-add-status');
const myStatusPic = document.getElementById('my-status-pic');

const statusUploadModal = document.getElementById('status-upload-modal');
const btnCloseStatusUpload = document.getElementById('btn-close-status-upload');
const statusFileInput = document.getElementById('status-file-input');
const statusPreviewContainer = document.getElementById('status-preview-container');
const statusPlaceholder = document.getElementById('status-placeholder');
const statusImgPreview = document.getElementById('status-img-preview');
const statusVideoPreview = document.getElementById('status-video-preview');
const statusCaptionInput = document.getElementById('status-caption-input');
const btnSendStatus = document.getElementById('btn-send-status');

const statusViewerOverlay = document.getElementById('status-viewer-overlay');
const btnCloseStatusViewer = document.getElementById('btn-close-status-viewer');
const statusViewerImg = document.getElementById('status-viewer-img');
const statusViewerVideo = document.getElementById('status-viewer-video');
const statusViewerAvatar = document.getElementById('status-viewer-avatar');
const statusViewerName = document.getElementById('status-viewer-name');
const statusViewerTime = document.getElementById('status-viewer-time');
const statusViewerCaption = document.getElementById('status-viewer-caption');
const statusProgressContainer = document.getElementById('status-progress-container');
const statusTapLeft = document.getElementById('status-tap-left');
const statusTapRight = document.getElementById('status-tap-right');
const btnDeleteMyStatus = document.getElementById('btn-delete-my-status');
const statusViewsContainer = document.getElementById('status-views-container');
const statusViewsCount = document.getElementById('status-views-count');

const statusViewersModal = document.getElementById('status-viewers-modal');
const btnCloseStatusViewers = document.getElementById('btn-close-status-viewers');
const statusViewersList = document.getElementById('status-viewers-list');

let allStatuses = [];
let groupedStatuses = {};
let currentStatusGroup = [];
let currentStatusIndex = 0;
let statusTimer = null;
let statusIsPaused = false;
let currentStatusUserId = null;
let statusSelectedFile = null;

// Initialize My Status Pic
if (myStatusPic && currentUser) {
    myStatusPic.src = currentUser.profilePic;
}

// Check if user is connected
const isUserConnected = (otherUserId) => {
    if (otherUserId === currentUser.userId) return true; // Self is always connected
    const chatId = getChatId(currentUser.userId, otherUserId);
    if (!userChats.has(chatId)) return false;
    const chatData = userChats.get(chatId);
    
    // Check if blocked
    if (chatData.blockedBy && chatData.blockedBy.length > 0) return false;
    // Check if rejected
    if (chatData.connectionStatus === 'rejected') return false;
    
    return true;
};

// Fetch statuses in real-time
const statusesRef = collection(db, 'statuses');
// Use a reasonable lookback window (e.g. 24 hours) since Firestore doesn't support direct TTL filtering well without index
const yesterday = new Date();
yesterday.setHours(yesterday.getHours() - 24);

const statusesQuery = query(statusesRef, where('createdAt', '>', yesterday));
onSnapshot(statusesQuery, (snapshot) => {
    const now = new Date();
    allStatuses = [];
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        data.id = docSnap.id;
        
        // Check 12-hour expiration manually
        const createdAt = data.createdAt ? data.createdAt.toDate() : now;
        const diffHours = (now - createdAt) / (1000 * 60 * 60);
        
        if (diffHours < 12 && isUserConnected(data.userId)) {
            allStatuses.push(data);
        }
    });
    
    renderStatusList();
});

const renderStatusList = () => {
    if (!statusList) return;
    
    groupedStatuses = {};
    let myStatuses = [];
    
    // Group by user
    allStatuses.sort((a, b) => a.createdAt?.toDate() - b.createdAt?.toDate()).forEach(status => {
        if (status.userId === currentUser.userId) {
            myStatuses.push(status);
        } else {
            if (!groupedStatuses[status.userId]) {
                groupedStatuses[status.userId] = [];
            }
            groupedStatuses[status.userId].push(status);
        }
    });
    
    // Export globally for chat list
    window.globalGroupedStatuses = groupedStatuses;
    window.globalMyStatuses = myStatuses;
    if (typeof renderChatList === 'function') renderChatList();
    if (activeChatUserId && typeof updateChatUIState === 'function') updateChatUIState(allUsers.find(u => u.userId === activeChatUserId));

    
    // Update My Status UI
    const myStatusRing = btnAddStatus.querySelector('div[style*="border-radius: 50%"]');
    if (myStatuses.length > 0) {
        myStatusRing.style.border = '2px solid var(--wa-green-light)';
        myStatusRing.style.padding = '2px';
        btnAddStatus.onclick = () => openStatusViewer(currentUser.userId, myStatuses);
    } else {
        myStatusRing.style.border = 'none';
        myStatusRing.style.padding = '0';
        btnAddStatus.onclick = () => {
            if (statusUploadModal) statusUploadModal.classList.add('active');
        };
    }
    
    statusList.innerHTML = '';
    
    // Render other users
    for (const [userId, statuses] of Object.entries(groupedStatuses)) {
        const user = allUsers.find(u => u.userId === userId) || { fullName: 'Unknown', profilePic: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' };
        
        // Check if all seen
        let allSeen = true;
        statuses.forEach(s => {
            const viewers = s.viewers || [];
            if (!viewers.some(v => v.userId === currentUser.userId)) {
                allSeen = false;
            }
        });
        
        const lastStatus = statuses[statuses.length - 1];
        const timeString = lastStatus.createdAt ? lastStatus.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
        
        const ringColor = allSeen ? 'var(--wa-border)' : 'var(--wa-green-light)';
        
        const div = document.createElement('div');
        div.className = 'status-item';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.padding = '12px 15px';
        div.style.cursor = 'pointer';
        div.style.transition = 'background-color 0.2s';
        
        div.innerHTML = `
            <div style="position: relative; width: 45px; height: 45px; margin-right: 15px; border-radius: 50%; border: 2px solid ${ringColor}; padding: 2px;">
                <img src="${user.profilePic}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 500; font-size: 16px; color: var(--wa-text-dark);">${user.fullName}</div>
                <div style="font-size: 13px; color: var(--wa-text-light);">${timeString}</div>
            </div>
        `;
        
        div.onclick = () => openStatusViewer(userId, statuses, user);
        statusList.appendChild(div);
    }
};

// --- Upload Status UI ---
if (statusPreviewContainer) {
    statusPreviewContainer.onclick = () => statusFileInput.click();
}
if (statusFileInput) {
    statusFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        statusSelectedFile = file;
        
        statusPlaceholder.style.display = 'none';
        
        statusImgPreview.src = URL.createObjectURL(file);
        statusImgPreview.style.display = 'block';
        const captionBar = document.getElementById('status-caption-bar');
        if (captionBar) captionBar.style.display = 'flex';
    });
}
if (btnCloseStatusUpload) {
    btnCloseStatusUpload.onclick = () => {
        statusUploadModal.classList.remove('active');
        statusSelectedFile = null;
        statusPlaceholder.style.display = 'block';
        statusImgPreview.style.display = 'none';
        statusCaptionInput.value = '';
        const captionBar = document.getElementById('status-caption-bar');
        if (captionBar) captionBar.style.display = 'none';
    };
}

// Upload Photo to ImgBB
const uploadStatusImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    if (data.success) {
        return data.data.url;
    } else {
        throw new Error('ImgBB Upload Failed: ' + (data.error ? data.error.message : 'Unknown'));
    }
};

if (btnSendStatus) {
    btnSendStatus.onclick = async () => {
        if (!statusSelectedFile) return alert('Please select an image or video');
        
        btnSendStatus.disabled = true;
        btnSendStatus.innerHTML = '<span class="spinner" style="border-width: 2px; width: 20px; height: 20px;"></span>';
        
        try {
            const mediaUrl = await uploadStatusImage(statusSelectedFile);
            
            await addDoc(collection(db, 'statuses'), {
                userId: currentUser.userId,
                mediaUrl: mediaUrl,
                mediaType: 'image',
                caption: statusCaptionInput.value ? statusCaptionInput.value.trim() : '',
                createdAt: serverTimestamp(),
                viewers: []
            });
            
            btnCloseStatusUpload.click();
        } catch(e) {
            console.error(e);
            alert('Failed to upload status: ' + e.message);
        } finally {
            btnSendStatus.disabled = false;
            btnSendStatus.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" style="margin-left: 2px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        }
    };
}

// --- Status Viewer UI ---
const clearStatusTimer = () => {
    if (statusTimer) {
        clearTimeout(statusTimer);
        statusTimer = null;
    }
};

const openStatusViewer = (userId, statuses, userObj = null) => {
    currentStatusGroup = statuses;
    currentStatusIndex = 0;
    currentStatusUserId = userId;
    
    if (userId === currentUser.userId) {
        statusViewerAvatar.src = currentUser.profilePic;
        statusViewerName.innerText = 'My Status';
        btnDeleteMyStatus.style.display = 'block';
        statusViewsContainer.style.display = 'flex';
    } else {
        statusViewerAvatar.src = userObj ? userObj.profilePic : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        statusViewerName.innerText = userObj ? userObj.fullName : 'User';
        btnDeleteMyStatus.style.display = 'none';
        statusViewsContainer.style.display = 'none';
    }
    
    statusProgressContainer.innerHTML = '';
    statuses.forEach((_, i) => {
        const bar = document.createElement('div');
        bar.style.flex = '1';
        bar.style.height = '3px';
        bar.style.background = 'rgba(255,255,255,0.3)';
        bar.style.borderRadius = '2px';
        
        const fill = document.createElement('div');
        fill.id = `status-progress-fill-${i}`;
        fill.style.height = '100%';
        fill.style.width = '0%';
        fill.style.background = 'white';
        fill.style.borderRadius = '2px';
        
        bar.appendChild(fill);
        statusProgressContainer.appendChild(bar);
    });
    
    statusViewerOverlay.classList.add('active');
    history.pushState({ view: 'statusViewer' }, '', '#statusViewer');
    
    showStatus(0);
};

const showStatus = async (index) => {
    clearStatusTimer();
    statusIsPaused = false;
    
    if (index >= currentStatusGroup.length) {
        closeStatusViewer();
        return;
    }
    
    // Mark previous as full
    for (let i = 0; i < index; i++) {
        document.getElementById(`status-progress-fill-${i}`).style.width = '100%';
        document.getElementById(`status-progress-fill-${i}`).style.transition = 'none';
    }
    // Mark next as empty
    for (let i = index + 1; i < currentStatusGroup.length; i++) {
        document.getElementById(`status-progress-fill-${i}`).style.width = '0%';
        document.getElementById(`status-progress-fill-${i}`).style.transition = 'none';
    }
    
    currentStatusIndex = index;
    const status = currentStatusGroup[index];
    
    statusViewerTime.innerText = status.createdAt ? status.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    statusViewerCaption.innerText = status.caption || '';
    
    if (status.userId === currentUser.userId) {
        statusViewsCount.innerText = (status.viewers || []).length;
        statusViewsContainer.onclick = () => openViewersList(status);
    }
    
    const fillEl = document.getElementById(`status-progress-fill-${index}`);
    fillEl.style.width = '0%';
    fillEl.style.transition = 'none';
    
    // Record view if not my own and not already viewed
    if (status.userId !== currentUser.userId) {
        const viewers = status.viewers || [];
        if (!viewers.some(v => v.userId === currentUser.userId)) {
            const statusRef = doc(db, 'statuses', status.id);
            viewers.push({
                userId: currentUser.userId,
                viewedAt: new Date()
            });
            updateDoc(statusRef, { viewers: viewers }).catch(e => console.error(e));
        }
    }
    
    let duration = 5000;
    
    if (status.mediaType === 'video') {
        statusViewerImg.style.display = 'none';
        statusViewerVideo.src = status.mediaUrl;
        statusViewerVideo.style.display = 'block';
        statusViewerVideo.currentTime = 0;
        
        // Wait for video metadata to get duration
        statusViewerVideo.onloadedmetadata = () => {
            duration = (statusViewerVideo.duration * 1000) || 5000;
            statusViewerVideo.play();
            startProgress(fillEl, duration);
        };
        // Fallback if metadata fails
        setTimeout(() => {
            if(statusViewerVideo.readyState === 0) startProgress(fillEl, duration);
        }, 500);
        
    } else {
        statusViewerVideo.style.display = 'none';
        statusViewerVideo.pause();
        statusViewerImg.src = status.mediaUrl;
        statusViewerImg.style.display = 'block';
        
        // Small timeout to allow render
        setTimeout(() => startProgress(fillEl, duration), 50);
    }
};

const startProgress = (fillEl, duration) => {
    // Reflow to apply transition
    fillEl.offsetHeight; 
    fillEl.style.transition = `width ${duration}ms linear`;
    fillEl.style.width = '100%';
    
    statusTimer = setTimeout(() => {
        showStatus(currentStatusIndex + 1);
    }, duration);
};

const closeStatusViewer = () => {
    clearStatusTimer();
    statusViewerVideo.pause();
    statusViewerOverlay.classList.remove('active');
    if (history.state && history.state.view === 'statusViewer') history.back();
};

if (btnCloseStatusViewer) btnCloseStatusViewer.onclick = closeStatusViewer;

if (statusTapLeft) {
    statusTapLeft.onclick = () => {
        if (currentStatusIndex > 0) showStatus(currentStatusIndex - 1);
    };
}
if (statusTapRight) {
    statusTapRight.onclick = () => {
        showStatus(currentStatusIndex + 1);
    };
}

// Pause on hold
const pauseStatus = () => {
    if(!statusIsPaused) {
        statusIsPaused = true;
        clearStatusTimer();
        statusViewerVideo.pause();
        const fillEl = document.getElementById(`status-progress-fill-${currentStatusIndex}`);
        const computedWidth = window.getComputedStyle(fillEl).width;
        fillEl.style.transition = 'none';
        fillEl.style.width = computedWidth;
    }
};
const resumeStatus = () => {
    if (statusIsPaused) {
        statusIsPaused = false;
        // Simplified resume logic: just restarts the current status for ease
        showStatus(currentStatusIndex);
    }
};

statusTapLeft.addEventListener('mousedown', pauseStatus);
statusTapLeft.addEventListener('mouseup', resumeStatus);
statusTapLeft.addEventListener('touchstart', pauseStatus);
statusTapLeft.addEventListener('touchend', resumeStatus);

statusTapRight.addEventListener('mousedown', pauseStatus);
statusTapRight.addEventListener('mouseup', resumeStatus);
statusTapRight.addEventListener('touchstart', pauseStatus);
statusTapRight.addEventListener('touchend', resumeStatus);

// Delete My Status
if (btnDeleteMyStatus) {
    btnDeleteMyStatus.onclick = async () => {
        if (confirm("Delete this status update?")) {
            const status = currentStatusGroup[currentStatusIndex];
            clearStatusTimer();
            try {
                await deleteDoc(doc(db, 'statuses', status.id));
                closeStatusViewer();
            } catch(e) { alert("Failed to delete status."); }
        }
    };
}

// --- Viewers List ---
const openViewersList = (status) => {
    pauseStatus();
    statusViewersList.innerHTML = '';
    
    const viewers = status.viewers || [];
    if (viewers.length === 0) {
        statusViewersList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--wa-text-light);">No views yet</div>';
    } else {
        // Sort by most recent
        viewers.sort((a, b) => b.viewedAt - a.viewedAt).forEach(v => {
            const user = allUsers.find(u => u.userId === v.userId) || { fullName: 'Unknown', profilePic: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' };
            const timeString = v.viewedAt?.toDate ? v.viewedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
            
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.padding = '10px 15px';
            div.style.borderBottom = '1px solid var(--wa-border)';
            
            div.innerHTML = `
                <img src="${user.profilePic}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 15px;">
                <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: 16px; color: var(--wa-text-dark);">${user.fullName}</div>
                    <div style="font-size: 13px; color: var(--wa-text-light);">${timeString}</div>
                </div>
            `;
            statusViewersList.appendChild(div);
        });
    }
    
    statusViewersModal.classList.add('active');
};

if (btnCloseStatusViewers) {
    btnCloseStatusViewers.onclick = () => {
        statusViewersModal.classList.remove('active');
        resumeStatus();
    };
}

// Hook into popstate
window.addEventListener('popstate', () => {
    if (statusViewerOverlay.classList.contains('active')) {
        closeStatusViewer();
    }
    if (statusViewersModal.classList.contains('active')) {
        statusViewersModal.classList.remove('active');
    }
    if (statusUploadModal.classList.contains('active')) {
        btnCloseStatusUpload.click();
    }
});
