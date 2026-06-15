# backend/tools/catalog/preferences.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

ADD_USER_PREFERENCE = ToolSpec(
    name="add_user_preference",
    description="Adds a new preference or profile fact about the user (likes, dislikes, global preferences). ALWAYS rephrase and compress the fact to be as terse as possible before saving to conserve space. Do NOT store project-specific context or general knowledge.",
    parameters={
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "The extremely concise, compressed fact to remember (e.g. 'Likes dark mode', 'Born in Seattle')."
            },
            "tag": {
                "type": "string",
                "enum": ["preference", "personal_info", "dislike", "other"],
                "description": "The category of the preference."
            }
        },
        "required": ["content", "tag"]
    },
    implementation="backend.tools.preferences.add_user_preference",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
)

EDIT_USER_PREFERENCE = ToolSpec(
    name="edit_user_preference",
    description="Updates an existing user preference or profile entry. ALWAYS rephrase and compress facts to be as terse as possible before saving to conserve space.",
    parameters={
        "type": "object",
        "properties": {
            "id": {
                "type": "string",
                "description": "The exact ID of the preference to edit."
            },
            "content": {
                "type": "string",
                "description": "The new, updated concise content."
            },
            "tag": {
                "type": "string",
                "enum": ["preference", "personal_info", "dislike", "other"],
                "description": "The updated category of the preference."
            }
        },
        "required": ["id", "content", "tag"]
    },
    implementation="backend.tools.preferences.edit_user_preference",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
)

DELETE_USER_PREFERENCE = ToolSpec(
    name="delete_user_preference",
    description="Deletes an outdated or contradictory user preference by its exact ID.",
    parameters={
        "type": "object",
        "properties": {
            "id": {
                "type": "string",
                "description": "The exact ID of the preference to delete."
            }
        },
        "required": ["id"]
    },
    implementation="backend.tools.preferences.delete_user_preference",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
)

SPECS = [ADD_USER_PREFERENCE, EDIT_USER_PREFERENCE, DELETE_USER_PREFERENCE]
