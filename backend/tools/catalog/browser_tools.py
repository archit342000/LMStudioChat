# backend/tools/catalog/browser_tools.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

BROWSER_NAVIGATE = ToolSpec(
    name="browser_navigate",
    description="Navigates the browser to a specific URL.",
    parameters={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The URL to navigate to."
            }
        },
        "required": ["url"]
    },
    implementation="backend.tools.browser.browser_navigate",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.BROWSING_BASE, ToolScope.BROWSING_VISION),
)

BROWSER_READ_PAGE = ToolSpec(
    name="browser_read_page",
    description="Extracts visible text content from the current page, converted to markdown.",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    implementation="backend.tools.browser.browser_read_page",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.BROWSING_BASE, ToolScope.BROWSING_VISION),
)

BROWSER_CLICK = ToolSpec(
    name="browser_click",
    description="Clicks an element by CSS selector.",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "The CSS selector of the element to click."
            }
        },
        "required": ["selector"]
    },
    implementation="backend.tools.browser.browser_click",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.BROWSING_BASE, ToolScope.BROWSING_VISION),
)

BROWSER_TYPE = ToolSpec(
    name="browser_type",
    description="Types text into an input, optionally pressing Enter.",
    parameters={
        "type": "object",
        "properties": {
            "selector": {
                "type": "string",
                "description": "The CSS selector of the input element."
            },
            "text": {
                "type": "string",
                "description": "The text to type."
            },
            "submit": {
                "type": "boolean",
                "description": "If true, presses Enter after typing."
            }
        },
        "required": ["selector", "text"]
    },
    implementation="backend.tools.browser.browser_type",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.BROWSING_BASE, ToolScope.BROWSING_VISION),
)

BROWSER_SCROLL = ToolSpec(
    name="browser_scroll",
    description="Scrolls the page up or down.",
    parameters={
        "type": "object",
        "properties": {
            "direction": {
                "type": "string",
                "enum": ["up", "down"],
                "description": "The direction to scroll."
            },
            "amount": {
                "type": "integer",
                "description": "The number of pixels to scroll. Default is 500."
            }
        },
        "required": ["direction"]
    },
    implementation="backend.tools.browser.browser_scroll",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.BROWSING_BASE, ToolScope.BROWSING_VISION),
)

BROWSER_GET_INTERACTIVE_ELEMENTS = ToolSpec(
    name="browser_get_interactive_elements",
    description="Returns a structured list of clickable/typeable elements on the current page with their selectors.",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    implementation="backend.tools.browser.browser_get_interactive_elements",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.BROWSING_BASE, ToolScope.BROWSING_VISION),
)

BROWSER_BACK = ToolSpec(
    name="browser_back",
    description="Navigates back to the previous page in the browser history.",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    implementation="backend.tools.browser.browser_back",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.BROWSING_BASE, ToolScope.BROWSING_VISION),
)

BROWSER_SCREENSHOT = ToolSpec(
    name="browser_screenshot",
    description="Takes a full-page screenshot of the current page and returns it as a base64-encoded PNG image. This tool allows you to visually inspect the page.",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    implementation="backend.tools.browser.browser_screenshot",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.BROWSING_VISION,),
)

SPECS = [
    BROWSER_NAVIGATE,
    BROWSER_READ_PAGE,
    BROWSER_CLICK,
    BROWSER_TYPE,
    BROWSER_SCROLL,
    BROWSER_GET_INTERACTIVE_ELEMENTS,
    BROWSER_BACK,
    BROWSER_SCREENSHOT
]
