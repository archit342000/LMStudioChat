from flask import Blueprint, request, jsonify, send_from_directory, Response
import os
import json
import collections
from backend import config

logs_bp = Blueprint('logs', __name__)

@logs_bp.route('/ui')
def logs_page():
    static_dir = os.path.join(os.getcwd(), 'static')
    return send_from_directory(static_dir, 'logs.html')

@logs_bp.route('', methods=['GET'])
@logs_bp.route('/', methods=['GET'])
def get_log_index():
    """Return the latest N network log entries. Default 200, max 1000."""
    try:
        limit = min(int(request.args.get('limit', 200)), 1000)
    except (ValueError, TypeError):
        limit = 200

    index_path = os.path.join(config.DATA_DIR, "logs", "network_index.jsonl")
    if not os.path.exists(index_path):
        return jsonify([])

    # Use deque to efficiently read only the last `limit` lines
    entries = collections.deque(maxlen=limit)
    try:
        with open(index_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except Exception:
                    pass
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(list(reversed(entries)))

@logs_bp.route('/detail', methods=['GET'])
def get_log_detail():
    rel_path = request.args.get('path')
    if not rel_path:
        return jsonify({"error": "Missing path"}), 400
        
    # Security: Ensure path is within the logs directory
    base_logs = os.path.abspath(os.path.join(config.DATA_DIR, "logs"))
    target_path = os.path.abspath(os.path.join(base_logs, rel_path))
    
    if not target_path.startswith(base_logs + os.sep) and target_path != base_logs:
        return jsonify({"error": "Access denied"}), 403
        
    if not os.path.exists(target_path):
        return jsonify({"error": "File not found"}), 404
        
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@logs_bp.route('/events', methods=['GET'])
def get_event_logs():
    """Return the latest N events from the most recent event log file."""
    try:
        limit = min(int(request.args.get('limit', 500)), 2000)
    except (ValueError, TypeError):
        limit = 500

    event_dir = os.path.join(config.DATA_DIR, "logs", "general")
    if not os.path.exists(event_dir):
        return jsonify([])

    files = sorted([f for f in os.listdir(event_dir) if f.endswith("_events.jsonl")], reverse=True)
    if not files:
        return jsonify([])

    entries = collections.deque(maxlen=limit)
    try:
        with open(os.path.join(event_dir, files[0]), "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except Exception:
                    pass
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(list(reversed(entries)))

@logs_bp.route('/app', methods=['GET'])
def get_app_logs():
    """Get the latest N app log lines using a fast binary seek-from-end tail."""
    try:
        limit = min(int(request.args.get('limit', 200)), 1000)
    except (ValueError, TypeError):
        limit = 200

    log_file = os.path.join(config.DATA_DIR, "logs", "app.log")
    if not os.path.exists(log_file):
        return jsonify({"logs": [], "total": 0})

    try:
        logs = _tail_file(log_file, limit)
        return jsonify({"logs": list(reversed(logs)), "total": len(logs)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _tail_file(path, n, chunk_size=32768):
    """Efficiently return the last n lines of a file using binary seek."""
    with open(path, 'rb') as f:
        f.seek(0, 2)  # seek to end
        file_size = f.tell()
        if file_size == 0:
            return []

        remaining = file_size
        lines_found = []
        buf = b''

        while remaining > 0 and len(lines_found) <= n:
            read_size = min(chunk_size, remaining)
            remaining -= read_size
            f.seek(remaining)
            chunk = f.read(read_size)
            buf = chunk + buf
            lines_found = buf.split(b'\n')

        # lines_found[0] may be an incomplete line; drop it unless we reached BOF
        if remaining > 0:
            lines_found = lines_found[1:]

        # Decode, strip, drop empties, return last n
        result = []
        for line in lines_found:
            decoded = line.decode('utf-8', errors='replace').rstrip()
            if decoded:
                result.append(decoded)

        return result[-n:]

@logs_bp.route('/app/lines', methods=['GET'])
def get_app_log_lines():
    """Get app logs from a byte-offset range (avoids reading the full file)."""
    log_file = os.path.join(config.DATA_DIR, "logs", "app.log")
    start = request.args.get('start', 0, type=int)
    end = request.args.get('end', 100, type=int)
    limit = max(1, min(end - start, 500))  # never return more than 500 lines at once

    if not os.path.exists(log_file):
        return jsonify({"logs": [], "start": start, "end": end})

    try:
        # Return `limit` lines starting at `start` without reading the whole file
        logs = []
        with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
            for i, line in enumerate(f):
                if i < start:
                    continue
                if i >= start + limit or i >= end:
                    break
                stripped = line.rstrip('\n')
                if stripped:
                    logs.append(stripped)
        return jsonify({"logs": logs, "start": start, "end": len(logs) + start})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
