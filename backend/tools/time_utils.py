import os
import time
import datetime

def get_current_time():
    """Returns the current local date and time as a formatted string."""
    # Ensure the process respects the TZ environment variable if set
    if os.name != 'nt' and hasattr(time, 'tzset'):
        time.tzset()
    now = datetime.datetime.now()
    return now.strftime("%A, %B %d, %Y %I:%M:%S %p")

def get_current_date():
    """Returns the current local date as a formatted string (no time)."""
    if os.name != 'nt' and hasattr(time, 'tzset'):
        time.tzset()
    now = datetime.datetime.now()
    return now.strftime("%A, %B %d, %Y")
