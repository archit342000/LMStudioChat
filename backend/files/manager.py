"""
File Management Module

Handles file uploads, content extraction, and file-specific RAG operations
for the My-AI application. Supports PDF, DOCX, TXT, images, and audio/video files.
"""
import os
import uuid
import base64
import mimetypes
import time
import logging
import threading
from typing import Dict, Optional, Tuple, List, Any
from dataclasses import dataclass
from backend import config
from backend.config import (
    DATA_DIR,
    FILE_UPLOAD_MAX_SIZE,
    FILE_STORAGE_PATH,
    PDF_EXTRACTOR_ENABLED,
    PDF_OCR_ENABLED,
    PDF_OCR_LANGUAGES,
    PDF_EXTRACTION_MIN_CONTENT,
    FILE_RAG_ENABLED,
    CHROMA_PATH,
    EMBEDDING_API_KEY,
    EMBEDDING_URL
)
from backend.models import get_embedding_model
from backend.database import db
from backend.rag import FileRAG
from backend.rag import RAGProvider
from backend.rag import RAGManager
from .pdf_extractor import PDFExtractor
from backend.logging import log_event

logger = logging.getLogger(__name__)

# Supported file types with their MIME types
SUPPORTED_MIME_TYPES = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/markdown': '.md',
    'application/json': '.json',
    'application/javascript': '.js',
    'text/x-python': '.py',
    'text/html': '.html',
    'text/css': '.css',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
}

# Extension to MIME type mapping
EXTENSION_MIME_MAP = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
}


@dataclass
class FileMetadata:
    """Metadata for a stored file."""
    file_id: str
    chat_id: str
    original_filename: str
    stored_filename: str
    mime_type: str
    file_size: int
    content_text: Optional[str] = None
    created_at: float = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()


class FileManager:
    """Handles file storage, retrieval, and content extraction."""

    def __init__(self, storage_path: str = None, rag_manager: RAGManager = None):
        self.storage_path = storage_path or FILE_STORAGE_PATH
        os.makedirs(self.storage_path, exist_ok=True)

        # RAGManager MUST be provided - no fallback allowed
        if rag_manager is None:
            raise RuntimeError(
                "FileManager requires a RAGManager instance. "
                "Get one via RAGProvider.get_manager() and pass it to FileManager."
            )
        self.rag_manager = rag_manager

        # Initialize FileRAG for chunked file embeddings (uses shared manager)
        self.file_rag = FileRAG(rag_manager=self.rag_manager) if FILE_RAG_ENABLED else None

        # Initialize PDF extractor
        self.pdf_extractor = PDFExtractor(ocr_languages=PDF_OCR_LANGUAGES)

    def _generate_file_id(self) -> str:
        """Generate a unique file ID."""
        return f"file_{uuid.uuid4().hex[:16]}"

    def _get_safe_filename(self, filename: str) -> str:
        """Sanitize filename to prevent path traversal."""
        # Get extension
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        # Generate safe name with UUID
        safe_name = f"{uuid.uuid4().hex[:16]}{ext}"
        return safe_name

    def _validate_file_type(self, mime_type: str) -> bool:
        """Check if MIME type is supported."""
        return mime_type in SUPPORTED_MIME_TYPES

    def _get_extension_for_mime(self, mime_type: str) -> str:
        """Get file extension for a MIME type."""
        return SUPPORTED_MIME_TYPES.get(mime_type, '')

    def save_file_metadata(self, file_id: str, chat_id: str, original_filename: str,
                          stored_filename: str, mime_type: str, file_size: int,
                          content_text: str = None) -> FileMetadata:
        """Save file metadata to database."""
        db.save_file(
            file_id=file_id,
            chat_id=chat_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            mime_type=mime_type,
            file_size=file_size,
            content_text=content_text
        )

        return FileMetadata(
            file_id=file_id,
            chat_id=chat_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            mime_type=mime_type,
            file_size=file_size,
            content_text=content_text
        )

    @staticmethod
    def is_readable_text(file_path: str, sample_size: int = 1024) -> bool:
        """
        Heuristically determine if a file is readable text by checking for null bytes
        and attempting to decode a sample of the file.
        """
        try:
            with open(file_path, 'rb') as f:
                chunk = f.read(sample_size)
            if b'\x00' in chunk:
                return False
            # If it's empty, it's technically valid text
            if not chunk:
                return True
            try:
                chunk.decode('utf-8')
                return True
            except UnicodeDecodeError:
                # If UTF-8 fails, check if it's mostly printable ASCII/Latin-1
                try:
                    chunk.decode('latin-1')
                    # Could still be binary masquerading as latin-1, but lack of null bytes
                    # strongly suggests it's safe to attempt text extraction.
                    return True
                except Exception:
                    return False
        except Exception as e:
            logger.error(f"Error in is_readable_text for {file_path}: {e}")
            return False

    def extract_file_content(self, file_path: str, mime_type: str) -> str:
        """
        Extract text content from a file.

        Args:
            file_path: Path to the file
            mime_type: MIME type of the file

        Returns:
            Extracted text content as a JSON string
        """
        ext = os.path.splitext(file_path)[1].lower()
        raw_content = ""
        
        # Text-based files (including heuristic fallback for generic/unknown types which are now assigned text/plain)
        if mime_type.startswith('text/') or mime_type in ['application/json', 'application/javascript']:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    raw_content = f.read()
            except UnicodeDecodeError:
                # Try with different encoding
                try:
                    with open(file_path, 'r', encoding='latin-1') as f:
                        raw_content = f.read()
                except Exception as e:
                    logger.error(f"Error reading text file: {e}")
                    raw_content = ""

        # PDF files - use pymupdf with OCR fallback
        elif mime_type == 'application/pdf':
            raw_content = self._extract_pdf_content(file_path)

        # DOCX files
        elif mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            raw_content = self._extract_docx_content(file_path)

        # Images - no text extraction, return placeholder
        elif mime_type.startswith('image/'):
            raw_content = f"[Image file: {os.path.basename(file_path)} - for visual analysis, use base64 encoding]"

        # Video files
        elif mime_type.startswith('video/'):
            raw_content = f"[Video file: {os.path.basename(file_path)} - frame extraction required]"

        # Audio files
        elif mime_type.startswith('audio/'):
            raw_content = f"[Audio file: {os.path.basename(file_path)} - transcription required]"

        # Wrap in JSON if not already JSON (e.g. from PDF extractor)
        import json
        try:
            parsed = json.loads(raw_content)
            if isinstance(parsed, dict) and "format" in parsed:
                return raw_content
        except Exception:
            pass
            
        return json.dumps({
            "format": "text",
            "text": raw_content
        })

    def _extract_pdf_content(self, file_path: str) -> str:
        """Extract text from PDF using pymupdf with OCR fallback."""
        if not PDF_EXTRACTOR_ENABLED:
            return "[PDF content - extraction disabled]"

        text, strategy = self.pdf_extractor.extract(file_path)

        if text and len(text.strip()) >= PDF_EXTRACTION_MIN_CONTENT:
            return text

        # Extraction failed - return appropriate message
        logger.warning(f"PDF text extraction failed for {file_path} (strategy: {strategy})")
        return f"[PDF content - text extraction failed. Strategy used: {strategy}]"

    def _extract_docx_content(self, file_path: str) -> str:
        """Extract text from DOCX using python-docx."""
        try:
            import docx

            doc = docx.Document(file_path)
            text_parts = []

            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_parts.append(paragraph.text)

            return '\n\n'.join(text_parts)

        except ImportError:
            logger.warning("python-docx not installed, install with: pip install python-docx")
            return "[DOCX content - install python-docx for text extraction]"
        except Exception as e:
            logger.error(f"Error extracting DOCX content: {e}")
            return f"[Error extracting DOCX: {str(e)}]"

    def encode_file_for_vision(self, file_path: str) -> Tuple[str, str]:
        """
        Encode a file as base64 for multi-modal vision analysis.

        Args:
            file_path: Path to the file

        Returns:
            Tuple of (base64_string, mime_type)
        """
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = 'application/octet-stream'

        try:
            with open(file_path, 'rb') as f:
                encoded = base64.b64encode(f.read()).decode('utf-8')
            return encoded, mime_type
        except Exception as e:
            logger.error(f"Error encoding file for vision: {e}")
            return "", mime_type

    def upload_file(self, file_path: str, chat_id: str, original_filename: str) -> Optional[FileMetadata]:
        """
        Upload and process a file.

        Args:
            file_path: Path to the file to upload
            chat_id: Chat session ID
            original_filename: Original filename

        Returns:
            FileMetadata if successful, status updated in DB
        """
        try:
            logger.info(f"[UPLOAD_START] file_path={file_path}, chat_id={chat_id}, original_filename={original_filename}")

            # Validate file exists
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return None

            # Get file info
            file_size = os.path.getsize(file_path)

            # Check size limit
            if file_size > FILE_UPLOAD_MAX_SIZE:
                logger.error(f"File too large: {file_size} > {FILE_UPLOAD_MAX_SIZE}")
                return None

            # Determine MIME type
            mime_type, _ = mimetypes.guess_type(original_filename)

            # Handle unknown/unrecognized MIME types (None or octet-stream)
            if not mime_type or mime_type == 'application/octet-stream':
                # Try to determine from extension
                ext = os.path.splitext(original_filename)[1].lower()
                from backend.file_types import EXHAUSTIVE_TEXT_EXTENSIONS
                mime_type = EXHAUSTIVE_TEXT_EXTENSIONS.get(ext, None)

            # Fallback: check PDF header
            if not mime_type or mime_type == 'application/octet-stream':
                try:
                    with open(file_path, 'rb') as f:
                        header = f.read(8)
                        if header.startswith(b'%PDF-'):
                            mime_type = 'application/pdf'
                except Exception:
                    pass

            # Final heuristic fallback
            if not mime_type or mime_type == 'application/octet-stream':
                if self.is_readable_text(file_path):
                    mime_type = 'text/plain'

            # Final validation
            if mime_type not in config.FILE_UPLOAD_ALLOWED_TYPES:
                logger.error(f"Unsupported file type: {mime_type}")
                return None

            # Generate safe filename
            safe_filename = self._get_safe_filename(original_filename)
            stored_path = os.path.join(self.storage_path, safe_filename)

            # Copy file to storage
            import shutil
            shutil.copy2(file_path, stored_path)

            # Generate file ID
            file_id = self._generate_file_id()

            # Extract content for RAG
            content_text = self.extract_file_content(stored_path, mime_type)

            # Save metadata to DB
            metadata = self.save_file_metadata(
                file_id=file_id,
                chat_id=chat_id,
                original_filename=original_filename,
                stored_filename=safe_filename,
                mime_type=mime_type,
                file_size=file_size,
                content_text=content_text
            )

            # Store in FileRAG for chunked embeddings
            is_media = mime_type.startswith(('image/', 'video/', 'audio/')) if mime_type else False
            if self.file_rag and not is_media and content_text and len(content_text.strip()) > 50:
                try:
                    # In sync upload, we still run this synchronously to ensure immediate availability
                    import asyncio
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            # This shouldn't happen in sync upload_file, but just in case
                            pass
                        else:
                            loop.run_until_complete(self.file_rag.store_file(file_id, chat_id, content_text, original_filename))
                    except RuntimeError:
                        asyncio.run(self.file_rag.store_file(file_id, chat_id, content_text, original_filename))
                except Exception as e:
                    logger.warning(f"Failed to add file to FileRAG: {e}")

            logger.info(f"[UPLOAD_SUCCESS] file_id={file_id}")

            return metadata

        except Exception as e:
            logger.error(f"[UPLOAD_ERROR] Error uploading file: {e}")
            import traceback
            logger.error(f"[UPLOAD_ERROR] Traceback: {traceback.format_exc()}")
            return None

    async def upload_file_async(self, file_path: str, chat_id: str, original_filename: str) -> Optional[FileMetadata]:
        """
        Upload a file. For the current chat, processing is synchronous for immediate
        availability. For other chats (background), processing is async.

        Args:
            file_path: Path to the file to upload
            chat_id: Chat session ID
            original_filename: Original filename

        Returns:
            FileMetadata if successful, None otherwise
        """
        # Initialize content_text to prevent UnboundLocalError
        content_text = ""
        
        try:
            logger.info(f"[UPLOAD_ASYNC_START] file_path={file_path}, chat_id={chat_id}, original_filename={original_filename}")

            # Validate file exists
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return None

            # Get file info
            file_size = os.path.getsize(file_path)
            logger.debug(f"[UPLOAD_ASYNC] File size: {file_size} bytes")

            # Check size limit
            if file_size > FILE_UPLOAD_MAX_SIZE:
                logger.error(f"File too large: {file_size} > {FILE_UPLOAD_MAX_SIZE}")
                return None

            # Determine MIME type
            mime_type, _ = mimetypes.guess_type(original_filename)
            logger.debug(f"[UPLOAD_ASYNC] MIME type (guessed from original_filename): {mime_type}")

            ext = os.path.splitext(original_filename)[1].lower()
            from backend.file_types import EXHAUSTIVE_TEXT_EXTENSIONS
            
            # Normalize using exhaustive map to avoid mimetypes platform inconsistencies
            expected_mime = EXHAUSTIVE_TEXT_EXTENSIONS.get(ext)
            if expected_mime:
                mime_type = expected_mime
                logger.debug(f"[UPLOAD_ASYNC] MIME type (normalized from exhaustive extension): {mime_type}")

            # Fallback: check PDF header
            if not mime_type or mime_type == 'application/octet-stream':
                try:
                    with open(file_path, 'rb') as f:
                        header = f.read(8)
                        if header.startswith(b'%PDF-'):
                            mime_type = 'application/pdf'
                except Exception:
                    pass

            # Final heuristic fallback
            if not mime_type or mime_type == 'application/octet-stream':
                if self.is_readable_text(file_path):
                    mime_type = 'text/plain'
                    logger.debug("[UPLOAD_ASYNC] MIME type assigned via heuristic: text/plain")

            # Final validation
            if mime_type not in config.FILE_UPLOAD_ALLOWED_TYPES:
                logger.error(f"Unsupported file type: {mime_type}")
                return None

            # Generate safe filename
            safe_filename = self._get_safe_filename(original_filename)
            stored_path = os.path.join(self.storage_path, safe_filename)

            # Copy file to storage
            import shutil
            shutil.copy2(file_path, stored_path)

            # Generate file ID
            file_id = self._generate_file_id()

            # Save file metadata to database
            self.save_file_metadata(file_id, chat_id, original_filename, safe_filename, mime_type, file_size)

            # Extract content and store in FileRAG (synchronous for current chat)
            try:
                logger.info(f"[UPLOAD_ASYNC] Extracting content from {stored_path}")
                log_event("file_processing_start", {"file_id": file_id, "chat_id": chat_id})
                content_text = self.extract_file_content(stored_path, mime_type)
                logger.info(f"[UPLOAD_ASYNC] Content extracted: {len(content_text) if content_text else 0} chars")

                # Update file content in database
                self.update_file_content(file_id, content_text)

                # Store in FileRAG (synchronous - for current chat immediate availability)
                is_media = mime_type.startswith(('image/', 'video/', 'audio/')) if mime_type else False
                if self.file_rag and not is_media and content_text and len(content_text.strip()) > 50:
                    logger.info(f"[UPLOAD_ASYNC] Storing in FileRAG")
                    stored_ids = await self.file_rag.store_file(file_id, chat_id, content_text, original_filename)
                    if not stored_ids:
                        raise RuntimeError(f"FileRAG storage returned no IDs for file {file_id}")
                    logger.info(f"[UPLOAD_ASYNC] Successfully stored {len(stored_ids)} chunks in FileRAG")
                else:
                    logger.info(f"[UPLOAD_ASYNC] Skipping FileRAG storage - content too short or RAG disabled")

                # Update status to completed ONLY on success
                self.update_file_processing_status(file_id, 'completed')
                log_event("file_processing_complete", {"file_id": file_id, "chat_id": chat_id})
                logger.info(f"[UPLOAD_ASYNC] Completed processing for {file_id}")

            except Exception as e:
                logger.error(f"[UPLOAD_ASYNC_PROCESS_ERROR] Error processing {file_id}: {e}", exc_info=True)
                try:
                    self.update_file_processing_status(file_id, 'failed')
                except:
                    pass
                # Propagate the exception upward so the router/client knows it failed
                raise

            # Return metadata (after processing for current chat)
            metadata = FileMetadata(
                file_id=file_id,
                chat_id=chat_id,
                original_filename=original_filename,
                stored_filename=safe_filename,
                mime_type=mime_type,
                file_size=file_size,
                content_text=content_text if content_text else "",
                created_at=time.time()
            )
            logger.info(f"[UPLOAD_ASYNC] Processing complete for {file_id}")

            return metadata

        except Exception as e:
            logger.error(f"[UPLOAD_ASYNC_ERROR] Error uploading file: {e}")
            import traceback
            logger.error(f"[UPLOAD_ASYNC_ERROR] Traceback: {traceback.format_exc()}")
            return None

    async def _process_file_background(self, file_id: str, chat_id: str, stored_path: str, mime_type: str, original_filename: str = None):
        """
        Process file in background - extract content and add to RAG.
        Updates processing_status in database when complete.
        This is used for background processing of files (e.g., historical files,
        or when upload_file_async is called for non-current chats).
        """
        try:
            logger.info(f"[BG_PROCESS] Starting background processing for {file_id}")

            # Check if file is already processed (to prevent double embedding)
            # If the file has content in DB, it was likely already processed
            existing_file = db.get_file(file_id)
            if existing_file and existing_file.get('content_text'):
                logger.info(f"[BG_PROCESS] File {file_id} already has content, skipping FileRAG storage")
                self.update_file_processing_status(file_id, 'completed')
                return

            # Update status to processing
            logger.info(f"[BG_PROCESS] About to set status to 'processing'")
            self.update_file_processing_status(file_id, 'processing')
            logger.info(f"[BG_PROCESS] Status set to 'processing'")

            # Extract content
            logger.info(f"[BG_PROCESS] About to extract content from {stored_path}")
            content_text = self.extract_file_content(stored_path, mime_type)
            logger.info(f"[BG_PROCESS] Content extracted: {len(content_text) if content_text else 0} chars")

            # Update metadata with content
            logger.info(f"[BG_PROCESS] About to update file content")
            self.update_file_content(file_id, content_text)
            logger.info(f"[BG_PROCESS] File content updated")

            # Store in FileRAG
            is_media = mime_type.startswith(('image/', 'video/', 'audio/')) if mime_type else False
            if self.file_rag and not is_media and content_text and len(content_text.strip()) > 50:
                try:
                    logger.info(f"[BG_PROCESS] About to store in FileRAG")
                    await self.file_rag.store_file(file_id, chat_id, content_text, original_filename)
                    logger.info(f"[BG_PROCESS] Added to FileRAG")
                except Exception as e:
                    logger.warning(f"[BG_PROCESS] Failed to add to FileRAG: {e}")
            else:
                logger.info(f"[BG_PROCESS] Skipping FileRAG - file_rag={self.file_rag is not None}, content={len(content_text) if content_text else 0} chars")

            # Update status to complete
            logger.info(f"[BG_PROCESS] About to set status to 'completed'")
            self.update_file_processing_status(file_id, 'completed')
            logger.info(f"[BG_PROCESS] Completed for {file_id}")

        except Exception as e:
            logger.error(f"[BG_PROCESS_ERROR] Error: {e}", exc_info=True)
            # Update status to failed on error
            try:
                self.update_file_processing_status(file_id, 'failed')
            except:
                pass

    def update_file_content(self, file_id: str, content_text: str) -> bool:
        """
        Update file metadata with extracted content.

        Args:
            file_id: File ID
            content_text: Extracted text content

        Returns:
            True if successful, False otherwise
        """
        try:
            db.update_file_content(file_id, content_text)
            logger.info(f"[UPDATE_CONTENT] Updated file {file_id} with content")
            return True
        except Exception as e:
            logger.error(f"[UPDATE_CONTENT_ERROR] Error updating content: {e}")
            return False

    def update_file_processing_status(self, file_id: str, status: str) -> bool:
        """Update file processing status.

        Args:
            file_id: File ID
            status: 'pending', 'processing', 'completed', or 'failed'

        Returns:
            True if successful, False otherwise
        """
        try:
            db.update_file_processing_status(file_id, status)
            logger.info(f"[UPDATE_FILE_STATUS] Updated {file_id} to '{status}'")
            return True
        except Exception as e:
            logger.error(f"[UPDATE_FILE_STATUS_ERROR] Error: {e}")
            return False

    def get_file(self, file_id: str) -> Optional[FileMetadata]:
        """Get file metadata by ID."""
        result = db.get_file(file_id)
        if not result:
            return None

        # Get stored file path
        stored_path = os.path.join(self.storage_path, result['stored_filename'])

        return FileMetadata(
            file_id=result['id'],
            chat_id=result['chat_id'],
            original_filename=result['original_filename'],
            stored_filename=result['stored_filename'],
            mime_type=result['mime_type'],
            file_size=result['file_size'],
            content_text=result.get('content_text'),
            created_at=result.get('created_at', 0)
        )

    def grep_file(self, file_id: str, query: str, is_regex: bool = False, context_chars: int = 300) -> Dict[str, Any]:
        """Search raw extracted content of a file.

        Args:
            file_id:       ID of the file to search.
            query:         Literal string or regex pattern to match.
            is_regex:      If True, treat ``query`` as a regex.
            context_chars: Number of characters to include before and after
                           each matched line.  Character-based context gives
                           predictable token cost regardless of line length
                           (important for PDFs whose "lines" vary enormously).
        """
        import re
        import json
        metadata = self.get_file(file_id)
        if not metadata:
            return {"success": False, "error": "File not found"}

        content = metadata.content_text or ""
        
        try:
            content_data = json.loads(content)
            if not isinstance(content_data, dict) or "format" not in content_data:
                content_data = {"format": "text", "text": content}
        except Exception:
            content_data = {"format": "text", "text": content}

        matches = []
        max_matches = 50

        if content_data.get("format") == "pages":
            pages = content_data.get("pages", [])
            
            # Smart flexible whitespace matching if literal search
            if not is_regex:
                # Escape query but replace whitespace with \s+
                parts = query.split()
                escaped_parts = [re.escape(p) for p in parts]
                pattern_str = r'\s+'.join(escaped_parts)
                try:
                    pattern = re.compile(pattern_str)
                except re.error as e:
                    return {"success": False, "error": f"Regex generation failed: {e}"}
            else:
                try:
                    pattern = re.compile(query)
                except re.error as e:
                    return {"success": False, "error": f"Invalid regex pattern: {e}"}
                    
            for i, page_text in enumerate(pages):
                for match in pattern.finditer(page_text):
                    start_idx = match.start()
                    end_idx = match.end()
                    
                    ctx_before_raw = page_text[max(0, start_idx - context_chars):start_idx]
                    ctx_after_raw = page_text[end_idx:min(len(page_text), end_idx + context_chars)]
                    
                    matches.append({
                        "page_number": i + 1,
                        "text": match.group(0),
                        "context_before": ctx_before_raw,
                        "context_after": ctx_after_raw,
                    })
                    
                    if len(matches) >= max_matches:
                        break
                if len(matches) >= max_matches:
                    break

        else:
            text_content = content_data.get("text", "")
            lines = text_content.split('\n')
            
            try:
                pattern = re.compile(query) if is_regex else None
            except re.error as e:
                return {"success": False, "error": f"Invalid regex pattern: {e}"}

            # Pre-compute the character offset at which each line starts so we can
            # do fast substring slicing for context extraction.
            line_offsets = []
            offset = 0
            for line in lines:
                line_offsets.append(offset)
                offset += len(line) + 1  # +1 for the '\n'

            for i, line in enumerate(lines):
                match_found = pattern.search(line) if is_regex else (query in line)

                if match_found:
                    line_start_offset = line_offsets[i]
                    line_end_offset = line_start_offset + len(line)

                    # Grab up to context_chars on each side, then find clean boundaries
                    ctx_before_raw = text_content[max(0, line_start_offset - context_chars):line_start_offset]
                    ctx_after_raw = text_content[line_end_offset + 1:min(len(text_content), line_end_offset + 1 + context_chars)]

                    matches.append({
                        "line_number": i + 1,
                        "text": line,
                        "context_before": ctx_before_raw,
                        "context_after": ctx_after_raw,
                    })

                    if len(matches) >= max_matches:
                        break

        return {
            "success": True,
            "file_id": file_id,
            "filename": metadata.original_filename,
            "total_matches_found": len(matches),
            "truncated": len(matches) >= max_matches,
            "matches": matches,
        }


    def read_file_range(self, file_id: str, start_line: int = None, end_line: int = None, page: int = None) -> Dict[str, Any]:
        """Read specific lines or a specific page from the raw extracted file content."""
        import json
        from backend.config import DOCUMENT_AGENT_MAX_LINES_PER_REQUEST, DOCUMENT_AGENT_MAX_CHARS_PER_READ
        metadata = self.get_file(file_id)
        if not metadata:
            return {"success": False, "error": "File not found"}
            
        content = metadata.content_text or ""
        
        try:
            content_data = json.loads(content)
            if not isinstance(content_data, dict) or "format" not in content_data:
                content_data = {"format": "text", "text": content}
        except Exception:
            content_data = {"format": "text", "text": content}
        
        if content_data.get("format") == "pages":
            pages = content_data.get("pages", [])
            
            if page is None:
                return {"success": False, "error": "This is a page-based document. Please use the 'page' parameter instead of 'start_line' and 'end_line'."}
 
            if not (1 <= page <= len(pages)):
                return {"success": False, "error": f"Page {page} not found. Document has {len(pages)} pages."}
 
            page_content = pages[page - 1]
            
            # Character-based truncation to prevent context overflow
            truncated = len(page_content) > DOCUMENT_AGENT_MAX_CHARS_PER_READ
            warning_msg = None
            if truncated:
                page_content = page_content[:DOCUMENT_AGENT_MAX_CHARS_PER_READ]
                warning_msg = f"\n\n[WARNING: Content truncated at {DOCUMENT_AGENT_MAX_CHARS_PER_READ} characters to prevent context overflow.]"
                page_content += warning_msg
                
            result = {
                "success": True,
                "file_id": file_id,
                "filename": metadata.original_filename,
                "type": "page",
                "page": page,
                "content": page_content
            }
            if truncated:
                result["truncated"] = True
                result["warning"] = warning_msg
                
            return result
            
        else:
            if page is not None:
                return {"success": False, "error": "This is a line-based document. Please use 'start_line' and 'end_line' instead of 'page'."}
 
            text_content = content_data.get("text", "")
            lines = text_content.split('\n')
            total_lines = len(lines)
            
            # 1-indexed bounds
            start_idx = max(0, start_line - 1) if start_line is not None else 0
            
            if end_line is None:
                end_idx = min(total_lines, start_idx + DOCUMENT_AGENT_MAX_LINES_PER_REQUEST)
            else:
                end_idx = min(total_lines, end_line)
            
            # Rejection limit for lines
            if end_idx - start_idx > DOCUMENT_AGENT_MAX_LINES_PER_REQUEST:
                return {
                    "success": False, 
                    "error": f"Requested too many lines at once ({end_idx - start_idx} lines). Maximum allowed is {DOCUMENT_AGENT_MAX_LINES_PER_REQUEST} lines per read. Please narrow your line range."
                }
            
            formatted_lines = [f"{i+1}: {lines[i]}" for i in range(start_idx, end_idx)]
            final_content = '\n'.join(formatted_lines)
            
            # Character-based truncation to prevent massive context dumps
            truncated = len(final_content) > DOCUMENT_AGENT_MAX_CHARS_PER_READ
            warning_msg = None
            if truncated:
                final_content = final_content[:DOCUMENT_AGENT_MAX_CHARS_PER_READ]
                warning_msg = f"\n\n[WARNING: Content truncated at {DOCUMENT_AGENT_MAX_CHARS_PER_READ} characters to prevent context overflow.]"
                final_content += warning_msg
            
            result = {
                "success": True,
                "file_id": file_id,
                "filename": metadata.original_filename,
                "type": "lines",
                "start_line": start_idx + 1,
                "end_line": end_idx,
                "total_lines": total_lines,
                "content": final_content
            }
            if truncated:
                result["truncated"] = True
                result["warning"] = warning_msg
                
            return result

    def delete_file(self, file_id: str) -> bool:
        """Delete a file and its associated data."""
        try:
            # Get file metadata
            metadata = self.get_file(file_id)
            if not metadata:
                return False

            # Delete from database
            db.delete_file(file_id)

            # Delete from storage
            stored_path = os.path.join(self.storage_path, metadata.stored_filename)
            if os.path.exists(stored_path):
                os.remove(stored_path)

            # Delete from FileRAG (ChromaDB)
            if self.file_rag:
                try:
                    self.file_rag.delete_file(file_id)
                    logger.info(f"File vectors deleted from RAG: {file_id}")
                except Exception as e:
                    logger.warning(f"Failed to delete file vectors from RAG: {e}")

            logger.info(f"File deleted: {file_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return False

    def get_chat_files(self, chat_id: str) -> List[FileMetadata]:
        """Get all files for a chat session."""
        results = db.get_chat_files(chat_id)

        files = []
        for row in results:
            files.append(FileMetadata(
                file_id=row['id'],
                chat_id=row['chat_id'],
                original_filename=row['original_filename'],
                stored_filename=row['stored_filename'],
                mime_type=row['mime_type'],
                file_size=row['file_size'],
                content_text=row.get('content_text'),
                created_at=row.get('created_at', 0)
            ))

        return files
