import unittest
from unittest.mock import patch
import sys
import os
import importlib

# Add inference_proxy to python path for testing
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

class TestConfig(unittest.TestCase):
    def test_default_values(self):
        # Import config inside the test to verify the defaults
        import config
        importlib.reload(config)
        self.assertEqual(config.TIMEOUT_LLM_STREAM_READ, 1800.0)
        self.assertEqual(config.TIMEOUT_LLM_ASYNC, 120.0)
        self.assertEqual(config.TIMEOUT_EMBEDDING, 1800.0)
        self.assertEqual(config.LLM_RETRY_DELAY, 0.5)

    @patch.dict(os.environ, {
        "TIMEOUT_LLM_STREAM_READ": "500.0",
        "TIMEOUT_LLM_ASYNC": "300.0",
        "TIMEOUT_EMBEDDING": "900.0",
        "LLM_RETRY_DELAY": "1.5"
    })
    def test_env_override(self):
        import config
        importlib.reload(config)
        self.assertEqual(config.TIMEOUT_LLM_STREAM_READ, 500.0)
        self.assertEqual(config.TIMEOUT_LLM_ASYNC, 300.0)
        self.assertEqual(config.TIMEOUT_EMBEDDING, 900.0)
        self.assertEqual(config.LLM_RETRY_DELAY, 1.5)

if __name__ == "__main__":
    unittest.main()
