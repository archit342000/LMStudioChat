import unittest
from unittest.mock import patch, mock_open
import sys
import os

# Add external_proxy to python path for testing
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from loader import (
    load_model_config,
    get_embedding_model,
    get_research_main_model,
    get_general_text_model,
    get_model_metadata,
    validate_model_in_config
)

class TestLoader(unittest.TestCase):

    @patch("loader.load_model_config")
    def test_get_embedding_model(self, mock_load):
        mock_load.return_value = {
            "embedding": "embedding-gemma",
            "research": {"main": "nemotron"},
            "general": {"text": "nemotron"}
        }
        self.assertEqual(get_embedding_model(), "embedding-gemma")
        self.assertEqual(get_research_main_model(), "nemotron")
        self.assertEqual(get_general_text_model(), "nemotron")

    @patch("loader.load_model_config")
    def test_validate_model_in_config(self, mock_load):
        mock_load.return_value = {
            "embedding": "embed-model",
            "research": {"main": "research-main", "vision": "research-vision"},
            "general": {"text": "gen-text", "vision": "gen-vision"}
        }
        self.assertTrue(validate_model_in_config("embed-model"))
        self.assertTrue(validate_model_in_config("research-main"))
        self.assertTrue(validate_model_in_config("gen-text"))
        self.assertFalse(validate_model_in_config("unknown-model"))

    @patch("loader.load_model_config")
    def test_get_model_metadata(self, mock_load):
        mock_load.return_value = {
            "model_metadata": {
                "Google/Gemma4-26B-A4B-it": {
                    "context_window": 150000,
                    "tokenizer": "google/gemma-4-26B-A4B-it"
                }
            }
        }
        # Exact match
        meta = get_model_metadata("Google/Gemma4-26B-A4B-it")
        self.assertEqual(meta["context_window"], 150000)

        # HF Label mapping lookup
        meta_hf = get_model_metadata("google/gemma-4-26B-A4B-it")
        self.assertEqual(meta_hf["context_window"], 150000)

        # Unknown model raises ValueError
        with self.assertRaises(ValueError):
            get_model_metadata("unknown-model")

if __name__ == "__main__":
    unittest.main()
