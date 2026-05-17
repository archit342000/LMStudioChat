"""
Exhaustive registry of known text, code, and data file extensions.
Mapped to their respective MIME types for robust backend validation and RAG chunking hints.
"""

EXHAUSTIVE_TEXT_EXTENSIONS = {
    # Programming Languages
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.cxx': 'text/x-c++',
    '.h': 'text/x-c',
    '.hpp': 'text/x-c++',
    '.cs': 'text/x-csharp',
    '.java': 'text/x-java',
    '.py': 'text/x-python',
    '.pyw': 'text/x-python',
    '.rb': 'text/x-ruby',
    '.php': 'text/x-php',
    '.js': 'application/javascript',
    '.jsx': 'application/javascript',
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.swift': 'text/x-swift',
    '.kt': 'text/x-kotlin',
    '.scala': 'text/x-kotlin', # often grouped
    '.sh': 'text/x-sh',
    '.bash': 'text/x-sh',
    '.zsh': 'text/x-sh',
    '.bat': 'text/plain', # Windows batch (text)
    '.ps1': 'application/x-powershell',
    '.pl': 'text/x-perl',
    '.pm': 'text/x-perl',
    '.lua': 'text/x-lua',
    '.r': 'text/x-r',
    '.m': 'text/x-m',
    '.dart': 'text/x-dart',
    '.groovy': 'text/x-groovy',
    '.clj': 'text/x-groovy', # clojure
    '.ex': 'text/x-elixir',
    '.exs': 'text/x-elixir',
    '.erl': 'text/x-erlang',
    '.hrl': 'text/x-erlang',
    '.ml': 'text/x-ocaml',
    '.mli': 'text/x-ocaml',
    '.fs': 'text/x-fsharp',
    '.fsi': 'text/x-fsharp',
    '.vb': 'text/x-vb',
    '.asm': 'text/x-asm',
    '.s': 'text/x-asm',
    '.v': 'text/x-verilog',
    '.sv': 'text/x-verilog',
    '.vhd': 'text/x-verilog',
    '.vhdl': 'text/x-verilog',
    
    # Web & Markup
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.scss': 'text/css',
    '.sass': 'text/css',
    '.less': 'text/css',
    '.xml': 'text/xml',
    '.svg': 'image/svg+xml',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.rst': 'text/x-rst',
    '.tex': 'text/x-tex',
    '.lat': 'text/x-tex',
    
    # Data & Config
    '.json': 'application/json',
    '.jsonc': 'application/json',
    '.jsonl': 'application/json',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.toml': 'text/x-toml',
    '.ini': 'text/plain',
    '.cfg': 'text/plain',
    '.conf': 'text/plain',
    '.csv': 'text/csv',
    '.tsv': 'text/tab-separated-values',
    '.sql': 'application/sql',
    '.env': 'text/plain',
    '.properties': 'text/plain',
    
    # Logs & Plain Text
    '.txt': 'text/plain',
    '.log': 'text/plain',
    '.out': 'text/plain',
    
    # Scripts & Miscellaneous
    '.cmake': 'text/plain',
    '.make': 'text/plain',
    '.dockerfile': 'text/plain',
    '.ignore': 'text/plain' # e.g. .gitignore
}
