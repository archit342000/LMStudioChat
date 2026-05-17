import sqlite3
import time
import json
import logging
from ..db_layer import make_connection
from ..cache_layer import cache_layer
from ..cache_system import cache_system
from typing import Any
from .base import BaseMixin

logger = logging.getLogger(__name__)

class ArtifactOpsMixin(BaseMixin):
    """
    Mixin for turn artifacts: SSE chunks, Sub-agent messages, Collections, and Files.
    """

    # ==================== FILE OPERATIONS ====================

    def get_chat_files(self, chat_id: str) -> list:
        """Get all files for a chat session (cached)."""
        self._log_db_wrapper_op("GET_CHAT_FILES_START", chat_id)
        fetch_start = time.time()
        def _fetch():
            conn = make_connection()
            try:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute("SELECT * FROM files WHERE chat_id = ? ORDER BY created_at DESC", (chat_id,))
                return [dict(row) for row in c.fetchall()]
            finally:
                conn.close()
        
        result = cache_layer.get("files", f"chat:{chat_id}", _fetch, ttl=300)
        duration_ms = (time.time() - fetch_start) * 1000
        self._log_db_wrapper_op("GET_CHAT_FILES_END", chat_id, f"count={len(result)} duration_ms={duration_ms:.2f}")
        return result

    def get_file(self, file_id: str):
        """Get file metadata."""
        def _fetch():
            conn = make_connection()
            try:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute("SELECT * FROM files WHERE id = ?", (file_id,))
                row = c.fetchone()
                return dict(row) if row else None
            finally:
                conn.close()
        return cache_layer.get("files", file_id, _fetch, ttl=300)

    def delete_file(self, file_id: str):
        """Delete a file from database."""
        self._log_db_wrapper_op("DELETE_FILE_START", None, f"file_id={file_id}")
        write_start = time.time()
        file_meta = self.get_file(file_id)
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("DELETE FROM files WHERE id = ?", (file_id,))
                conn.commit()
            finally:
                conn.close()
        _write()
        if file_meta:
            cache_layer.invalidate("files", file_id)
            cache_layer.invalidate("files", f"chat:{file_meta.get('chat_id')}")
        self._log_db_wrapper_op("DELETE_FILE_END", None, f"file_id={file_id} duration_ms={(time.time() - write_start)*1000:.2f}")

    def update_file_content(self, file_id: str, content_text: str) -> bool:
        """Update file metadata with extracted content."""
        write_start = time.time()
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("UPDATE files SET content_text = ? WHERE id = ?", (content_text, file_id))
                conn.commit()
                return c.rowcount > 0
            finally:
                conn.close()
        result = _write()
        file_meta = self.get_file(file_id)
        if file_meta:
            cache_layer.invalidate("files", file_id)
            cache_layer.invalidate("files", f"chat:{file_meta.get('chat_id')}")
        return result

    def save_file(self, file_id: str, chat_id: str, original_filename: str, 
                  stored_filename: str, mime_type: str, file_size: int, 
                  content_text: str = None) -> bool:
        """Save file metadata to database."""
        self._log_db_wrapper_op("SAVE_FILE_START", chat_id, f"file_id={file_id}")
        write_start = time.time()
        
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute('''
                    INSERT INTO files (id, chat_id, original_filename, stored_filename, mime_type, file_size, content_text, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (file_id, chat_id, original_filename, stored_filename, mime_type, file_size, content_text, time.time()))
                conn.commit()
                return True
            except Exception as e:
                logger.error(f"Error saving file metadata: {e}")
                return False
            finally:
                conn.close()
                
        success = _write()
        if success:
            cache_layer.invalidate("files", file_id)
            cache_layer.invalidate("files", f"chat:{chat_id}")
            
        duration_ms = (time.time() - write_start) * 1000
        self._log_db_wrapper_op("SAVE_FILE_END", chat_id, f"success={success} duration_ms={duration_ms:.2f}")
        return success

    def update_file_processing_status(self, file_id: str, status: str) -> bool:
        """Update file processing status."""
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("UPDATE files SET processing_status = ? WHERE id = ?", (status, file_id))
                conn.commit()
                return c.rowcount > 0
            finally:
                conn.close()
        result = _write()
        file_meta = self.get_file(file_id)
        if file_meta:
            cache_layer.invalidate("files", file_id)
            cache_layer.invalidate("files", f"chat:{file_meta.get('chat_id')}")
        return result


    # ==================== SSE CHUNK OPERATIONS ====================

    def flush_sse_chunks(self, chat_id: str, model: str = None, 
                         parent_message_id: Any = None, parent_type: str = 'main') -> bool:
        """
        Atomically persist transient fragments for a SPECIFIC turn anchor to permanent tables.
        This prevents leakage from interrupted or concurrent turns.
        """
        self._log_db_wrapper_op("FLUSH_SSE_CHUNKS_START", chat_id, f"anchor={parent_message_id} type={parent_type}")
        write_start = time.time()

        def _flush():
            # Filter chunks strictly by anchor to prevent turn-leakage
            chunks = cache_system.get_sse_chunks(chat_id, parent_message_id=parent_message_id, parent_type=parent_type)
            if not chunks:
                logger.warning(f"[FLUSH] No SSE chunks found for chat {chat_id} anchor {parent_message_id} - nothing to flush.")
                return True

            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("BEGIN IMMEDIATE")

                try:
                    # Use the first chunk's metadata if specific anchor wasn't passed (fallback)
                    actual_parent_id = parent_message_id if parent_message_id is not None else chunks[0].get('parent_message_id')
                    actual_parent_type = parent_type if parent_type else chunks[0].get('parent_type', 'main')
                    first_ts = chunks[0].get('timestamp', time.time())

                    if actual_parent_id is None:
                        logger.error(f"[FLUSH] Cannot flush chunks: parent_message_id is None.")
                        return False

                    # Aggregate content
                    thinking_parts, content_parts, tool_calls_parts, tool_result_parts = [], [], [], []
                    for row in chunks:
                        c_type, content = row.get('chunk_type'), row.get('content') or ''
                        if c_type == 'thinking': thinking_parts.append(content)
                        elif c_type == 'content': content_parts.append(content)
                        elif c_type == 'tool_call': tool_calls_parts.append(content)
                        elif c_type == 'tool_result': tool_result_parts.append(content)

                    thinking_text = ''.join(thinking_parts).strip()
                    content_text = ''.join(content_parts).strip()

                    # Robust merging of tool call fragments
                    merged_tool_calls = {}
                    for s in tool_calls_parts:
                        if not s: continue
                        try:
                            tc_delta = json.loads(s)
                            deltas = tc_delta if isinstance(tc_delta, list) else [tc_delta]
                            for d in deltas:
                                idx = d.get('index', 0)
                                if idx not in merged_tool_calls:
                                    merged_tool_calls[idx] = d
                                else:
                                    existing = merged_tool_calls[idx]
                                    if 'function' in d:
                                        if 'function' not in existing: existing['function'] = {}
                                        if 'arguments' in d['function']:
                                            existing['function']['arguments'] = (existing['function'].get('arguments') or '') + (d['function'].get('arguments') or '')
                                        if 'name' in d['function']:
                                            existing['function']['name'] = d['function']['name']
                                    if 'id' in d: existing['id'] = d['id']
                        except: continue

                    stored_tool_calls = json.dumps(list(merged_tool_calls.values())) if merged_tool_calls else None
                    new_message_ids = []
                    last_asst_id = None

                    if actual_parent_type == 'main':
                        c.execute('''
                            INSERT INTO messages (chat_id, role, content, timestamp, model, tool_calls, parent_id, reasoning_content) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (chat_id, 'assistant', content_text, first_ts, model, stored_tool_calls, actual_parent_id, thinking_text))
                        last_asst_id = c.lastrowid
                        new_message_ids.append(last_asst_id)

                        for tr in tool_result_parts:
                            c.execute('''
                                INSERT INTO messages (chat_id, role, content, timestamp, parent_id) 
                                VALUES (?, ?, ?, ?, ?)
                            ''', (chat_id, 'tool', tr, first_ts, actual_parent_id))
                            new_message_ids.append(c.lastrowid)

                        # Update Order Map
                        c.execute("SELECT message_order_map FROM chats WHERE id = ?", (chat_id,))
                        row = c.fetchone()
                        try: existing_map = json.loads(row[0]) if row and row[0] else []
                        except: existing_map = []

                        normalized_map = []
                        for entry in existing_map:
                            if isinstance(entry, dict):
                                if entry.get('type') == 'sse' and entry.get('parent_id') == actual_parent_id:
                                    continue
                                normalized_map.append(entry)

                        for mid in new_message_ids:
                            normalized_map.append({'type': 'message', 'id': mid})

                        c.execute('''
                            UPDATE chats SET 
                                message_order_map = ?, 
                                last_assistant_id = ?,
                                timestamp = ?
                            WHERE id = ?
                        ''', (json.dumps(normalized_map), last_asst_id, time.time(), chat_id))

                    else:
                        # Sub-Agent History
                        agent_name = actual_parent_type
                        c.execute('''
                            SELECT MAX(sequence_order) FROM sub_agent_messages 
                            WHERE chat_id = ? AND parent_message_id = ? AND agent_name = ?
                        ''', (chat_id, actual_parent_id, agent_name))
                        seq = (c.fetchone()[0] or 0) + 1

                        c.execute('''
                            INSERT INTO sub_agent_messages (chat_id, parent_message_id, parent_type, agent_name, sequence_order, role, content, tool_calls, model, timestamp, reasoning_content) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (chat_id, actual_parent_id, actual_parent_type, agent_name, seq, 'assistant', content_text, stored_tool_calls, model, first_ts, thinking_text))

                        for tr in tool_result_parts:
                            seq += 1
                            c.execute('''
                                INSERT INTO sub_agent_messages (chat_id, parent_message_id, parent_type, agent_name, sequence_order, role, content, timestamp) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (chat_id, actual_parent_id, actual_parent_type, agent_name, seq, 'tool', tr, first_ts))

                    c.execute("COMMIT")
                    # SURGICAL CLEANUP: Only remove what we just saved
                    cache_system.delete_sse_chunks(chat_id, parent_message_id=actual_parent_id, parent_type=actual_parent_type)

                    cache_layer.invalidate("messages", f"chat:{chat_id}")
                    if actual_parent_type != "main":
                        cache_layer.invalidate("messages", f"chat:{chat_id}:{actual_parent_type}:{actual_parent_id}")
                    cache_layer.invalidate("chats", chat_id)
                    cache_layer.invalidate("chats_full", chat_id)
                    return True
                except Exception as e:
                    c.execute("ROLLBACK")
                    logger.error(f"[FLUSH] DB error: {e}", exc_info=True)
                    return False
            finally:
                conn.close()

        success = _flush()
        duration_ms = (time.time() - write_start) * 1000
        self._log_db_wrapper_op("FLUSH_SSE_CHUNKS_END", chat_id, f"success={success} duration_ms={duration_ms:.2f}")
        return success

    # ==================== COLLECTION OPERATIONS ====================

    def get_collections(self, chat_id: str, parent_message_id: Any = None, parent_type: str = None) -> list:
        """Get collections for a chat (cached)."""
        def _fetch():
            conn = make_connection()
            try:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                if parent_message_id and parent_type:
                    c.execute("SELECT * FROM collections WHERE chat_id = ? AND parent_message_id = ? AND parent_type = ?", (chat_id, parent_message_id, parent_type))
                elif parent_message_id:
                    c.execute("SELECT * FROM collections WHERE chat_id = ? AND parent_message_id = ?", (chat_id, parent_message_id))
                else:
                    c.execute("SELECT * FROM collections WHERE chat_id = ?", (chat_id,))
                return [dict(row) for row in c.fetchall()]
            finally:
                conn.close()

        cache_key = f"chat:{chat_id}"
        if parent_message_id: cache_key += f":p_{parent_message_id}"
        if parent_type: cache_key += f":t_{parent_type}"
        
        return cache_layer.get("collections", cache_key, _fetch, ttl=300)

    def add_collection(self, chat_id: str, parent_message_id: Any, parent_type: str,
                       collection_type: str, items: list, timestamp: float = None, overwrite: bool = False) -> int:
        """Add a collection."""
        if timestamp is None: timestamp = time.time()
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                if overwrite:
                    c.execute('''DELETE FROM collections WHERE chat_id = ? AND parent_message_id = ? AND parent_type = ? AND collection_type = ?''', 
                              (chat_id, parent_message_id, parent_type, collection_type))
                c.execute('''INSERT INTO collections (chat_id, parent_message_id, parent_type, collection_type, items, timestamp) VALUES (?, ?, ?, ?, ?, ?)''', 
                          (chat_id, parent_message_id, parent_type, collection_type, json.dumps(items), timestamp))
                conn.commit()
                return c.lastrowid
            finally:
                conn.close()
        result = _write()
        
        # Comprehensive cache invalidation
        cache_layer.invalidate("collections", f"chat:{chat_id}")
        if parent_message_id:
            cache_layer.invalidate("collections", f"chat:{chat_id}:p_{parent_message_id}")
            if parent_type:
                cache_layer.invalidate("collections", f"chat:{chat_id}:p_{parent_message_id}:t_{parent_type}")
        
        cache_layer.invalidate("chats_full", chat_id)
        return result
