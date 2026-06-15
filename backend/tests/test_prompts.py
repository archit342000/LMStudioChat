from backend.chat.prompt_builder import PromptBuilder, PromptContext

def test_prompts_composed():
    # Test Base System Prompt composition via PromptBuilder
    ctx = PromptContext(chat_metadata={})
    builder = PromptBuilder(ctx)
    base_prompt = builder.build()
    
    assert "Identity and Role" in base_prompt
    assert "Multi-agent Architecture" in base_prompt
    assert "Chain-of-Thought" in base_prompt
    
    # Test Research Mode prompt composition
    research_ctx = PromptContext(chat_metadata={"research_mode": 1})
    research_builder = PromptBuilder(research_ctx)
    research_prompt = research_builder.build()
    
    # Research mode should have the research directives
    assert "Research Agent Mode: ACTIVE" in research_prompt
