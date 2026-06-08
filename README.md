# NexChat

NexChat is a real-time Flask chat app with Socket.IO-powered rooms, live typing indicators, and room-based user presence.

## Features

- Multiple chat rooms: General, Tech, and Random
- Real-time messaging with Flask-SocketIO
- Live typing indicators
- Online user list per room
- Message history capped per room

## Requirements

- Python 3.10+ recommended
- pip

## Setup

1. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

2. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

## Run

Start the development server:

```bash
python app.py
```

Then open http://127.0.0.1:5000 in your browser.

## Project Structure

- `app.py` - Flask app and Socket.IO event handlers
- `templates/` - Jinja templates for the login and chat views
- `static/css/style.css` - App styling
- `static/js/chat.js` - Client-side chat behavior

## Notes

- The app stores room history in memory, so messages reset when the server restarts.
- The default room is `General` if an invalid room is provided.