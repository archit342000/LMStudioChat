import pytest
import datetime
from backend.tools.time_utils import get_current_time, get_current_date

def test_get_current_time():
    """Verify that current time is returned in the correct format."""
    now_str = get_current_time()
    # Check for basic format elements like day of week and month
    # e.g., "Thursday, May 14, 2026 04:00:00 PM"
    assert "," in now_str
    assert ":" in now_str
    assert any(day in now_str for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])

def test_get_current_date():
    """Verify that current date is returned in the correct format."""
    today_str = get_current_date()
    # e.g., "Thursday, May 14, 2026"
    assert "," in today_str
    assert ":" not in today_str
    assert any(day in today_str for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
