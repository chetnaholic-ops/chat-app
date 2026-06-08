const appShell = document.querySelector(".chat-app");
const socket = io();

const username = appShell.dataset.username;
let currentRoom = appShell.dataset.room;
let typing = false;
let typingTimer = null;
const typingUsers = new Set();

const roomSelect = document.getElementById("roomSelect");
const roomTitle = document.getElementById("roomTitle");
const chatRoomName = document.getElementById("chatRoomName");
const usersList = document.getElementById("usersList");
const userCount = document.getElementById("userCount");
const messages = document.getElementById("messages");
const typingIndicator = document.getElementById("typingIndicator");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

function scrollToLatest() {
    messages.scrollTop = messages.scrollHeight;
}

function escapeText(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function renderMessage(message) {
    if (message.type === "system") {
        const system = document.createElement("div");
        system.className = "system-message";
        system.textContent = `${message.text} · ${message.timestamp}`;
        messages.appendChild(system);
        scrollToLatest();
        return;
    }

    const isOwn = message.sid === socket.id;
    const row = document.createElement("div");
    row.className = `message-row${isOwn ? " own" : ""}`;
    row.innerHTML = `
        <article class="message-bubble">
            <div class="message-meta">
                <span>${escapeText(isOwn ? "You" : message.username)}</span>
                <span>${escapeText(message.timestamp)}</span>
            </div>
            <div class="message-text">${escapeText(message.text)}</div>
        </article>
    `;
    messages.appendChild(row);
    scrollToLatest();
}

function setRoomName(room) {
    currentRoom = room;
    roomTitle.textContent = room;
    chatRoomName.textContent = room;
    roomSelect.value = room;
}

function resetRoom(room) {
    setRoomName(room);
    messages.innerHTML = "";
    typingUsers.clear();
    updateTypingIndicator();
    usersList.innerHTML = "";
    userCount.textContent = "0";
}

function updateTypingIndicator() {
    const names = Array.from(typingUsers);
    if (!names.length) {
        typingIndicator.textContent = "";
    } else if (names.length === 1) {
        typingIndicator.textContent = `${names[0]} is typing...`;
    } else {
        typingIndicator.textContent = `${names.slice(0, 2).join(", ")} are typing...`;
    }
}

function updateUsers(users) {
    usersList.innerHTML = "";
    users.forEach((user) => {
        const item = document.createElement("li");
        item.textContent = user;
        usersList.appendChild(item);
    });
    userCount.textContent = users.length;
}

function joinRoom(room) {
    resetRoom(room);
    socket.emit("join", { username, room });
}

function stopTyping() {
    if (!typing) {
        return;
    }
    typing = false;
    socket.emit("stop_typing");
}

socket.on("connect", () => {
    joinRoom(currentRoom);
});

socket.on("room_history", (payload) => {
    if (payload.room !== currentRoom) {
        return;
    }
    messages.innerHTML = "";
    payload.messages.forEach(renderMessage);
    scrollToLatest();
});

socket.on("receive_message", renderMessage);
socket.on("system_notification", renderMessage);

socket.on("users_update", (payload) => {
    if (payload.room === currentRoom) {
        updateUsers(payload.users);
    }
});

socket.on("typing", (payload) => {
    typingUsers.add(payload.username);
    updateTypingIndicator();
});

socket.on("stop_typing", (payload) => {
    typingUsers.delete(payload.username);
    updateTypingIndicator();
});

roomSelect.addEventListener("change", () => {
    stopTyping();
    socket.emit("leave");
    joinRoom(roomSelect.value);
});

messageInput.addEventListener("input", () => {
    if (!messageInput.value.trim()) {
        stopTyping();
        return;
    }

    if (!typing) {
        typing = true;
        socket.emit("typing");
    }

    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 900);
});

messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text) {
        return;
    }

    socket.emit("send_message", { text });
    messageInput.value = "";
    stopTyping();
    messageInput.focus();
});

window.addEventListener("beforeunload", () => {
    socket.emit("leave");
});
