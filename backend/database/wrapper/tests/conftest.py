"""
conftest.py for backend/database/wrapper/tests/

backend.config validates EMBEDDING_URL at *module import time*, which happens
during pytest's collection phase — before any conftest hook or fixture can fire.
This means the variable MUST be present in the shell environment before pytest
starts, not set inside a hook.

Run tests with:
    EMBEDDING_URL=http://localhost:11434 venv/bin/python -m pytest backend/database/wrapper/tests/ -v

The value is a dummy — these tests use isolated temp DBs and never reach
any inference or embedding endpoint.
"""
# No environment setup needed for inference URLs as they are decoupled.
