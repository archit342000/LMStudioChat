from enum import Enum

class ChannelState(Enum):
    """State of a file_system persistence channel."""
    FREE = "free"              # No operation in progress
    LOCKED_AI = "locked_ai"    # AI-initiated operation running
    LOCKED_USER = "locked_user" # User-initiated operation running
    QUEUEING = "queueing"      # Operations queued, waiting for lock
