from .db_wrapper import DatabaseWrapper, DB_PATH
from .cache_system import cache_system as response_cache
from .init_db import init_db

# Standard singleton instance
db = DatabaseWrapper()

__all__ = ["db", "DatabaseWrapper", "response_cache", "DB_PATH", "init_db"]
