def merge_tool_call_deltas(existing: dict, delta: dict) -> None:
    """
    In-place merges a tool call delta chunk into the existing accumulated tool call.
    """
    if 'function' in delta:
        if 'function' not in existing:
            existing['function'] = {}
        if 'arguments' in delta['function']:
            existing['function']['arguments'] = (existing['function'].get('arguments') or '') + (delta['function'].get('arguments') or '')
        if 'name' in delta['function']:
            existing['function']['name'] = delta['function']['name']
    if 'id' in delta:
        existing['id'] = delta['id']
