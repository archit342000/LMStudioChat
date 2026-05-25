import os
import uuid
import time
import logging
import json
import chromadb
from typing import List, Optional, Tuple, Union
from backend.logging import log_event
from backend import config
from .embeddings import AIEmbeddingFunction
from .token_counter import count_tokens

logger = logging.getLogger(__name__)

class ZeroEmbeddingFunction(chromadb.utils.embedding_functions.EmbeddingFunction):
    """A lightweight, zero-latency embedding function that returns zero vectors."""
    def __init__(self, dimension: int = 1):
        self.dimension = dimension

    def __call__(self, input: Union[str, list]) -> list:
        if isinstance(input, str):
            return [[0.0] * self.dimension]
        return [[0.0] * self.dimension] * len(input)

    @staticmethod
    def name() -> str:
        return "zero"

    def get_config(self) -> dict:
        return {"dimension": self.dimension}

class RAGManager:
    """Singleton to manage ChromaDB collections and embeddings."""
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(RAGManager, cls).__new__(cls)
        return cls._instance

    def __init__(self, persist_path: str = None, api_url: str = None, embedding_model: str = None, api_key: str = None):
        if self._initialized:
            return
        
        self.persist_path = persist_path or config.CHROMA_PATH
        self.client = chromadb.PersistentClient(path=self.persist_path)
        
        # Initialize embedding function
        self.embedding_model = embedding_model or config.EMBEDDING_MODEL
        self.embedding_fn = AIEmbeddingFunction(
            api_url=api_url or config.EMBEDDING_URL,
            model_name=self.embedding_model,
            api_key=api_key or config.EMBEDDING_API_KEY
        )
        
        # Track dimensions for validation
        self.embedding_dimension = self._get_default_dimension()
        
        log_event("rag_manager_initialized", {
            "persist_path": self.persist_path,
            "embedding_model": self.embedding_model,
            "embedding_dimension": self.embedding_dimension
        })
        self._initialized = True

    def _get_default_dimension(self) -> int:
        """Heuristic for embedding dimensions based on common models."""
        model = self.embedding_model.lower()
        if "gemma" in model: return 384
        if "mini" in model: return 384
        if "large" in model: return 1024
        if "v3" in model: return 1024
        return 384 # Default

    def _drop_collection(self, name: str):
        """Drop a collection from ChromaDB."""
        try:
            self.client.delete_collection(name=name)
            log_event("rag_collection_dropped", {"collection": name})
            return True
        except Exception as e:
            log_event("rag_drop_collection_error", {"error": str(e), "collection": name})
            return False

    def _get_collection_dimension(self, collection_name: str) -> int:
        """Get the embedding dimension of an existing collection by sampling."""
        try:
            coll = self.client.get_collection(name=collection_name)
            sample = coll.get(limit=1, include=["embeddings"])
            # Explicit check for None and length to avoid array ambiguity errors
            if sample and sample.get('embeddings') is not None and len(sample['embeddings']) > 0:
                for emb in sample['embeddings']:
                    if emb is not None and len(emb) > 0:
                        return len(emb)
            return -1
        except Exception as e:
            log_event("rag_collection_dimension_error", {
                "error": str(e),
                "collection": collection_name
            })
        return 0

    @classmethod
    def reset_instance(cls):
        """Reset the singleton instance (useful for testing)."""
        cls._instance = None
        cls._initialized = False

    @classmethod
    def drop_all_collections(cls, persist_path=None):
        """Drop all RAG collections."""
        import chromadb
        client = chromadb.PersistentClient(path=persist_path or config.CHROMA_PATH)

        for coll_name in ["file_store", "research_store"]:
            try:
                client.delete_collection(name=coll_name)
                log_event("rag_collection_reset", {"collection": coll_name, "action": "dropped"})
            except Exception as e:
                log_event("rag_collection_reset_error", {"collection": coll_name, "error": str(e)})

    # Collection Management
    def get_or_create_collection(self, name: str, disable_embeddings: bool = False) -> chromadb.Collection:
        """Get or create a collection with L2 (Euclidean) distance."""
        return self._ensure_l2_collection(name, disable_embeddings=disable_embeddings)

    def _ensure_l2_collection(self, name: str, disable_embeddings: bool = False) -> chromadb.Collection:
        try:
            embedding_function = ZeroEmbeddingFunction() if disable_embeddings else self.embedding_fn
            existing = self.client.get_collection(name=name, embedding_function=embedding_function)
            coll_meta = existing.metadata or {}
            stored_model = coll_meta.get("embedding_model")
            expected_model = "none" if disable_embeddings else self.embedding_model
            if stored_model and stored_model != expected_model:
                self._drop_collection(name)
                existing = None
        except (ValueError, Exception):
            # Drop the collection if it exists but has a conflicting embedding function schema
            self._drop_collection(name)
            existing = None

        if existing is None:
            embedding_function = ZeroEmbeddingFunction() if disable_embeddings else self.embedding_fn
            return self.client.get_or_create_collection(
                name=name,
                embedding_function=embedding_function,
                metadata={
                    "hnsw:space": "l2",
                    "embedding_model": self.embedding_model if not disable_embeddings else "none",
                    "embedding_dimension": self.embedding_dimension if not disable_embeddings else 1
                }
            )

        # Validation of existing collection
        actual_dim = self._get_collection_dimension(name)
        if actual_dim > 0 and actual_dim != self.embedding_dimension and not disable_embeddings:
            logger.warning(f"RAGManager: Collection '{name}' dimension mismatch ({actual_dim} != {self.embedding_dimension}). Recreating...")
            self._drop_collection(name)
            return self._ensure_l2_collection(name, disable_embeddings=disable_embeddings)

        return existing

    def _ensure_l2_collections(self, name: str) -> Tuple[chromadb.Collection, chromadb.Collection]:
        """Ensures both vector and BM25 collections exist for hybrid search."""

        vector_coll = self._ensure_l2_collection(f"{name}_vector")
        bm25_coll = self._ensure_l2_collection(f"{name}_bm25", disable_embeddings=True)

        return vector_coll, bm25_coll

    def chunk_text(self, text: str, max_tokens: int = 512, overlap: int = 50, line_offset: int = 0):
        """Split text into chunks based on token limits. Returns List[ChunkResult]."""
        from .chunking import ChunkResult
        if not text:
            return []
        
        words = text.split()
        chunks = []
        current_chunk = ""
        current_tokens = 0
        
        for word in words:
            word_tokens = count_tokens(word)
            if current_tokens + word_tokens > max_tokens:
                stripped_chunk = current_chunk.strip()
                if stripped_chunk:
                    idx = text.find(stripped_chunk[:100])
                    start_line = line_offset + 1 + (text.count('\n', 0, idx) if idx != -1 else 0)
                    chunks.append(ChunkResult(text=stripped_chunk, line_start=start_line, line_end=start_line + stripped_chunk.count('\n')))
                # Keep some overlap
                overlap_words = current_chunk.split()[-overlap:]
                current_chunk = " ".join(overlap_words) + " " + word + " "
                current_tokens = count_tokens(current_chunk)
            else:
                current_chunk += word + " "
                current_tokens += word_tokens
                
        if current_chunk.strip():
            stripped_chunk = current_chunk.strip()
            idx = text.find(stripped_chunk[:100])
            start_line = line_offset + 1 + (text.count('\n', 0, idx) if idx != -1 else 0)
            chunks.append(ChunkResult(text=stripped_chunk, line_start=start_line, line_end=start_line + stripped_chunk.count('\n')))
            
        return chunks

    async def embed_texts(self, texts: list, task: str = "document", chat_id: str = None) -> list:
        if task == "query":
            results = []
            uncached_indices = []
            uncached_texts = []
            
            for i, text in enumerate(texts):
                # Simple cache lookup (placeholder for more robust cache)
                results.append(None)
                uncached_indices.append(i)
                uncached_texts.append(text)
            
            if uncached_texts:
                validated = [t if t and len(t.strip()) > 0 else "" for t in uncached_texts]
                # Use the new async method of AIEmbeddingFunction
                new_embeddings = await self.embedding_fn.embed_async(validated, task=task, chat_id=chat_id)
                
                for idx, emb in zip(uncached_indices, new_embeddings):
                    results[idx] = emb
            return results

        validated = [t if t and len(t.strip()) > 0 else "" for t in texts]
        return await self.embedding_fn.embed_async(validated, task=task, chat_id=chat_id)

    def embed_texts_sync(self, texts: list, task: str = "document", chat_id: str = None) -> list:
        """Synchronous version of embed_texts."""
        validated = [t if t and len(t.strip()) > 0 else "" for t in texts]
        return self.embedding_fn(validated) # Calls the sync __call__
