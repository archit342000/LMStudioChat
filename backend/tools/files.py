"""
Tool implementation for the read_file LLM tool.
Orchestrates file reading and semantic search via FileRAG and the database.
"""
import logging
from backend.database import db
from backend.rag import RAGProvider, FileRAG
from backend import config
from backend.models import get_embedding_model

logger = logging.getLogger(__name__)

def read_file(file_id: str, query: str = None, **kwargs):
    """
    Reads the content of an uploaded file.
    If a query is provided, performs a semantic search using RAG.
    Otherwise, returns the full text content (truncated for safety).
    """
    logger.info(f"[TOOL] read_file: file_id={file_id}, query={query}")

    # 1. Fetch file metadata
    try:
        file_meta = db.get_file(file_id)
        if not file_meta:
            return f"Error: File with ID {file_id} not found."
    except Exception as e:
        logger.error(f"Failed to fetch file metadata from database for {file_id}: {e}", exc_info=True)
        return f"Error: Failed to access database: {str(e)}"

    filename = file_meta.get('original_filename', 'Unknown')

    # 2. Case A: Semantic Search (Query Provided)
    if query:
        try:
            # Get RAG Manager
            embedding_model = get_embedding_model()
            rag_manager = RAGProvider.get_manager(
                persist_path=config.CHROMA_PATH,
                embedding_model=embedding_model
            )
            file_rag = FileRAG(rag_manager=rag_manager)
            
            # Retrieve relevant chunks
            results = file_rag.retrieve_for_file(file_id, query, n_results=5)
            
            if not results:
                return f"No relevant information found in file '{filename}' for the query: '{query}'."

            formatted_results = []
            for res in results:
                formatted_results.append(f"--- Chunk (Score: {res['score']:.2f}) ---\n{res['text']}")
            
            return f"Found {len(results)} relevant sections in '{filename}':\n\n" + "\n\n".join(formatted_results)

        except Exception as e:
            logger.error(f"RAG retrieval failed for file {file_id}: {e}", exc_info=True)
            return f"Error: Failed to perform semantic search on file '{filename}': {str(e)}"

    # 3. Case B: Full Content (No Query)
    content = file_meta.get('content_text', '')
    if not content:
        return f"File '{filename}' is empty or contains no extractable text (e.g., an image or video without OCR/analysis)."

    # Safety truncation for context window (20k chars)
    CHAR_LIMIT = 20000
    if len(content) > CHAR_LIMIT:
        truncated_content = content[:CHAR_LIMIT]
        return (f"Content of '{filename}' (Truncated to first {CHAR_LIMIT} characters):\n\n{truncated_content}\n\n"
                f"[Note: Content was truncated. Use a specific 'query' to search for other information in this file.]")

    return f"Content of '{filename}':\n\n{content}"
