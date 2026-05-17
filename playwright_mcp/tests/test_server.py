import pytest
import asyncio
import time
import httpx
import json
from unittest.mock import MagicMock, patch, AsyncMock
from playwright_mcp.server import (
    is_safe_web_url, 
    sanitize_output, 
    clean_html_to_markdown,
    _extract_pdf_content,
    _get_session,
    _cleanup_expired_sessions,
    _sessions,
    get_secret,
    check_internet_connectivity,
    visit_page,
    fetch_and_encode_image
)

@pytest.mark.parametrize("url,expected", [
    ("https://www.google.com", True),
    ("http://example.org/path?q=1", True),
    ("ftp://example.com", False),
    ("file:///etc/passwd", False),
    ("http://127.0.0.1", False),
    ("http://169.254.169.254", False),
    ("http://localhost", False),
])
def test_is_safe_web_url(url, expected):
    assert is_safe_web_url(url) == expected

@pytest.mark.parametrize("input_text,expected", [
    ("Hello world", "Hello world"),
    ("<p>Hello</p>", "Hello"),
    ("javascript:alert(1)", "alert(1)"),
    ("data:text/html,<html>", "text/html,"),
    ("eval('evil')", "'evil')"),
    ("window.location = '/'", "location = '/'"),
    ("document.cookie", ""),
])
def test_sanitize_output(input_text, expected):
    assert sanitize_output(input_text) == expected

def test_clean_html_to_markdown():
    html = """
    <html>
        <body>
            <nav>Menu</nav>
            <main>
                <h1>Title</h1>
                <p>Content with <a href="http://link.com">link</a>.</p>
            </main>
            <footer>Footer</footer>
        </body>
    </html>
    """
    md = clean_html_to_markdown(html, "http://example.com", detail_level="standard")
    assert "# Title" in md
    assert "[link](http://link.com)" in md
    assert "Menu" in md
    assert "Footer" in md
    
    md_basic = clean_html_to_markdown(html, "http://example.com", detail_level="basic")
    assert "Menu" not in md_basic
    assert "Footer" not in md_basic
    assert "[link]" not in md_basic

def test_clean_html_base64_stripping():
    html = '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="></p>'
    md = clean_html_to_markdown(html, "http://example.com")
    assert "[Base64 Image Omitted]" in md

@pytest.mark.asyncio
async def test_session_management():
    _sessions.clear()
    with pytest.raises(ValueError, match="Session not found"):
        await _get_session("non-existent")
    
    mock_context = MagicMock()
    _sessions["test-session"] = {
        "context": mock_context,
        "last_used": time.time()
    }
    session = await _get_session("test-session")
    assert session["context"] == mock_context
    
    _sessions["expired"] = {
        "context": MagicMock(),
        "last_used": time.time() - 600
    }
    await _cleanup_expired_sessions()
    assert "expired" not in _sessions
    assert "test-session" in _sessions

@pytest.mark.asyncio
async def test_extract_pdf_content():
    with patch("pypdf.PdfReader") as mock_reader:
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "PDF Content"
        mock_reader.return_value.pages = [mock_page]
        res = await _extract_pdf_content(b"fake pdf")
        assert res == "PDF Content"

def test_get_secret():
    with patch("builtins.open", side_effect=IOError):
        with patch.dict("os.environ", {"TEST_SECRET": "val"}):
            assert get_secret("TEST_SECRET") == "val"

@pytest.mark.asyncio
async def test_check_internet_connectivity():
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock()
        assert await check_internet_connectivity() is True
        mock_get.side_effect = Exception("offline")
        assert await check_internet_connectivity() is False

@pytest.mark.asyncio
async def test_visit_page_orchestration():
    # We need to be careful with global state/mocks.
    # We mock fetch_with_playwright to avoid launching a browser.
    with patch("playwright_mcp.server.check_internet_connectivity", return_value=True):
        with patch("playwright_mcp.server.fetch_with_playwright", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = "Extracted Text"
            
            # Case 1: Valid external URL
            res = await visit_page("https://google.com")
            assert res == "Extracted Text"
            
            # Case 2: Forbidden URL (localhost)
            # is_safe_web_url should catch this.
            res = await visit_page("http://127.0.0.1")
            assert "forbidden" in res.lower()
            
            # Case 3: Internet Connectivity failure
            with patch("playwright_mcp.server.check_internet_connectivity", return_value=False):
                res = await visit_page("https://google.com")
                assert "connectivity failure" in res.lower()

@pytest.mark.asyncio
async def test_fetch_and_encode_image():
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"fake image"
        mock_response.headers = {"content-type": "image/png"}
        mock_get.return_value = mock_response
        
        res_json = await fetch_and_encode_image("https://example.com/img.png")
        res = json.loads(res_json)
        assert "image" in res
        assert "data:image/png;base64," in res["image"]
        
        mock_get.side_effect = Exception("Fetch failed")
        res_json = await fetch_and_encode_image("https://example.com/img.png")
        res = json.loads(res_json)
        assert "error" in res
