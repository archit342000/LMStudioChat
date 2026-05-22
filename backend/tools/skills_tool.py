"""
Tool implementation for fetching skill details.
The actual instruction injection is performed in-memory during history compilation.
"""
import logging
from backend.database import db

logger = logging.getLogger(__name__)


def get_skill_details(skill_name: str, **kwargs) -> str:
    """
    Retrieves a skill's details by name.
    Returns a success message if the skill exists, allowing the history compiler
    to dynamically inject the full instructions, or an error message if not found.
    """
    logger.info(f"Retrieving details for skill: {skill_name}")
    skill = db.get_skill_by_name(skill_name)
    if not skill:
        logger.warning(f"Skill '{skill_name}' not found in database.")
        return f"Error: Skill '{skill_name}' not found."

    return f"Successfully loaded skill details for '{skill_name}'."
