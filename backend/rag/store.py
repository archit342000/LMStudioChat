import uuid
import hashlib
import time
import math
import logging
from backend.logging.logger import log_event
from backend import config
from .embeddings import _cosine_similarity
from .manager import RAGManager

logger = logging.getLogger(__name__)

class RAGStore:
    """
    Base class for all RAG store implementations.
    Uses dual collection pattern for hybrid search.
    """

    def __init__(self, rag_manager: RAGManager, collection_name: str):
        self.rag_manager = rag_manager
        self.collection_name = collection_name
        # Note: Collections are still created synchronously during init
        self.vector_collection, self.bm25_collection = rag_manager._ensure_l2_collections(collection_name)

    async def store(self, documents: list, metadatas: list, ids: list = None, chat_id: str = None) -> list:
        """
        Store documents and their metadata in both vector and BM25 collections.
        """
        if not documents:
            return []

        if ids is None:
            ids = [str(uuid.uuid4()) for _ in range(len(documents))]

        log_event("rag_store_start", {"count": len(documents), "collection": self.collection_name, "chat_id": chat_id})
        start_time = time.time()

        # 1. Generate embeddings for the whole batch
        logger.info(f"RAGStore: Generating embeddings for {len(documents)} docs...")
        embeddings = None
        try:
            embeddings = await self.rag_manager.embed_texts(documents, task="document", chat_id=chat_id)
            logger.debug(f"RAGStore: Embeddings generated in {time.time() - start_time:.2f}s")
        except Exception as e:
            logger.warning(f"RAGStore: Failed to generate embeddings for storage: {e}. Indexing lexical-only.")

        # 2. Upsert to ChromaDB in batches
        CHROMA_UPSERT_BATCH_SIZE = getattr(config, 'CHROMA_UPSERT_BATCH_SIZE', 100)
        
        for i in range(0, len(ids), CHROMA_UPSERT_BATCH_SIZE):
            batch_end = i + CHROMA_UPSERT_BATCH_SIZE
            batch_slice = slice(i, batch_end)
            
            # Vector collection (with embeddings)
            if embeddings is not None:
                try:
                    logger.info(f"RAGStore: Upserting batch {i//CHROMA_UPSERT_BATCH_SIZE + 1} to vector collection...")
                    self.vector_collection.upsert(
                        documents=documents[batch_slice],
                        embeddings=embeddings[batch_slice],
                        metadatas=metadatas[batch_slice],
                        ids=ids[batch_slice]
                    )
                except Exception as ve:
                    logger.error(f"Vector collection upsert error: {ve}")
            
            # BM25 collection (no embeddings - lexical only)
            try:
                logger.info(f"RAGStore: Upserting batch {i//CHROMA_UPSERT_BATCH_SIZE + 1} to BM25 collection...")
                self.bm25_collection.upsert(
                    documents=documents[batch_slice],
                    metadatas=metadatas[batch_slice],
                    ids=ids[batch_slice]
                )
            except Exception as be:
                logger.error(f"BM25 collection upsert error: {be}")

        duration = time.time() - start_time
        log_event("rag_store_complete", {"count": len(documents), "duration_s": duration, "chat_id": chat_id})
        logger.info(f"RAGStore: Successfully stored {len(documents)} docs in {duration:.2f}s")
        return ids

    async def retrieve_by_query(self, query: str, n_results: int = 5, where: dict = None,
                          hybrid: bool = True, fetch_multiplier: int = None, chat_id: str = None) -> list:
        query_emb = None
        try:
            query_embs = await self.rag_manager.embed_texts([query], task="query", chat_id=chat_id)
            if query_embs:
                query_emb = query_embs[0]
        except Exception as e:
            logger.warning(f"RAGStore: Failed to embed query '{query}': {e}. Falling back to lexical-only search.")

        multiplier = fetch_multiplier if fetch_multiplier is not None else config.RAG_FETCH_MULTIPLIER
        fetch_k = n_results * multiplier

        # 1. Semantic Search (Gemma)
        vector_docs = []
        if query_emb is not None:
            try:
                vector_results = self.vector_collection.query(
                    query_embeddings=[query_emb],
                    n_results=fetch_k,
                    where=where,
                    include=["documents", "metadatas", "embeddings", "distances"]
                )
                vector_docs = self._results_to_docs(vector_results, source="vector")
                NOISE_FLOOR = 0.05
                vector_docs = [d for d in vector_docs if d.get('score', 0) >= NOISE_FLOOR]
            except Exception as ve:
                logger.error(f"Vector search query error: {ve}")

        if (not hybrid or not config.HYBRID_SEARCH_ENABLED) or query_emb is None:
            if query_emb is not None and config.RAG_MIN_SEMANTIC_SCORE:
                vector_docs = [d for d in vector_docs if d.get('score', 0) >= config.RAG_MIN_SEMANTIC_SCORE]
            if query_emb is not None:
                return self._score_only_results(vector_docs, n_results * 2)

        # 2. Lexical Search (True BM25)
        bm25_docs = []
        try:
            # Fetch ALL documents for the given filter from ChromaDB to build the BM25 index
            # For File RAG, this is scoped to a single file, so it's efficient
            all_chunks = self.bm25_collection.get(where=where, include=["documents", "metadatas"])
            if all_chunks and all_chunks.get('documents'):
                docs = all_chunks['documents']
                metas = all_chunks['metadatas']
                ids = all_chunks['ids']
                
                # Tokenize documents
                tokenized_corpus = [doc.lower().split() for doc in docs]
                
                from rank_bm25 import BM25Okapi
                bm25 = BM25Okapi(tokenized_corpus)
                
                # Tokenize query
                tokenized_query = query.lower().split()
                
                # Get scores
                scores = bm25.get_scores(tokenized_query)
                
                # Create results list
                for i in range(len(docs)):
                    bm25_docs.append({
                        "id": ids[i],
                        "text": docs[i],
                        "metadata": metas[i],
                        "lexical_score": float(scores[i])
                    })
                
                # Normalize BM25 scores (0-1 range)
                if bm25_docs:
                    max_score = max(d["lexical_score"] for d in bm25_docs)
                    if max_score > 0:
                        for d in bm25_docs:
                            d["lexical_score"] /= max_score
        except Exception as e:
            logger.error(f"BM25 Retrieval error: {e}")

        # If query_emb is None (embedding failed) but we got lexical results:
        if query_emb is None:
            bm25_docs.sort(key=lambda x: x['lexical_score'], reverse=True)
            return [{
                "id": d["id"],
                "text": d["text"],
                "metadata": d["metadata"],
                "score": d["lexical_score"]
            } for d in bm25_docs[:n_results]]

        # 3. Hybrid RRF Fusion
        return self._fuse_results(vector_docs, bm25_docs, n_results)

    def _results_to_docs(self, results, source="vector"):
        docs = []
        if not results or not results.get('ids'):
            return []
        
        ids = results['ids'][0]
        documents = results['documents'][0]
        metadatas = results['metadatas'][0]
        
        if source == "vector":
            distances = results['distances'][0]
            for i in range(len(ids)):
                # Convert distance to similarity score (0-1)
                # ChromaDB L2 distance: smaller is better.
                # Assuming embeddings are normalized, score = 1 - (dist / 2)
                score = 1.0 - (distances[i] / 2.0)
                docs.append({
                    "id": ids[i],
                    "text": documents[i],
                    "metadata": metadatas[i],
                    "score": max(0.0, min(1.0, score))
                })
        return docs

    def _fuse_results(self, vector_docs, bm25_docs, n_results):
        # Reciprocal Rank Fusion (RRF)
        # score = sum(1 / (k + rank))
        K = 60
        fused_scores = {} # id -> {doc_info, score}
        
        # Rank vector docs
        vector_docs.sort(key=lambda x: x['score'], reverse=True)
        for rank, doc in enumerate(vector_docs):
            doc_id = doc['id']
            if doc_id not in fused_scores:
                fused_scores[doc_id] = {"doc": doc, "score": 0.0}
            fused_scores[doc_id]["score"] += 1.0 / (K + rank + 1)
            
        # Rank BM25 docs
        bm25_docs.sort(key=lambda x: x['lexical_score'], reverse=True)
        for rank, doc in enumerate(bm25_docs):
            doc_id = doc['id']
            if doc_id not in fused_scores:
                fused_scores[doc_id] = {"doc": doc, "score": 0.0}
            fused_scores[doc_id]["score"] += 1.0 / (K + rank + 1)
            
        # Sort by fused score
        final_results = sorted(fused_scores.values(), key=lambda x: x['score'], reverse=True)
        
        # Return top N
        return [item["doc"] for item in final_results[:n_results]]

    def _score_only_results(self, docs, n_results):
        docs.sort(key=lambda x: x.get('score', 0), reverse=True)
        return docs[:n_results]

    def list_all(self, where=None):
        """List all documents in the collection (from vector collection)."""
        return self.vector_collection.get(where=where)

    def cleanup(self, where=None):
        """Delete documents from both collections."""
        try:
            self.vector_collection.delete(where=where)
            self.bm25_collection.delete(where=where)
            return True
        except Exception:
            return False
