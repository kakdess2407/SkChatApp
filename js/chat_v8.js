

import { db, auth } from './firebase-config.js?v=58';
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

window.handleAvatarClick = (userId, e) => {
    try {
        if (e && e.stopPropagation) e.stopPropagation();
        
        const isMyProfile = currentUser && userId === currentUser.userId;
        const userObj = (typeof allUsers !== 'undefined' ? allUsers.find(u => u.userId === userId) : null) || {};
        let profilePicUrl = userObj.profilePic;
        let fullName = userObj.fullName;
        
        if (isMyProfile) {
            profilePicUrl = currentUser.profilePic;
            fullName = currentUser.fullName;
        }
        
        profilePicUrl = profilePicUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        fullName = fullName || 'User';
        
        if (window.hasActiveStatus(userId)) {
            // Open Action Modal
            let modal = document.getElementById('avatar-action-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'avatar-action-modal';
                modal.className = 'modal-overlay';
                modal.style.zIndex = '10006';
                modal.style.display = 'none';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 320px; width: 85%; padding: 0; border-radius: 12px; overflow: hidden; background: var(--wa-bg-light); margin: auto;">
                        <div style="padding: 20px; text-align: center; border-bottom: 1px solid var(--wa-border);">
                            <img id="avatar-action-pic" src="" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px;">
                            <h3 id="avatar-action-name" style="margin: 0; font-size: 18px; color: var(--wa-text-dark);">User Name</h3>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <button id="btn-action-view-status" style="padding: 15px; background: none; border: none; border-bottom: 1px solid var(--wa-border); font-size: 16px; color: var(--wa-green-dark); cursor: pointer; font-weight: 500; transition: background 0.2s;">View Status</button>
                            <button id="btn-action-view-profile" style="padding: 15px; background: none; border: none; font-size: 16px; color: var(--wa-text-dark); cursor: pointer; font-weight: 500; transition: background 0.2s;">View Profile</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
            
            document.getElementById('avatar-action-pic').src = profilePicUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            document.getElementById('avatar-action-name').innerText = isMyProfile ? 'My Status' : (fullName || 'User');
            
            const closeModal = () => {
                modal.classList.remove('active');
                modal.style.opacity = '0';
                modal.style.pointerEvents = 'none';
                setTimeout(() => modal.style.display = 'none', 200);
            };
            
            document.getElementById('btn-action-view-profile').onclick = () => {
                closeModal();
                if(window.openProfileViewer) window.openProfileViewer(profilePicUrl, isMyProfile);
            };
            
            document.getElementById('btn-action-view-status').onclick = () => {
                closeModal();
                if (isMyProfile) {
                    if (typeof openStatusViewer === 'function') openStatusViewer(userId, window.globalMyStatuses);
                } else {
                    const statusObj = (typeof allUsers !== 'undefined' ? allUsers.find(u => u.userId === userId) : null) || { fullName: fullName, profilePic: profilePicUrl };
                    if (typeof openStatusViewer === 'function') openStatusViewer(userId, window.globalGroupedStatuses[userId], statusObj);
                }
            };
            
            // Explicitly force visibility
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('active');
                modal.style.opacity = '1';
                modal.style.pointerEvents = 'all';
            }, 10);
            
            // Close modal when clicking outside
            modal.onclick = (e) => {
                if (e.target === modal) closeModal();
            };
        } else {
            // No status, just open profile
            if(window.openProfileViewer) {
                window.openProfileViewer(profilePicUrl, isMyProfile);
            }
        }
    } catch(err) {
        alert("Error: " + err.message + "\\n" + err.stack);
    }
};



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
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'all';
        history.pushState({ view: 'profileViewer' }, '', '#profileViewer');
    } else {
        alert("Profile Viewer Elements Not Found in HTML!");
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
