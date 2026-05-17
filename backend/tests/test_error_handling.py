import pytest
import time
import asyncio
from unittest.mock import MagicMock, AsyncMock
from backend.error_handling import CircuitBreaker, CircuitOpenError

def test_circuit_breaker_init():
    cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0.1)
    status = cb.get_status()
    assert status['state'] == 'closed'
    assert status['failure_count'] == 0
    assert status['failure_threshold'] == 2

def test_circuit_breaker_sync_success():
    cb = CircuitBreaker(failure_threshold=2)
    mock_func = MagicMock(return_value="success")
    
    result = cb.call(mock_func, "arg1", key="val1")
    
    assert result == "success"
    mock_func.assert_called_with("arg1", key="val1")
    assert cb.state == 'closed'
    assert cb.failure_count == 0

def test_circuit_breaker_sync_failure_to_open():
    cb = CircuitBreaker(failure_threshold=2, recovery_timeout=60)
    mock_func = MagicMock(side_effect=ValueError("fail"))
    
    # First failure
    with pytest.raises(ValueError):
        cb.call(mock_func)
    assert cb.state == 'closed'
    assert cb.failure_count == 1
    
    # Second failure -> Open
    with pytest.raises(ValueError):
        cb.call(mock_func)
    assert cb.state == 'open'
    assert cb.failure_count == 2
    
    # Subsequent calls fail with CircuitOpenError
    with pytest.raises(CircuitOpenError):
        cb.call(mock_func)

@pytest.mark.anyio
async def test_circuit_breaker_async_success():
    cb = CircuitBreaker(failure_threshold=2)
    mock_func = AsyncMock(return_value="async_success")
    
    result = await cb.call_async(mock_func, "arg1")
    
    assert result == "async_success"
    mock_func.assert_called_with("arg1")
    assert cb.state == 'closed'

@pytest.mark.anyio
async def test_circuit_breaker_recovery():
    # threshold 1, timeout 0.1s
    cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.1)
    
    # Trip it
    mock_fail = MagicMock(side_effect=Exception("trip"))
    with pytest.raises(Exception):
        cb.call(mock_fail)
    assert cb.state == 'open'
    
    # Wait for timeout
    await asyncio.sleep(0.15)
    
    # Next call should be 'half-open' -> 'closed' on success
    mock_success = MagicMock(return_value="recovered")
    result = cb.call(mock_success)
    
    assert result == "recovered"
    assert cb.state == 'closed'
    assert cb.failure_count == 0

def test_should_attempt_recovery():
    cb = CircuitBreaker(recovery_timeout=10)
    assert cb._should_attempt_recovery() is True # No failures yet
    
    cb.on_failure()
    assert cb._should_attempt_recovery() is False # Just failed
    
    cb.last_failure_time = time.time() - 11
    assert cb._should_attempt_recovery() is True # Timed out

def test_on_success():
    cb = CircuitBreaker()
    cb.on_success()
    assert cb.failure_count == 0
