from flask import Flask, request, jsonify, Response, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge
from backend.logging import log_event
import logging
import os
import time
import json
import requests
import shutil
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

# Set correct timezone dynamically for the process
if os.environ.get('TZ') is None:
    os.environ['TZ'] = 'Asia/Kolkata'
if os.name != 'nt' and hasattr(time, 'tzset'):
    time.tzset()

from backend import config
from backend.rag import RAGProvider
from backend.database import db
from backend.database.init_db import init_db
from backend.models import get_embedding_model
from backend.file_system import (
    FileSystemChannelManager, file_system_bp
)
from backend.files import FileManager, files_bp
from backend.task_manager import task_manager
from backend.database import response_cache as cache_system
from backend.version import get_version, VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH
from backend.chat.router import chat_bp, openai_bp, personas_bp, skills_bp
from backend.tools.router import tools_bp
from backend.files.router import files_bp
from backend.logging.router import logs_bp
from backend.models import models_bp

# _agent_callbacks moved to ChatHandler

app = Flask(__name__, static_folder='static')
# Register New Chat Architecture Blueprints
app.register_blueprint(chat_bp, url_prefix='/api/chats')
app.register_blueprint(personas_bp, url_prefix='/api')
app.register_blueprint(skills_bp, url_prefix='/api')
app.register_blueprint(tools_bp, url_prefix='/api/tools')
app.register_blueprint(openai_bp, url_prefix='/v1/chat')
app.register_blueprint(file_system_bp, url_prefix='/api/file_systems')
app.register_blueprint(logs_bp, url_prefix='/api/logs')
app.register_blueprint(files_bp, url_prefix='/api/files')
app.register_blueprint(models_bp, url_prefix='/api/models')

from flask_sock import Sock
import websocket as ws_client
import threading
sock = Sock(app)
app.config['SOCK_SERVER_OPTIONS'] = {'subprotocols': ['binary']}

@sock.route('/api/tools/portal/ws')
def portal_ws_proxy(ws):
    """
    Bidirectional WebSocket proxy: browser <-> playwright_mcp websockify.
    Uses a background thread to forward upstream→browser while the main
    thread handles browser→upstream. This avoids poll-loop timing issues
    with flask-sock's receive() semantics.
    """
    upstream_url = "ws://playwright_mcp:6080/websockify"
    closed = threading.Event()
    upstream = None

    try:
        upstream = ws_client.create_connection(upstream_url)

        # Thread: upstream (VNC) → browser
        def upstream_to_browser():
            try:
                while not closed.is_set():
                    try:
                        opcode, data = upstream.recv_data(control_frame=False)
                        if not data:
                            break
                        ws.send(data)
                    except Exception:
                        break
            finally:
                closed.set()

        t = threading.Thread(target=upstream_to_browser, daemon=True)
        t.start()

        # Main thread: browser → upstream (VNC)
        while not closed.is_set():
            try:
                data = ws.receive()
                if data is None:
                    break
                if isinstance(data, bytes):
                    upstream.send_binary(data)
                else:
                    upstream.send(data)
            except Exception:
                break

    except Exception as e:
        logger.error(f"Portal WS proxy error: {e}")
    finally:
        closed.set()
        if upstream:
            try:
                upstream.close()
            except Exception:
                pass

# Limit request size to 100MB to match FILE_UPLOAD_MAX_SIZE config
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

logger = logging.getLogger(__name__)

# Initialize components with config - load models from model_loader (no fallbacks)
init_db()
embedding_model = get_embedding_model()

# Initialize RAGManager for Research and File RAG (singleton) via provider
rag_manager = RAGProvider.get_manager(
    persist_path=config.CHROMA_PATH,
    api_url=config.EMBEDDING_URL,
    api_key=config.EMBEDDING_API_KEY,
    embedding_model=embedding_model
)

# Initialize file manager with shared RAG manager
file_manager = FileManager(rag_manager=rag_manager)

task_manager.recover_tasks()

# Initialize file_system channel manager for per-chat locking
FileSystemChannelManager.initialize()

import asyncio
try:
    loop = asyncio.get_event_loop()
    # Start InferenceEngine
    from backend.inference import InferenceEngine
    loop.run_until_complete(InferenceEngine().start())
except RuntimeError:
    from backend.inference import InferenceEngine
    asyncio.run(InferenceEngine().start())


@app.route('/')
@app.route('/chat/<chat_id>')
def index(chat_id=None):
    return send_from_directory('static', 'index.html')

@app.before_request
def require_auth():
    if not config.APP_PASSWORD:
        return
    auth = request.authorization
    if not auth or auth.password != config.APP_PASSWORD:
        return Response('Could not verify your access level for that URL.\n'
                        'You have to login with proper credentials', 401,
                        {'WWW-Authenticate': 'Basic realm="Login Required"'})

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


# Error handler for 413 Request Entity Too Large
@app.errorhandler(RequestEntityTooLarge)
def handle_large_file_error(e):
    """Handle files that exceed MAX_CONTENT_LENGTH."""
    return jsonify({
        "error": f"File too large. Maximum size is {100 * 1024 * 1024} bytes (100MB)"
    }), 413



@app.route('/api/version', methods=['GET'])
def get_version_endpoint():
    """Return the application version."""
    return jsonify({
        "version": get_version(),
        "major": VERSION_MAJOR,
        "minor": VERSION_MINOR,
        "patch": VERSION_PATCH
    })




if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
