import pytest
import json
from parsers.base import StreamInterceptor, BaseParser
from parsers.models import StandardParser, GemmaParser, PassThroughParser
from parsers import get_parser_for_model

def test_standard_parser_clean():
    parser = StandardParser()
    interceptor = StreamInterceptor(parser)
    
    # Send content before thinking
    c, r, tc = interceptor.process_chunk("Hello. ")
    assert c == "Hello. "
    assert r == ""
    assert tc == []
    
    # Send start tag
    c, r, tc = interceptor.process_chunk("<think>\n")
    assert c == ""
    assert r == ""
    assert tc == []
    assert interceptor.in_reasoning_block is True
    
    # Send reasoning content
    c, r, tc = interceptor.process_chunk("I am thinking...")
    assert c == ""
    assert r == "I am thinking..."
    assert tc == []
    
    # Send end tag
    c, r, tc = interceptor.process_chunk("</think>\n")
    assert c == ""
    assert r == ""
    assert tc == []
    assert interceptor.in_reasoning_block is False
    
    # Send final content
    c, r, tc = interceptor.process_chunk(" Done!")
    assert c == " Done!"
    assert r == ""
    assert tc == []
    
    # Flush
    c, r, tc = interceptor.flush()
    assert c == ""
    assert r == ""
    assert tc == []

def test_standard_parser_fragmented_tags():
    parser = StandardParser()
    interceptor = StreamInterceptor(parser)
    
    # Send partial start tag
    c, r, tc = interceptor.process_chunk("Let me think... <th")
    assert c == "Let me think... "
    assert r == ""
    assert tc == []
    assert interceptor.buffer == "<th"
    assert interceptor.in_reasoning_block is False
    
    # Complete start tag
    c, r, tc = interceptor.process_chunk("ink>\nHere is my ")
    assert c == ""
    assert r == "Here is my "
    assert tc == []
    assert interceptor.in_reasoning_block is True
    
    # Send partial end tag
    c, r, tc = interceptor.process_chunk("reasoning. </th")
    assert c == ""
    assert r == "reasoning. "
    assert tc == []
    assert interceptor.buffer == "</th"
    
    # Complete end tag
    c, r, tc = interceptor.process_chunk("ink>\nFinal")
    assert c == "Final"
    assert r == ""
    assert tc == []
    assert interceptor.in_reasoning_block is False

def test_standard_parser_false_alarms():
    parser = StandardParser()
    interceptor = StreamInterceptor(parser)
    
    # Suffix matches tag prefix, but next chunk breaks it
    c, r, tc = interceptor.process_chunk("I like <th")
    assert c == "I like "
    assert tc == []
    assert interceptor.buffer == "<th"
    
    c, r, tc = interceptor.process_chunk("is place")
    assert c == "<this place"
    assert r == ""
    assert tc == []
    assert interceptor.in_reasoning_block is False

def test_gemma_parser():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    c, r, tc = interceptor.process_chunk("<|channel>thought\nThinking...")
    assert c == ""
    assert r == "Thinking..."
    assert tc == []
    
    c, r, tc = interceptor.process_chunk("Done.<channel|>Answer")
    assert c == "Answer"
    assert r == "Done."
    assert tc == []
    
    # Test Gemma 4 using normal <think> tags fallback
    interceptor2 = StreamInterceptor(parser)
    c, r, tc = interceptor2.process_chunk("<think>\nThinking standard...")
    assert c == ""
    assert r == "Thinking standard..."
    assert tc == []
    
    c, r, tc = interceptor2.process_chunk("Done.</think>\nAnswer standard")
    assert c == "Answer standard"
    assert r == "Done."
    assert tc == []

def test_pass_through_parser():
    parser = PassThroughParser()
    interceptor = StreamInterceptor(parser)
    
    c, r, tc = interceptor.process_chunk("<think>\nThinking</think>\nAnswer")
    assert c == "<think>\nThinking</think>\nAnswer"
    assert r == ""
    assert tc == []

def test_factory():
    assert isinstance(get_parser_for_model("Google/Gemma4-26B-A4B-it"), GemmaParser)
    assert isinstance(get_parser_for_model("Qwen/Qwen3-Coder-Next-UD-Q4_K_XL"), PassThroughParser)
    assert isinstance(get_parser_for_model("Qwen/Qwen3.6-35B-A3B-UD-Q4_K_XL"), StandardParser)
    assert isinstance(get_parser_for_model("random-model-name"), StandardParser)

def test_flush_handles_trailing_buffer():
    parser = StandardParser()
    interceptor = StreamInterceptor(parser)
    
    interceptor.process_chunk("Hello <thi")
    c, r, tc = interceptor.flush()
    assert c == "<thi"
    assert r == ""
    assert tc == []
    
    interceptor.process_chunk("<think>\nThinking... </")
    c, r, tc = interceptor.flush()
    assert c == ""
    assert r == "</"
    assert tc == []

def test_gemma4_tool_call_parsing():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    # Stream content before tool call
    c, r, tc = interceptor.process_chunk("Let's call the agent. ")
    assert c == "Let's call the agent. "
    assert r == ""
    assert tc == []
    
    # Stream tool call start tag
    c, r, tc = interceptor.process_chunk("<|tool_call>")
    assert c == ""
    assert r == ""
    assert tc == []
    assert interceptor.in_tool_call_block is True
    
    # Stream call body with backslashes and braces in string literal
    c, r, tc = interceptor.process_chunk("call:file_system_agent{instruction:<|\\\"|>Write equation \\\\beta = \\\\mathcal{D}_{DPO} to lectures/08.md<|\\\"|>}")
    assert c == ""
    assert r == ""
    assert tc == []
    
    # Stream end tag
    c, r, tc = interceptor.process_chunk("<tool_call|>")
    assert c == ""
    assert r == ""
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "file_system_agent"
    assert "call_" in tc[0]["id"]
    assert "index" in tc[0]
    
    # Verify escaped backslashes inside argument JSON
    import json
    args = json.loads(tc[0]["function"]["arguments"])
    assert "Write equation \\\\beta = \\\\mathcal{D}_{DPO}" in args["instruction"]

def test_gemma4_tool_call_nested_quotes():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    # Tool call containing double quotes inside the string literal arguments
    raw_call = '<|tool_call>call:file_system_agent{instruction:<|\\\"|>print("hello world")<|\\\"|>}<tool_call|>'
    c, r, tc = interceptor.process_chunk(raw_call)
    
    assert c == ""
    assert r == ""
    assert len(tc) == 1
    
    import json
    args = json.loads(tc[0]["function"]["arguments"])
    assert args["instruction"] == 'print("hello world")'

def test_gemma4_tool_call_malformed():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    # Malformed JSON in tool call arguments should raise ValueError
    raw_call = "<|tool_call>call:test_tool{invalid_json_format}<tool_call|>"
    with pytest.raises(ValueError, match="Malformed tool call"):
        interceptor.process_chunk(raw_call)

def test_gemma4_tool_call_truncation():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    interceptor.process_chunk("<|tool_call>call:test_tool{")
    with pytest.raises(ValueError, match="Stream truncated inside tool call buffer"):
        interceptor.flush()

def test_gemma4_tool_call_parallel():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    # Parallel tool calls in a single chunk
    raw_calls = (
        "<|tool_call>call:toolA{val:<|\\\"|>first<|\\\"|>}<tool_call|>"
        "<|tool_call>call:toolB{val:<|\\\"|>second<|\\\"|>}<tool_call|>"
    )
    c, r, tc = interceptor.process_chunk(raw_calls)
    
    assert len(tc) == 2
    assert tc[0]["function"]["name"] == "toolA"
    assert tc[0]["index"] == 0
    assert tc[1]["function"]["name"] == "toolB"
    assert tc[1]["index"] == 1

def test_gemma4_reasoning_ignores_tool_calls():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    # Tool call tag inside reasoning block should be ignored and streamed as reasoning
    c, r, tc = interceptor.process_chunk("<|channel>thought\nI planning to invoke <|tool_call>call:toolA{}<tool_call|> next.<channel|>")
    assert c == ""
    assert "call:toolA" in r
    assert tc == []
    assert interceptor.in_tool_call_block is False

def test_gemma4_tool_call_lenient():
    parser = GemmaParser()
    interceptor = StreamInterceptor(parser)
    
    # 1. Missing call: prefix
    c, r, tc = interceptor.process_chunk("<|tool_call>toolA{key:<|\\\"|>val<|\\\"|>}<tool_call|>")
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "toolA"
    assert json.loads(tc[0]["function"]["arguments"]) == {"key": "val"}
    
    # 2. No arguments opening brace (e.g. no args tool call)
    interceptor = StreamInterceptor(parser)
    c, r, tc = interceptor.process_chunk("<|tool_call>call:toolB<tool_call|>")
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "toolB"
    assert json.loads(tc[0]["function"]["arguments"]) == {}
    
    # 3. Direct JSON parsing
    interceptor = StreamInterceptor(parser)
    c, r, tc = interceptor.process_chunk("<|tool_call>call:toolC{\"x\": 10, \"y\": \"hello\"}<tool_call|>")
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "toolC"
    assert json.loads(tc[0]["function"]["arguments"]) == {"x": 10, "y": "hello"}
    
    # 4. Trailing commas in structural parts
    interceptor = StreamInterceptor(parser)
    c, r, tc = interceptor.process_chunk("<|tool_call>call:toolD{key:<|\\\"|>val<|\\\"|>,}<tool_call|>")
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "toolD"
    assert json.loads(tc[0]["function"]["arguments"]) == {"key": "val"}
    
    # 5. Auto-closing unclosed string delimiters (lenient odd-part auto-close)
    interceptor = StreamInterceptor(parser)
    c, r, tc = interceptor.process_chunk("<|tool_call>call:toolE{key:<|\\\"|>unclosed}<tool_call|>")
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "toolE"
    assert json.loads(tc[0]["function"]["arguments"]) == {"key": "unclosed"}
    
    # 6. Auto-closing unbalanced curly braces
    interceptor = StreamInterceptor(parser)
    c, r, tc = interceptor.process_chunk("<|tool_call>call:toolF{key:<|\\\"|>val<|\\\"|><tool_call|>")
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "toolF"
    assert json.loads(tc[0]["function"]["arguments"]) == {"key": "val"}
    
    # 7. Unescaped quote delimiter (<|"|>)
    interceptor = StreamInterceptor(parser)
    c, r, tc = interceptor.process_chunk("<|tool_call>call:toolG{key:<|\"|>val<|\"|>}<tool_call|>")
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "toolG"
    assert json.loads(tc[0]["function"]["arguments"]) == {"key": "val"}
    
    # 8. Unquoted keys with dashes and numbers
    interceptor = StreamInterceptor(parser)
    c, r, tc = interceptor.process_chunk("<|tool_call>call:toolH{my-key-1:<|\"|>val<|\"|>}<tool_call|>")
    assert len(tc) == 1
    assert tc[0]["function"]["name"] == "toolH"
    assert json.loads(tc[0]["function"]["arguments"]) == {"my-key-1": "val"}


