import pytest
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import patch


class MockServerState:
    chat_responses = []
    embeddings_responses = []

    @classmethod
    def reset(cls):
        cls.chat_responses = []
        cls.embeddings_responses = []


class MockLlamaCppHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # Suppress logging

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        payload = json.loads(body.decode("utf-8"))

        if self.path == "/v1/chat/completions":
            if MockServerState.chat_responses:
                resp = MockServerState.chat_responses.pop(0)
                if callable(resp):
                    resp = resp(payload)

                if isinstance(resp, list):
                    # SSE stream response
                    self.send_response(200)
                    self.send_header("Content-Type", "text/event-stream")
                    self.end_headers()
                    for chunk in resp:
                        self.wfile.write(
                            f"data: {json.dumps(chunk)}\n\n".encode("utf-8")
                        )
                    self.wfile.write(b"data: [DONE]\n\n")
                    return
                elif isinstance(resp, dict):
                    # Blocking response
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(resp).encode("utf-8"))
                    return

            # Default fallback responses
            if payload.get("stream"):
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.end_headers()
                chunks = [
                    {"choices": [{"delta": {"content": "Hello World"}}]},
                    {"timings": {"prompt_n": 5}},
                ]
                for chunk in chunks:
                    self.wfile.write(
                        f"data: {json.dumps(chunk)}\n\n".encode("utf-8")
                    )
                self.wfile.write(b"data: [DONE]\n\n")
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                resp = {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "Hello World",
                            }
                        }
                    ],
                    "timings": {"prompt_n": 5},
                }
                self.wfile.write(json.dumps(resp).encode("utf-8"))

        elif self.path == "/v1/embeddings":
            if MockServerState.embeddings_responses:
                resp = MockServerState.embeddings_responses.pop(0)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(resp).encode("utf-8"))
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            inputs = payload.get("input", [])
            if isinstance(inputs, str):
                inputs = [inputs]
            data = [{"embedding": [0.1, 0.2, 0.3]} for _ in inputs]
            resp = {"data": data}
            self.wfile.write(json.dumps(resp).encode("utf-8"))

        else:
            self.send_response(404)
            self.end_headers()


@pytest.fixture(scope="session", autouse=True)
def mock_server():
    server = HTTPServer(("127.0.0.1", 0), MockLlamaCppHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}"

    # Patch global config URLs
    with patch("backend.config.AI_URL", url), patch(
        "backend.config.EMBEDDING_URL", url
    ):
        yield url

    server.shutdown()
    server.server_close()
    thread.join()


@pytest.fixture(autouse=True)
def clean_mock_state():
    MockServerState.reset()
    yield
