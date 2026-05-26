import { db, auth } from './firebase-config.js';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, getDoc, doc, deleteDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

            console.log("Automatic database wipe complete. Chats and messages cleared.");
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
        settingsProfilePic.click();
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
