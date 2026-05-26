import time
from chromadb.utils import embedding_functions
from backend.logging import log_event, log_llm_call
from backend import config
from backend.rag.token_counter import count_tokens, truncate_text_by_tokens

def _cosine_similarity(v1, v2):
    """Compute cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_a = sum(a * a for a in v1) ** 0.5
    norm_b = sum(b * b for b in v2) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)

class AIEmbeddingFunction(embedding_functions.EmbeddingFunction):
    def __init__(self, model_name=None, default_task="document"):
        log_event("ai_embedding_fn_init", {"model_name": model_name})
        # Model name must be provided - no fallbacks
        if model_name is None:
            raise ValueError("embedding_model must be explicitly provided")
        self.model_name = model_name
        self.default_task = default_task

    async def embed_async(self, input: list, task: str = None, chat_id: str = None) -> list:
        """Asynchronous version of embedding call."""
        return await self._embed_with_task_async(input, task=task or self.default_task, chat_id=chat_id)

    def __call__(self, input):
        # Standard fallback for ChromaDB internal loops
        return self._embed_with_task(input, task=self.default_task)

    def _embed_with_task(self, input: list, task: str = None) -> list:
        """Synchronous wrapper for embedding. 
        Uses a thread-based bridge to avoid 'RuntimeError: This event loop is already running'.
        """
        import asyncio
        import threading

        try:
            loop = asyncio.get_event_loop()
            if not loop.is_running():
                return loop.run_until_complete(self._embed_with_task_async(input, task))
        except RuntimeError:
            pass

        # If we are here, a loop is running or get_event_loop failed.
        # We use a separate thread to run the async logic to avoid loop conflicts.
        results = []
        exception = None

        def _run():
            nonlocal results, exception
            try:
                results = asyncio.run(self._embed_with_task_async(input, task))
            except Exception as e:
                exception = e

        thread = threading.Thread(target=_run)
        thread.start()
        thread.join()

        if exception:
            raise exception
        return results

    async def _embed_with_task_async(self, input: list, task: str = None, chat_id: str = None) -> list:
        """Embed text with task-specific formatting (Asynchronous)."""

        # Ensure input is a list of strings
        if isinstance(input, str):
            input = [input]

        # Determine token limit based on task type
        if task == "query":
            max_tokens = config.EMBEDDING_MAX_TOKENS_RESEARCH
        else:
            max_tokens = config.EMBEDDING_MAX_TOKENS_PREFERENCES

        # Process input
        processed_input = []
        for item in input:
            if item and len(item.strip()) > 0:
                token_count = count_tokens(item)
                if token_count > max_tokens:
                    processed_input.append(truncate_text_by_tokens(item, max_tokens))
                else:
                    processed_input.append(item)
            else:
                processed_input.append(item)

        # Format input for embeddinggemma-300m
        formatted_input = []
        for item in processed_input:
            if task == "query":
                formatted_input.append(f"task: search result | query: {item}")
            else:
                formatted_input.append(f"title: none | text: {item}")

        from backend.inference import InferenceEngine
        engine = InferenceEngine()
        
        batch_size = config.EMBEDDING_BATCH_SIZE
        all_embeddings = []

        for i in range(0, len(formatted_input), batch_size):
            batch = formatted_input[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(formatted_input) + batch_size - 1) // batch_size

            log_event("rag_embedding_batch_start", {
                "batch": batch_num,
                "total_batches": total_batches,
                "items": len(batch),
                "model": self.model_name
            })

            try:
                start_time = time.time()
                # Use the ASYNC method of InferenceEngine
                batch_embeddings = await engine.embed(
                    input=batch,
                    model=self.model_name,
                    chat_id=chat_id
                )
                
                all_embeddings.extend(batch_embeddings)
                
            except Exception as e:
                log_event("rag_embedding_exception", {
                    "model": self.model_name,
                    "error": str(e),
                    "batch": batch_num,
                    "chat_id": chat_id
                })
                raise e

        return all_embeddings
