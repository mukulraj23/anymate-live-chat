// public/client.js (Final Golden Copy with Pop-up Fix)
const socket = io();

// DOM Elements
const startScreen = document.getElementById('start-screen');
const chatContainer = document.getElementById('chat-container');
const startBtn = document.getElementById('start-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const statusBar = document.getElementById('status-bar');
const onlineCountElement = document.getElementById('online-count');
const reportBtn = document.getElementById('report-btn');
const rulesModalOverlay = document.getElementById('rules-modal-overlay');
const agreeBtn = document.getElementById('agree-btn');

let isConnected = false;
let typingTimer;
let currentStatusMessage = '...';

// --- Helper Functions ---
function displayMessage(sender, msg) {
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message', sender.toLowerCase() === 'you' ? 'you' : 'stranger');
    const messageContent = document.createElement('div');
    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.textContent = `${sender}: `;
    messageContent.appendChild(senderSpan);
    messageContent.append(document.createTextNode(msg));
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeElement = document.createElement('div');
    timeElement.classList.add('message-time');
    timeElement.textContent = timeString;
    messageBubble.appendChild(messageContent);
    messageBubble.appendChild(timeElement);
    chatMessages.appendChild(messageBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateStatus(message, isError = false) {
    statusBar.textContent = message;
    statusBar.className = isError ? 'status-bar error' : 'status-bar';
    if (!isError) currentStatusMessage = message;
}

// UPDATED resetUI function
function resetUI() {
    chatContainer.classList.add('hidden');
    // Hum ab yahan se startScreen ko nahi dikhayenge, taaki modal se conflict na ho.
    chatMessages.innerHTML = '';
    messageInput.value = '';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    reportBtn.disabled = true;
    isConnected = false;
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        displayMessage('You', message);
        socket.emit('message', message);
        messageInput.value = '';
        socket.emit('stopTyping');
        clearTimeout(typingTimer);
    }
}

// --- Event Listeners ---
startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    updateStatus('Finding a partner...');
    socket.emit('findPartner');
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) sendMessage();
    else if (isConnected) {
        socket.emit('typing');
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => socket.emit('stopTyping'), 1500);
    }
});

sendBtn.addEventListener('click', sendMessage);
disconnectBtn.addEventListener('click', () => { if (isConnected) socket.emit('manualDisconnect'); resetUI(); startScreen.classList.remove('hidden'); });

agreeBtn.addEventListener('click', () => {
    rulesModalOverlay.style.display = 'none';
    localStorage.setItem('rulesAgreed', 'true');
    startScreen.classList.remove('hidden'); // Agree karne ke baad hi Start Screen dikhao
});

reportBtn.addEventListener('click', () => {
    if (isConnected) {
        socket.emit('report');
    }
});

// --- Socket.IO Handlers ---
socket.on('status', (message) => updateStatus(message));
socket.on('userCountUpdate', (count) => { if (onlineCountElement) onlineCountElement.textContent = count; });
socket.on('paired', () => {
    isConnected = true;
    updateStatus('Connected! Say hi!');
    messageInput.disabled = false;
    sendBtn.disabled = false;
    reportBtn.disabled = false;
});
socket.on('message', (msg) => { displayMessage('Stranger', msg); });

const handleDisconnection = (message) => {
    updateStatus(message, true);
    isConnected = false;
    messageInput.disabled = true;
    sendBtn.disabled = true;
    reportBtn.disabled = true;
    clearTimeout(typingTimer);
    setTimeout(() => { 
        resetUI(); 
        startScreen.classList.remove('hidden');
    }, 2500);
};

socket.on('partnerDisconnected', () => { handleDisconnection('Stranger has disconnected.'); });
socket.on('forceDisconnect', (reason) => { handleDisconnection(reason); });
socket.on('partnerIsTyping', () => { if (isConnected) statusBar.textContent = 'Stranger is typing...'; });
socket.on('partnerStoppedTyping', () => { if (isConnected) statusBar.textContent = currentStatusMessage; });

// --- UPDATED Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    resetUI();
    
    // Ab hum yahan se control karenge ki pop-up dikhega ya start screen
    if (localStorage.getItem('rulesAgreed') === 'true') {
        rulesModalOverlay.style.display = 'none';
        startScreen.classList.remove('hidden');
    } else {
        rulesModalOverlay.style.display = 'flex';
        startScreen.classList.add('hidden'); // Sunishchit karo ki start screen chhipi rahe
    }
});