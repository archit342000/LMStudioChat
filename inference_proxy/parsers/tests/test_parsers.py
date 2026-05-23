import pytest
from parsers.base import StreamInterceptor, BaseParser
from parsers.models import StandardParser, GemmaParser, PassThroughParser
from parsers import get_parser_for_model

def test_standard_parser_clean():
    parser = StandardParser()
    interceptor = StreamInterceptor(parser)
    
    # Send content before thinking
    c, r = interceptor.process_chunk("Hello. ")
    assert c == "Hello. "
    assert r == ""
    
    # Send start tag
    c, r = interceptor.process_chunk("<think>\n")
    assert c == ""
    assert r == ""
    assert interceptor.in_reasoning_block is True
    
    # Send reasoning content
    c, r = interceptor.process_chunk("I am thinking...")
    assert c == ""
    assert r == "I am thinking..."
    
    # Send end tag
    c, r = interceptor.process_chunk("</think>\n")
    assert c == ""
    assert r == ""
    assert interceptor.in_reasoning_block is False
    
    # Send final content
    c, r = interceptor.process_chunk(" Done!")
    assert c == " Done!"
    assert r == ""
    
    # Flush
    c, r = interceptor.flush()
    assert c == ""
    assert r == ""

def test_standard_parser_fragmented_tags():
    parser = StandardParser()
    interceptor = StreamInterceptor(parser)
    
    # Send partial start tag
    c, r = interceptor.process_chunk("Let me think... <th")
    assert c == "Let me think... "
    assert r == ""
    assert interceptor.buffer == "<th"
    assert interceptor.in_reasoning_block is False
    
    # Complete start tag
    c, r = interceptor.process_chunk("ink>\nHere is my ")
    assert c == ""
    assert r == "Here is my "
    assert interceptor.in_reasoning_block is True
    
    # Send partial end tag
    c, r = interceptor.process_chunk("reasoning. </th")
    assert c == ""
    assert r == "reasoning. "
    assert interceptor.buffer == "</th"
    
    # Complete end tag
    c, r = interceptor.process_chunk("ink>\nFinal")
    assert c == "Final"
    assert r == ""
    assert interceptor.in_reasoning_block is False

def test_standard_parser_false_alarms():
    parser = StandardParser()
    interceptor = StreamInterceptor(parser)
    
    # Suffix matches tag prefix, but next chunk breaks it
    c, r = interceptor.process_chunk("I like <th")
    assert c == "I like "
    assert interceptor.buffer == "<th"
    
    c, r = interceptor.process_chunk("is place")
    assert c == "<this place"
    assert r == ""
    assert interceptor.in_reasoning_block is False

def test_gemma_parser():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    c, r = interceptor.process_chunk("<|channel>thought\nThinking...")
    assert c == ""
    assert r == "Thinking..."
    
    c, r = interceptor.process_chunk("Done.<channel|>Answer")
    assert c == "Answer"
    assert r == "Done."
    
    # Test Gemma 4 using normal <think> tags fallback
    interceptor2 = StreamInterceptor(parser)
    c, r = interceptor2.process_chunk("<think>\nThinking standard...")
    assert c == ""
    assert r == "Thinking standard..."
    
    c, r = interceptor2.process_chunk("Done.</think>\nAnswer standard")
    assert c == "Answer standard"
    assert r == "Done."

def test_pass_through_parser():
    parser = PassThroughParser()
    interceptor = StreamInterceptor(parser)
    
    c, r = interceptor.process_chunk("<think>\nThinking</think>\nAnswer")
    assert c == "<think>\nThinking</think>\nAnswer"
    assert r == ""

def test_factory():
    assert isinstance(get_parser_for_model("Google/Gemma4-26B-A4B-it"), GemmaParser)
    assert isinstance(get_parser_for_model("Qwen/Qwen3-Coder-Next-UD-Q4_K_XL"), PassThroughParser)
    assert isinstance(get_parser_for_model("Qwen/Qwen3.6-35B-A3B-UD-Q4_K_XL"), StandardParser)
    assert isinstance(get_parser_for_model("random-model-name"), StandardParser)

def test_flush_handles_trailing_buffer():
    parser = StandardParser()
    interceptor = StreamInterceptor(parser)
    
    interceptor.process_chunk("Hello <thi")
    c, r = interceptor.flush()
    assert c == "<thi"
    assert r == ""
    
    interceptor.process_chunk("<think>\nThinking... </")
    c, r = interceptor.flush()
    assert c == ""
    assert r == "</"
