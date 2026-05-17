import time
import json
import logging
from ..db_layer import make_connection
from ..cache_layer import cache_layer
from ..cache_system import cache_system
from .base import BaseMixin

logger = logging.getLogger(__name__)

class HistoryOpsMixin(BaseMixin):
    """
    Mixin for the Turn-Anchored "Woven" history reconstruction.
    """

    def get_message_order_map(self, chat_id: str) -> list:
        """Get the message order map for a chat."""
        self._log_db_wrapper_op("GET_MESSAGE_ORDER_MAP_START", chat_id)
        fetch_start = time.time()

        def _fetch():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("SELECT message_order_map FROM chats WHERE id = ?", (chat_id,))
                row = c.fetchone()
                if row and row[0]:
                    try:
                        return json.loads(row[0])
                    except (json.JSONDecodeError, TypeError):
                        return []
                return []
            finally:
                conn.close()

        result = _fetch()
        duration_ms = (time.time() - fetch_start) * 1000
        self._log_db_wrapper_op("GET_MESSAGE_ORDER_MAP_END", chat_id, f"count={len(result)} duration_ms={duration_ms:.2f}")
        return result

    def update_message_order_map(self, chat_id: str, order_map: list) -> bool:
        """Update the message order map for a chat."""
        self._log_db_wrapper_op("UPDATE_MESSAGE_ORDER_MAP_START", chat_id)
        write_start = time.time()

        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                order_map_json = json.dumps(order_map)
                c.execute(
                    "UPDATE chats SET message_order_map = ? WHERE id = ?",
                    (order_map_json, chat_id)
                )
                conn.commit()
                return c.rowcount > 0
            finally:
                conn.close()

        result = _write()
        cache_layer.invalidate("chats", chat_id)
        cache_layer.invalidate("chats_full", chat_id)
        self._log_db_wrapper_op("UPDATE_MESSAGE_ORDER_MAP_END", chat_id, f"duration_ms={(time.time() - write_start)*1000:.2f}")
        return result

    def get_woven_history(self, chat_id: str):
        """
        Retrieves the full message history by weaving together main messages, 
        sub-agent threads, and active SSE chunks according to the order_map.
        """
        self._log_db_wrapper_op("GET_WOVEN_HISTORY_START", chat_id)
        fetch_start = time.time()
        
        # 1. Fetch all raw data components
        messages = self.get_messages(chat_id)
        msg_map = {m['id']: m for m in messages}
        
        # Sub-agent messages
        sub_agent_messages = self.get_all_sub_agent_messages(chat_id)
        sub_msgs_by_parent = {}
        for sm in sub_agent_messages:
            pid = str(sm['parent_message_id'])
            if pid not in sub_msgs_by_parent:
                sub_msgs_by_parent[pid] = []
            sub_msgs_by_parent[pid].append(sm)

        # Collections (search results, snippets)
        all_collections = self.get_collections(chat_id)
        colls_by_parent = {}
        for col in all_collections:
            pid = str(col['parent_message_id'])
            if pid not in colls_by_parent:
                colls_by_parent[pid] = []
            colls_by_parent[pid].append(col)
            
        transient_chunks = cache_system.get_sse_chunks(chat_id) or []
        chunks_by_parent = {}
        for c in transient_chunks:
            pid = str(c.get('parent_message_id'))
            if pid not in chunks_by_parent:
                chunks_by_parent[pid] = []
            chunks_by_parent[pid].append(c)
            
        order_info = self.get_message_order_map(chat_id)
        if not order_info:
            return messages
        woven = []
        for entry in order_info:
            if not isinstance(entry, dict):
                continue
                
            e_type = entry.get('type')
            if e_type == 'message':
                mid = entry.get('id')
                if mid in msg_map:
                    msg = msg_map[mid].copy()
                    mid_str = str(mid)
                    
                    # Attach Sub-agent History
                    msg_subs = sub_msgs_by_parent.get(mid_str, [])
                    
                    # SCOPED ANCHORING: Also check for sub-agent history anchored to this message's tool calls
                    if msg.get('tool_calls'):
                        try:
                            tcs = msg['tool_calls']
                            if isinstance(tcs, list):
                                for tc in tcs:
                                    tc_id = str(tc.get('id'))
                                    if tc_id and tc_id in sub_msgs_by_parent:
                                        msg_subs.extend(sub_msgs_by_parent[tc_id])
                        except:
                            pass
                    
                    if msg_subs:
                        # Sort by sequence_order if present
                        msg['sub_agent_history'] = sorted(msg_subs, key=lambda x: x.get('sequence_order', 0))
                    
                    # Attach Collections
                    msg_colls = list(colls_by_parent.get(mid_str, []))
                    
                    # SCOPED ANCHORING: For Main AI assistant messages, also check if their 
                    # parent user message has any collections (like turn-scoped task lists).
                    if msg.get('role') == 'assistant':
                        p_id = str(msg.get('parent_id'))
                        if p_id and p_id in colls_by_parent:
                            msg_colls.extend(colls_by_parent[p_id])

                    if msg.get('tool_calls'):
                        try:
                            tcs = msg['tool_calls']
                            if isinstance(tcs, list):
                                for tc in tcs:
                                    tc_id = str(tc.get('id'))
                                    if tc_id and tc_id in colls_by_parent:
                                        msg_colls.extend(colls_by_parent[tc_id])
                        except:
                            pass
                            
                    if msg_colls:
                        msg['collections'] = msg_colls
                        
                    woven.append(msg)
                    
            elif e_type == 'sse':
                parent_id = str(entry.get('parent_id'))
                if parent_id in chunks_by_parent:
                    sorted_chunks = sorted(chunks_by_parent[parent_id], key=lambda x: x.get('chunk_index', 0))
                    item = {
                        "id": f"sse_{parent_id}",
                        "role": "assistant_active",
                        "parent_id": parent_id,
                        "chunks": sorted_chunks,
                        "timestamp": sorted_chunks[0].get('timestamp', time.time()) if sorted_chunks else time.time()
                    }
                    
                    # Check for "Ghost" collections (collections created during the active turn)
                    msg_colls = colls_by_parent.get(parent_id, [])
                    
                    # SCOPED ANCHORING: For active turns, we might not have the tool_call_id in a message yet,
                    # but the collections might already be anchored to it if a sub-agent is running.
                    # However, SSE chunks are still anchored to the parent_id (assistant message ID).
                    # Sub-agents currently emit their own SSE chunks.
                    
                    if msg_colls:
                        item['collections'] = msg_colls
                        
                    woven.append(item)
                    
        duration_ms = (time.time() - fetch_start) * 1000
        self._log_db_wrapper_op("GET_WOVEN_HISTORY_END", chat_id, f"duration_ms={duration_ms:.2f} count={len(woven)}")
        return woven
