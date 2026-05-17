import pytest
from unittest.mock import MagicMock, patch, mock_open
import json
from backend.files.pdf_extractor import PDFExtractor

@pytest.fixture
def pdf_extractor():
    return PDFExtractor(ocr_languages=['en'])

def test_pdf_extractor_init(pdf_extractor):
    assert pdf_extractor.ocr_languages == ['en']
    assert pdf_extractor._easyocr_initialized is False
    assert pdf_extractor._ocr_reader is None

def test_initialize_ocr(pdf_extractor):
    with patch('easyocr.Reader') as mock_reader:
        pdf_extractor.initialize_ocr()
        mock_reader.assert_called_once_with(['en'], gpu=False)
        assert pdf_extractor._easyocr_initialized is True
        assert pdf_extractor._ocr_reader is not None

def test_extract_with_pymupdf_success(pdf_extractor):
    mock_doc = MagicMock()
    mock_page1 = MagicMock()
    mock_page1.get_text.return_value = "Page 1 text"
    mock_page2 = MagicMock()
    mock_page2.get_text.return_value = "Page 2 text"
    mock_doc.__iter__.return_value = [mock_page1, mock_page2]
    
    with patch('fitz.open', return_value=mock_doc):
        result = pdf_extractor.extract_with_pymupdf("test.pdf")
        
        assert result is not None
        data = json.loads(result)
        assert data["format"] == "pages"
        assert data["pages"] == ["Page 1 text", "Page 2 text"]
        mock_doc.close.assert_called_once()

def test_extract_with_pymupdf_failure(pdf_extractor):
    with patch('fitz.open', side_effect=Exception("Failed to open")):
        result = pdf_extractor.extract_with_pymupdf("test.pdf")
        assert result is None

def test_extract_with_ocr_success(pdf_extractor):
    mock_doc = MagicMock()
    mock_doc.__len__.return_value = 1
    mock_page = MagicMock()
    mock_doc.__getitem__.return_value = mock_page
    
    mock_pixmap = MagicMock()
    mock_pixmap.tobytes.return_value = b"image data"
    mock_page.get_pixmap.return_value = mock_pixmap
    
    pdf_extractor._easyocr_initialized = True
    pdf_extractor._ocr_reader = MagicMock()
    pdf_extractor._ocr_reader.readtext.return_value = [([], "OCR text", 0.9)]
    
    with patch('fitz.open', return_value=mock_doc), \
         patch('fitz.Matrix', return_value=MagicMock()):
        result = pdf_extractor.extract_with_ocr("test.pdf")
        
        assert result is not None
        data = json.loads(result)
        assert data["format"] == "pages"
        assert data["pages"] == ["OCR text"]
        mock_doc.close.assert_called_once()

def test_extract_with_ocr_failure(pdf_extractor):
    with patch('fitz.open', side_effect=Exception("Failed to open")):
        result = pdf_extractor.extract_with_ocr("test.pdf")
        assert result is None

def test_extract_strategy_pymupdf(pdf_extractor):
    # Mocking extract_with_pymupdf to return text > 50 chars
    long_text = "A" * 60
    with patch.object(pdf_extractor, 'extract_with_pymupdf', return_value=long_text):
        text, strategy = pdf_extractor.extract("test.pdf", use_ocr=True)
        assert text == long_text
        assert strategy == "pymupdf"

def test_extract_strategy_ocr_fallback(pdf_extractor):
    # pymupdf returns short text or None, OCR returns long text
    long_text = "B" * 60
    with patch.object(pdf_extractor, 'extract_with_pymupdf', return_value="short"), \
         patch.object(pdf_extractor, 'extract_with_ocr', return_value=long_text):
        text, strategy = pdf_extractor.extract("test.pdf", use_ocr=True)
        assert text == long_text
        assert strategy == "easyocr"

def test_extract_none_found(pdf_extractor):
    with patch.object(pdf_extractor, 'extract_with_pymupdf', return_value=None), \
         patch.object(pdf_extractor, 'extract_with_ocr', return_value=None):
        text, strategy = pdf_extractor.extract("test.pdf", use_ocr=True)
        assert text is None
        assert strategy == "none"

def test_extract_no_ocr_requested(pdf_extractor):
    with patch.object(pdf_extractor, 'extract_with_pymupdf', return_value=None), \
         patch('backend.files.pdf_extractor.PDF_OCR_ENABLED', False):
        # Even if OCR would work, it shouldn't be called if use_ocr is False
        with patch.object(pdf_extractor, 'extract_with_ocr', return_value="some text") as mock_ocr:
            text, strategy = pdf_extractor.extract("test.pdf", use_ocr=False)
            assert text is None
            assert strategy == "none"
            mock_ocr.assert_not_called()
