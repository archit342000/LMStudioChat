# backend/tools/catalog/__init__.py
from .time import SPECS as time_specs
from .preferences import SPECS as preference_specs
from .web import SPECS as web_specs
from .filesystem import SPECS as filesystem_specs
from .document import SPECS as document_specs
from .git import SPECS as git_specs
from .code import SPECS as code_specs
from .research import SPECS as research_specs
from .interaction import SPECS as interaction_specs
from .browser_tools import SPECS as browser_specs

ALL_TOOL_SPECS = (
    time_specs +
    preference_specs +
    web_specs +
    filesystem_specs +
    document_specs +
    git_specs +
    code_specs +
    research_specs +
    interaction_specs +
    browser_specs
)
