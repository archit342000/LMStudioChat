# backend/tools/catalog/research.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

RESEARCH = ToolSpec(
    name="research",
    description="Triggers an autonomous, multi-phase deep research agent to investigate a complex topic. Use this to delegate research tasks to the research agent.",
    parameters={
        "type": "object",
        "properties": {
            "topic": {
                "type": "string",
                "description": "The specific research topic or question to investigate deeply."
            }
        },
        "required": ["topic"]
    },
    implementation="backend.tools.agents.research_agent.agent.flow_fn",
    tool_type=ToolType.AGENT,
    scopes=(ToolScope.MAIN,),
    requires_mode="research_mode",
)

SPECS = [RESEARCH]
