# backend/prompts/loader.py
import os
import yaml
from typing import Dict, Any, List, Optional

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
EXAMPLES_FILE = os.path.join(os.path.dirname(__file__), "examples.yaml")


class PromptLoader:
    _cached_templates: Dict[str, str] = {}
    _cached_examples: Optional[Dict[str, Any]] = None

    @classmethod
    def load_template(cls, template_name: str, **kwargs) -> str:
        """
        Load a text template from the templates/ directory and interpolate formatting arguments.
        Enforces strict XML tagging structure.
        """
        if not template_name.endswith(".txt"):
            template_name += ".txt"
        
        path = os.path.join(TEMPLATE_DIR, template_name)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Prompt template not found: {path}")
            
        if template_name not in cls._cached_templates:
            with open(path, "r", encoding="utf-8") as f:
                cls._cached_templates[template_name] = f.read()
            
        template_content = cls._cached_templates[template_name]
            
        try:
            return template_content.format(**kwargs)
        except KeyError as e:
            raise KeyError(f"Missing placeholder variable {e} when rendering prompt template '{template_name}'")

    @classmethod
    def load_examples(cls, agent_name: str) -> str:
        """
        Load and format YAML few-shot examples for a specific agent.
        """
        if cls._cached_examples is None:
            if os.path.exists(EXAMPLES_FILE):
                with open(EXAMPLES_FILE, "r", encoding="utf-8") as f:
                    cls._cached_examples = yaml.safe_load(f) or {}
            else:
                cls._cached_examples = {}
                
        agent_examples = cls._cached_examples.get(agent_name, [])
        if not agent_examples:
            return ""
            
        formatted_examples = ["\n## FEW-SHOT EXAMPLES"]
        for idx, item in enumerate(agent_examples):
            query = item.get("query", "")
            examples = item.get("examples", "")
            formatted_examples.append(
                f"<few_shot_example index=\"{idx}\">\n"
                f"<user_query>\n{query}\n</user_query>\n"
                f"<expected_interaction>\n{examples.strip()}\n</expected_interaction>\n"
                f"</few_shot_example>"
            )
        return "\n\n".join(formatted_examples)


class PromptWrapper:
    """
    Backwards-compatible string-like wrapper for prompts that formats lazily at runtime.
    Loads templates and few-shot examples from disk on .format() invocation.
    """
    def __init__(self, template_name: str, **sub_templates: str):
        self.template_name = template_name
        self.sub_templates = sub_templates

    def format(self, **kwargs) -> str:
        resolved_subs = {
            k: PromptLoader.load_template(v)
            for k, v in self.sub_templates.items()
        }
        prompt = PromptLoader.load_template(
            self.template_name,
            **resolved_subs,
            **kwargs
        )
        
        # Check for YAML examples using the base agent name (e.g. browsing_agent)
        agent_name = self.template_name.replace("_prompt", "").replace("_text", "").replace("_vision", "")
        examples = PromptLoader.load_examples(agent_name)
        if examples:
            prompt += "\n\n" + examples
            
        return prompt

