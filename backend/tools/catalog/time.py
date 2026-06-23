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
)

SPECS = [GET_TIME, GET_SKILL_DETAILS]
