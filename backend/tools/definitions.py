
MANAGE_USER_PREFERENCES_TOOL = {
    "type": "function",
    "function": {
        "name": "manage_user_preferences",
        "description": "Updates the user preferences and profile store. Use this to save, edit, or delete personal facts about the user, their likes, dislikes, and global interaction preferences. ALWAYS rephrase and compress facts to be as terse as possible before saving to conserve space. Do NOT store project-specific context or general knowledge.",
        "parameters": {
            "type": "object",
            "properties": {
                "additions": {
                    "type": "array",
                    "description": "List of new profile entries or preferences to add.",
                    "items": {
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
                    }
                },
                "edits": {
                    "type": "array",
                    "description": "List of existing preferences to update.",
                    "items": {
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
                    }
                },
                "deletions": {
                    "type": "array",
                    "description": "List of exact preference IDs to delete (e.g., if they are outdated or contradict new information).",
                    "items": {
                        "type": "string"
                    }
                }
            },
            "required": []
        }
    }
}

VISIT_PAGE_TOOL = {
    "type": "function",
    "function": {
        "name": "visit_page_tool",
        "description": "Visits a specific URL and optionally extracts information based on a query.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The precise URL to visit."
                },
                "query": {
                    "type": "string",
                    "description": "Optional. A specific instruction (e.g., 'Summarize', 'Find the pricing') for the sub-agent to execute."
                },
                "detail_level": {
                    "type": "string",
                    "enum": ["basic", "standard", "deep"],
                    "description": "Extraction depth: 'basic' (fast clean text), 'standard' (balanced, keeps tables/links), 'deep' (full render for complex dashboards)."
                }
            },
            "required": ["url"]
        }
    }
}

FILE_SYSTEM_VISIT_PAGE_TOOL = {
    "type": "function",
    "function": {
        "name": "visit_page_tool",
        "description": "Visits a specific URL and extracts its visible text content. ALWAYS returns raw unedited content.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The precise URL to visit."
                },
                "detail_level": {
                    "type": "string",
                    "enum": ["basic", "standard", "deep"],
                    "description": "Extraction depth: 'basic' (fast clean text), 'standard' (balanced, keeps tables/links), 'deep' (full render for complex dashboards)."
                }
            },
            "required": ["url"]
        }
    }
}

GET_TIME_TOOL = {
    "type": "function",
    "function": {
        "name": "get_time",
        "description": "Returns the current local date and time.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}


VALIDATE_OUTPUT_FORMAT_TOOL = {
    "type": "function",
    "function": {
        "name": "validate_output_format",
        "description": "SYSTEM-ONLY TOOL — you are FORBIDDEN from calling this tool. It runs automatically after every response to check formatting. If issues are found, you will receive a tool result describing each issue and asking you to output <fix> blocks. Each <fix> block must contain <prefix> (the ~50 tokens before the fix point, copied exactly from your response), <correction> (the fix itself), and <suffix> (the ~50 tokens after the fix point, copied exactly from your response). If the fix point is near the start or end of your response, use whatever tokens are available instead of inventing tokens. Output ONLY the <fix> blocks with no commentary.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}

CREATE_FS_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "create_fs_file",
        "description": "Creates a new persistent file_system at the specified path. Returns the status. Fails if a file already exists at that path.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The full relative path including directories and filename (e.g. 'src/utils/math.py')."
                },
                "content": {
                    "type": "string",
                    "description": "Initial content for the file_system."
                },
                "file_system_type": {
                    "type": "string",
                    "description": "Optional type/status update (e.g. 'research_plan_approved')."
                }
            },
            "required": ["path", "content"]
        }
    }
}

GREP_FILES_TOOL = {
    "type": "function",
    "function": {
        "name": "grep_files",
        "description": "Searches for a text pattern across file_systems in this chat session. Use this to find which file contains specific information.",
        "parameters": {
            "type": "object",
            "properties": {
                "pattern": { "type": "string" },
                "is_regex": { "type": "boolean" },
                "path": { "type": "string", "description": "Optional. The directory or file path to search within (e.g., 'src/'). If omitted, searches all files." },
                "context_chars": { "type": "integer", "description": "Number of characters to return before and after each match. Default is 300.", "default": 300 },
                "max_matches_per_file_system": { "type": "integer", "default": 5 },
                "names_only": { "type": "boolean", "description": "If true, only returns the paths that match, without the surrounding text." }
            },
            "required": ["pattern"]
        }
    }
}

READ_FS_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "read_fs_file",
        "description": "Reads the content of a specific file_system by its path.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "The full relative path of the file_system." },
                "start_line": { "type": "integer", "description": "1-indexed start line." },
                "end_line": { "type": "integer", "description": "1-indexed end line." },
                "outline": { "type": "boolean", "description": "If true, returns a structural outline." }
            },
            "required": ["path"]
        }
    }
}

REPLACE_FS_TEXT_TOOL = {
    "type": "function",
    "function": {
        "name": "replace_fs_text",
        "description": "Finds and replaces text in a file_system specified by path. Returns per-edit status and a unified diff.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "The full relative path of the file_system." },
                "expected_version": { "type": "integer", "description": "Must match current version." },
                "edits": {
                    "type": "array",
                    "description": "Edits applied sequentially.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "target_text": { "type": "string", "description": "Exact text to find." },
                            "new_content": { "type": "string", "description": "Replacement text. Use empty string to delete." },
                            "start_line": { "type": "integer", "description": "Optional. Disambiguates duplicate matches." },
                            "end_line": { "type": "integer", "description": "Optional. Disambiguates duplicate matches." },
                            "allow_multiple": { "type": "boolean" }
                        },
                        "required": ["target_text", "new_content"]
                    }
                }
            },
            "required": ["path", "expected_version", "edits"]
        }
    }
}

REPLACE_FS_LINES_TOOL = {
    "type": "function",
    "function": {
        "name": "replace_fs_lines",
        "description": "Overwrites a line range in a file_system specified by path. Fallback when text matching fails.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "The full relative path of the file_system." },
                "expected_version": { "type": "integer", "description": "Must match current version." },
                "edits": {
                    "type": "array",
                    "description": "Edits applied sequentially.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "start_line": { "type": "integer" },
                            "end_line": { "type": "integer" },
                            "new_content": { "type": "string", "description": "Content to replace the line range with." }
                        },
                        "required": ["start_line", "end_line", "new_content"]
                    }
                }
            },
            "required": ["path", "expected_version", "edits"]
        }
    }
}

CREATE_DIRECTORY_TOOL = {
    "type": "function",
    "function": {
        "name": "create_directory",
        "description": "Creates a new empty directory in the file_system system.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "The full relative path of the directory to create (e.g. 'src/utils')." }
            },
            "required": ["path"]
        }
    }
}

DELETE_DIRECTORY_TOOL = {
    "type": "function",
    "function": {
        "name": "delete_directory",
        "description": "Deletes an empty directory in the file_system system. Fails if the directory contains tracked files.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "The full relative path of the directory to delete (e.g. 'src/utils')." }
            },
            "required": ["path"]
        }
    }
}

MOVE_FS_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "move_fs_file",
        "description": "Moves or renames a file_system file to a new path.",
        "parameters": {
            "type": "object",
            "properties": {
                "source_path": { "type": "string", "description": "The current full relative path of the file_system." },
                "destination_path": { "type": "string", "description": "The new full relative path for the file_system." }
            },
            "required": ["source_path", "destination_path"]
        }
    }
}

DELETE_FS_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "delete_fs_file",
        "description": "Permanently deletes a file_system file at the specified path.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "The full relative path of the file_system to delete." }
            },
            "required": ["path"]
        }
    }
}

LS_FILES_TOOL = {
    "type": "function",
    "function": {
        "name": "ls_files",
        "description": "Lists the files and directories in a specific path within the file_system system.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Optional. The directory path to list (e.g., 'src/components'). If omitted or '/', lists the root directory. Returns only immediate children, not the full recursive tree."
                }
            },
            "required": []
        }
    }
}

PREVIEW_FILE_SYSTEMS_TOOL = {
    "type": "function",
    "function": {
        "name": "preview_file_systems",
        "description": "SYSTEM-ONLY TOOL — this tool is automatically invoked by the system and you are FORBIDDEN from calling it. The system will provide file_system inventory as a tool response before your turn. Use the information from the tool response, do not attempt to call this tool.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}

DOCUMENT_AGENT_TOOL = {
    "type": "function",
    "function": {
        "name": "document_agent",
        "description": "Delegates a document analysis task to an autonomous agent. The agent uses RAG, grep, and line/page reading to investigate uploaded files (documents, code, or images).",
        "parameters": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The unique ID of the file to analyze (e.g., 'file_abc123')."
                },
                "query": {
                    "type": "string",
                    "description": "The specific question or instruction for analyzing the file (e.g., 'Summarize the key findings', 'What is the value of X?')."
                }
            },
            "required": ["file_id", "query"]
        }
    }
}

DOCUMENT_AGENT_RAG_TOOL = {
    "type": "function",
    "function": {
        "name": "document_agent_rag",
        "description": "Performs a semantic search (RAG) across the chunks of the uploaded document. Best for broad conceptual queries or finding information when you don't know the exact phrasing.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The ID of the file to search."
                },
                "query": {
                    "type": "string",
                    "description": "The semantic concept or question to search for."
                },
                "depth": {
                    "type": "string",
                    "enum": ["basic", "standard", "deep"],
                    "description": "Amount of chunks to return."
                }
            },
            "required": ["file_id", "query"]
        }
    }
}

GREP_UPLOADED_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "grep_uploaded_file",
        "description": "Performs a literal text or regex search across the raw extracted text of the uploaded file. Best for finding exact keywords, variable names, or specific values.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The ID of the file to search."
                },
                "query": {
                    "type": "string",
                    "description": "The exact string or regex pattern to find."
                },
                "is_regex": {
                    "type": "boolean",
                    "description": "Set to true if query is a regular expression."
                },
                "context_chars": {
                    "type": "integer",
                    "description": "Number of characters to return before and after each match for context. Default is 300. Increase for wider context, decrease to save tokens."
                }
            },
            "required": ["file_id", "query"]
        }
    }
}

READ_UPLOADED_FILE_LINES_TOOL = {
    "type": "function",
    "function": {
        "name": "read_uploaded_file",
        "description": "Reads a specific range of lines from the raw text of the uploaded file. Use this to verify context after finding a hit via RAG or grep.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The ID of the file to read."
                },
                "start_line": {
                    "type": "integer",
                    "description": "1-indexed starting line number."
                },
                "end_line": {
                    "type": "integer",
                    "description": "1-indexed ending line number."
                }
            },
            "required": ["file_id"]
        }
    }
}

READ_UPLOADED_FILE_PAGE_TOOL = {
    "type": "function",
    "function": {
        "name": "read_uploaded_file",
        "description": "Reads a specific page from the uploaded document. Use this to read page-based content after finding a hit via RAG or grep.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "The ID of the file to read."
                },
                "page": {
                    "type": "integer",
                    "description": "The 1-indexed page number to read."
                }
            },
            "required": ["file_id", "page"]
        }
    }
}

REQUEST_CLARIFICATION_TOOL = {
    "type": "function",
    "function": {
        "name": "request_clarification",
        "description": "Ask the user a focused question when their request is ambiguous or lacks information needed to proceed.",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The specific question to ask the user."
                },
                "options": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional MCQ choices rendered as buttons in the UI."
                }
            },
            "required": ["question"]
        }
    }
}

RESEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "research",
        "description": "Triggers an autonomous, multi-phase deep research agent to investigate a complex topic. Use this to delegate research tasks to the research agent. ",
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": "The specific research topic or question to investigate deeply."
                }
            },
            "required": ["topic"]
        }
    }
}

FILE_SYSTEM_AGENT_TOOL = {
    "type": "function",
    "function": {
        "name": "file_system_agent",
        "description": "Delegates a file_system task to a specialized sub-agent capable of multi-step read/write operations across one or more file_systems.",
        "parameters": {
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": "Self-contained task description. The agent has no access to conversation history."
                }
            },
            "required": ["instruction"]
        }
    }
}

SEARCH_WEB_TOOL = {
    "type": "function",
    "function": {
        "name": "search_web",
        "description": "Executes a web search. Use this for general queries or news.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to execute."
                },
                "topic": {
                    "type": "string",
                    "enum": ["general", "news"],
                    "description": "The category of the search."
                },
                "time_range": {
                    "type": "string",
                    "enum": ["day", "week", "month", "year", "d", "w", "m", "y"],
                    "description": "The time range to filter results (e.g., 'day', 'week', 'month', 'year'). Use only when recent information is explicitly needed."
                },
                "depth": {
                    "type": "string",
                    "enum": ["normal", "deep"],
                    "default": "normal",
                    "description": "The search depth. 'normal' uses Tavily's native answer generation for speed. 'deep' retrieves full raw content for detailed analysis."
                },
                "context": {
                    "type": "string",
                    "description": "Context explaining why the search is being performed and what specific information is needed from the results."
                },
                "return_raw_results": {
                    "type": "boolean",
                    "description": "If true, skips synthesis and returns the raw search data. Use this only when deep, manual analysis of the sources is required."
                }
            },
            "required": ["query"]
        }
    }
}

FILE_SYSTEM_SEARCH_WEB_TOOL = {
    "type": "function",
    "function": {
        "name": "search_web",
        "description": "Executes a web search. Returns raw search results, excerpts, and URLs.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to execute."
                },
                "topic": {
                    "type": "string",
                    "enum": ["general", "news"],
                    "description": "The category of the search."
                },
                "time_range": {
                    "type": "string",
                    "enum": ["day", "week", "month", "year", "d", "w", "m", "y"],
                    "description": "The time range to filter results (e.g., 'day', 'week', 'month', 'year'). Use only when recent information is explicitly needed."
                }
            },
            "required": ["query"]
        }
    }
}

MANAGE_TASK_LIST_TOOL = {
    "type": "function",
    "function": {
        "name": "manage_task_list",
        "description": "Creates, updates, or views a persistent task list/checklist for the current chat or sub-agent session. Used to track progress on multi-step objectives.",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["initialize", "add_step", "update_status", "view"],
                    "description": "The operation to perform. 'initialize' creates a new list (overwriting any existing one). 'add_step' appends a new task. 'update_status' modifies a task. 'view' returns the current list."
                },
                "items": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Used with 'initialize' to provide the initial list of task descriptions, or with 'add_step' to provide new task descriptions."
                },
                "step_id": {
                    "type": "integer",
                    "description": "Used with 'update_status' to identify the specific task by its ID."
                },
                "status": {
                    "type": "string",
                    "enum": ["TODO", "DONE", "BLOCKED", "DROPPED"],
                    "description": "Used with 'update_status' to set the new state of the task."
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes or breadcrumbs to attach to a task when updating its status (e.g., reason for being blocked)."
                }
            },
            "required": ["action"]
        }
    }
}

BROWSING_AGENT_TOOL = {
    "type": "function",
    "function": {
        "name": "browsing_agent",
        "description": "Delegates a complex web browsing task to an autonomous agent that can navigate pages, click elements, fill forms, scroll, and extract data across multiple steps. Use this when a task requires interactive browsing beyond a simple search or page visit.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Self-contained description of the browsing task. The agent has no access to conversation history."
                },
                "success_criteria": {
                    "type": "string",
                    "description": "CRITICAL: Define the exact stopping condition or goal for the agent. This is used to evaluate when the task is complete."
                },
                "start_url": {
                    "type": "string",
                    "description": "Optional starting URL. If provided, the agent will be instructed to begin its task at this page."
                },
                "scope": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "Optional domain whitelist (e.g., ['google.com']). If provided, the agent may only use browser_navigate to visit these domains directly. It is free to follow links (via browser_click) to external domains."
                }
            },
            "required": ["query", "success_criteria"]
        }
    }
}

BROWSER_NAVIGATE_TOOL = {
    "type": "function",
    "function": {
        "name": "browser_navigate",
        "description": "Navigates the browser to a specific URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to navigate to."
                }
            },
            "required": ["url"]
        }
    }
}

BROWSER_READ_PAGE_TOOL = {
    "type": "function",
    "function": {
        "name": "browser_read_page",
        "description": "Extracts visible text content from the current page, converted to markdown.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}

BROWSER_CLICK_TOOL = {
    "type": "function",
    "function": {
        "name": "browser_click",
        "description": "Clicks an element by CSS selector.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "The CSS selector of the element to click."
                }
            },
            "required": ["selector"]
        }
    }
}

BROWSER_TYPE_TOOL = {
    "type": "function",
    "function": {
        "name": "browser_type",
        "description": "Types text into an input, optionally pressing Enter.",
        "parameters": {
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
        }
    }
}

BROWSER_SCROLL_TOOL = {
    "type": "function",
    "function": {
        "name": "browser_scroll",
        "description": "Scrolls the page up or down.",
        "parameters": {
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
        }
    }
}

BROWSER_GET_INTERACTIVE_ELEMENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "browser_get_interactive_elements",
        "description": "Returns a structured list of clickable/typeable elements on the current page with their selectors.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}

BROWSER_SCREENSHOT_TOOL = {
    "type": "function",
    "function": {
        "name": "browser_screenshot",
        "description": "Takes a full-page screenshot of the current page and returns it as a base64-encoded PNG image. This tool allows you to visually inspect the page.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}

BROWSER_BACK_TOOL = {
    "type": "function",
    "function": {
        "name": "browser_back",
        "description": "Navigates back to the previous page in the browser history.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}

BROWSING_AGENT_TOOLS_BASE = [
    BROWSER_NAVIGATE_TOOL,
    BROWSER_READ_PAGE_TOOL,
    BROWSER_CLICK_TOOL,
    BROWSER_TYPE_TOOL,
    BROWSER_SCROLL_TOOL,
    BROWSER_BACK_TOOL,
    BROWSER_GET_INTERACTIVE_ELEMENTS_TOOL,
    REQUEST_CLARIFICATION_TOOL,
    MANAGE_TASK_LIST_TOOL,
]

BROWSING_AGENT_TOOLS_VISION = BROWSING_AGENT_TOOLS_BASE + [
    BROWSER_SCREENSHOT_TOOL,
]

# Group tools by availability
FILE_SYSTEM_INTERNAL_TOOLS = [
    CREATE_FS_FILE_TOOL,
    CREATE_DIRECTORY_TOOL,
    LS_FILES_TOOL,
    GREP_FILES_TOOL,
    READ_FS_FILE_TOOL,
    REPLACE_FS_TEXT_TOOL,
    REPLACE_FS_LINES_TOOL,
    MOVE_FS_FILE_TOOL,
    REQUEST_CLARIFICATION_TOOL,
    # FILE_SYSTEM_SEARCH_WEB_TOOL,
    MANAGE_TASK_LIST_TOOL,
    # FILE_SYSTEM_VISIT_PAGE_TOOL
]

DOCUMENT_AGENT_INTERNAL_TOOLS_BASE = [
    DOCUMENT_AGENT_RAG_TOOL,
    GREP_UPLOADED_FILE_TOOL,
    REQUEST_CLARIFICATION_TOOL,
    MANAGE_TASK_LIST_TOOL
]

# MIME types that support page-based reading (have PAGE_START/PAGE_END markers)
PAGE_BASED_MIME_TYPES = frozenset([
    "application/pdf",
])

def get_document_agent_tools(mime_type: str) -> list:
    """Returns the correct tool set for the document agent based on the file's MIME type."""
    if mime_type.startswith('image/'):
        return []
    elif mime_type in PAGE_BASED_MIME_TYPES:
        return DOCUMENT_AGENT_INTERNAL_TOOLS_BASE + [READ_UPLOADED_FILE_PAGE_TOOL]
    else:
        return DOCUMENT_AGENT_INTERNAL_TOOLS_BASE + [READ_UPLOADED_FILE_LINES_TOOL]

# Tools available to the main assistant
MAIN_ASSISTANT_TOOLS = [
    GET_TIME_TOOL,
    VISIT_PAGE_TOOL,
    DOCUMENT_AGENT_TOOL,
    REQUEST_CLARIFICATION_TOOL,
    RESEARCH_TOOL,
    FILE_SYSTEM_AGENT_TOOL,
    BROWSING_AGENT_TOOL,
    SEARCH_WEB_TOOL,
    MANAGE_TASK_LIST_TOOL
]

