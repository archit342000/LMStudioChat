import os

def get_secret(secret_name, default=None):
    try:
        with open(f"/run/secrets/{secret_name}", "r") as f:
            return f.read().strip()
    except IOError:
        return os.getenv(secret_name, default)

# Server connection configurations
AI_URL = get_secret("AI_URL", "http://localhost:8080").rstrip("/")
AI_API_KEY = get_secret("AI_API_KEY", "")

EMBEDDING_URL = get_secret("EMBEDDING_URL", "http://localhost:8080").rstrip("/")
EMBEDDING_API_KEY = get_secret("EMBEDDING_API_KEY", "")

# Parallelism and Concurrency
INFERENCE_PARALLELISM = int(os.getenv("INFERENCE_PARALLELISM", "1"))

# Timeouts (in seconds)
TIMEOUT_LLM_ASYNC = float(os.getenv("TIMEOUT_LLM_ASYNC", "120.0"))
TIMEOUT_EMBEDDING = float(os.getenv("TIMEOUT_EMBEDDING", "60.0"))
TIMEOUT_LLM_STREAM_READ = float(os.getenv("TIMEOUT_LLM_STREAM_READ", "60.0"))

# Retry Logic
LLM_RETRY_COUNT = int(os.getenv("LLM_RETRY_COUNT", "3"))
LLM_RETRY_DELAY = float(os.getenv("LLM_RETRY_DELAY", "2.0"))
