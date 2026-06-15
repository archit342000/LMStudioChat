# backend/tools/catalog/time.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

GET_TIME = ToolSpec(
    name="get_time",
    description="Returns the current local date and time.",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    implementation="backend.tools.time_utils.get_current_time",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
    directives="""\
## Temporal Awareness
You have no reliable internal sense of the current date or time — your training data has a cutoff and you cannot know how much time has passed since then. When the current date, time, or day of week is relevant (e.g., for relative searches like "latest news", "this week's prices", or any time-sensitive query), you MUST call `get_time` first and use its result. Never guess or assume the current date.
""",
)

GET_SKILL_DETAILS = ToolSpec(
    name="get_skill_details",
    description="Loads the full, detailed instructions of a specific skill. The main model initially only knows the names and descriptions of available skills to avoid context bloat. Call this tool to retrieve a skill's full instructions when needed.",
    parameters={
        "type": "object",
        "properties": {
            "skill_name": {
                "type": "string",
                "description": "The exact name of the skill to fetch details for."
            }
        },
        "required": ["skill_name"]
    },
    implementation="backend.tools.skills_tool.get_skill_details",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
    directives="""\
## Skills Store Tool Rules
The `get_skill_details` tool allows you to retrieve the full, detailed instructions of a specific custom skill. 

### Rules
1. To avoid context bloat, the system prompt initially only contains a list of available skill names and their brief descriptions.
2. If the user invokes a custom skill name or asks you to perform a task matching one of the available skill descriptions, you MUST call `get_skill_details` with the exact `skill_name` to retrieve its full execution instructions first.
3. Once you retrieve the instructions, strictly follow them to fulfill the user's request.
""",
)

SPECS = [GET_TIME, GET_SKILL_DETAILS]
