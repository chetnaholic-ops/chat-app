from datetime import datetime
import os

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room

# Prefer eventlet if available (used by our Gunicorn worker). If it's not
# installed, let SocketIO choose a compatible async mode so the app can still run.
try:
    import eventlet  # noqa: F401
    _async_mode = "eventlet"
except Exception:
    _async_mode = None


ROOMS = ("General", "Tech", "Random")
MAX_HISTORY = 50

app = Flask(__name__)
app.config["SECRET_KEY"] = "nexchat-local-dev"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=_async_mode)

room_histories = {room: [] for room in ROOMS}
room_users = {room: {} for room in ROOMS}
user_sessions = {}


def timestamp():
    return datetime.now().strftime("%I:%M %p").lstrip("0")


def normalize_room(room):
    return room if room in ROOMS else "General"


def trim_history(room):
    room_histories[room] = room_histories[room][-MAX_HISTORY:]


def add_system_message(room, text):
    message = {
        "type": "system",
        "text": text,
        "timestamp": timestamp(),
    }
    room_histories[room].append(message)
    trim_history(room)
    return message


def online_users(room):
    return sorted(room_users[room].values(), key=str.lower)


def emit_users(room):
    socketio.emit("users_update", {"room": room, "users": online_users(room)}, room=room)


def leave_current_room(sid):
    session = user_sessions.get(sid)
    if not session:
        return

    room = session["room"]
    username = session["username"]

    if sid in room_users[room]:
        room_users[room].pop(sid, None)
        leave_room(room, sid=sid)
        system_message = add_system_message(room, f"{username} left the room")
        socketio.emit("system_notification", system_message, room=room)
        emit_users(room)

    user_sessions.pop(sid, None)


@app.route("/")
def index():
    return render_template("index.html", rooms=ROOMS)


@app.route("/chat")
def chat():
    username = request.args.get("username", "").strip()
    room = normalize_room(request.args.get("room", "General"))
    if not username:
        return render_template("index.html", rooms=ROOMS, error="Choose a username to join NexChat.")

    return render_template("chat.html", username=username[:24], room=room, rooms=ROOMS)


@socketio.on("join")
def handle_join(data):
    username = (data.get("username") or "Guest").strip()[:24]
    room = normalize_room(data.get("room"))
    sid = request.sid

    leave_current_room(sid)
    join_room(room)
    room_users[room][sid] = username
    user_sessions[sid] = {"username": username, "room": room}

    emit("room_history", {"room": room, "messages": room_histories[room]})
    system_message = add_system_message(room, f"{username} joined the room")
    socketio.emit("system_notification", system_message, room=room)
    emit_users(room)


@socketio.on("leave")
def handle_leave():
    leave_current_room(request.sid)


@socketio.on("send_message")
def handle_send_message(data):
    session = user_sessions.get(request.sid)
    if not session:
        return

    text = (data.get("text") or "").strip()
    if not text:
        return

    room = session["room"]
    message = {
        "type": "message",
        "sid": request.sid,
        "username": session["username"],
        "text": text[:1000],
        "timestamp": timestamp(),
    }

    room_histories[room].append(message)
    trim_history(room)
    socketio.emit("receive_message", message, room=room)


@socketio.on("typing")
def handle_typing():
    session = user_sessions.get(request.sid)
    if session:
        emit("typing", {"username": session["username"]}, room=session["room"], skip_sid=request.sid)


@socketio.on("stop_typing")
def handle_stop_typing():
    session = user_sessions.get(request.sid)
    if session:
        emit("stop_typing", {"username": session["username"]}, room=session["room"], skip_sid=request.sid)


@socketio.on("disconnect")
def handle_disconnect():
    leave_current_room(request.sid)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False)
