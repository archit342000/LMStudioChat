import threading
import asyncio
import logging
from typing import Callable, Any

from .executor import TaskExecutor

logger = logging.getLogger(__name__)

class TaskWorker(threading.Thread):
    """
    Isolated thread worker that runs a single task's asyncio loop.
    """
    def __init__(
        self, 
        chat_id: str, 
        execute_fn: Callable, 
        task_type: str,
        manager: Any,
        **kwargs
    ):
        super().__init__(name=f"TaskWorker-{chat_id}", daemon=True)
        self.chat_id = chat_id
        self.execute_fn = execute_fn
        self.task_type = task_type
        self.manager = manager
        self.kwargs = kwargs
        self.loop = None

    def run(self):
        """Thread entry point."""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        
        executor = TaskExecutor(
            chat_id=self.chat_id,
            execute_fn=self.execute_fn,
            manager=self.manager,
            kwargs=self.kwargs
        )

        try:
            self.loop.run_until_complete(executor.run())
        except Exception as e:
            logger.error(f"TaskWorker {self.chat_id} failed: {e}", exc_info=True)
        finally:
            self.manager.pop_task(self.chat_id)
            self.loop.close()

    def stop(self):
        """Thread-safe stop signal."""
        if self.loop and self.loop.is_running():
            self.loop.call_soon_threadsafe(self._cancel_all_tasks)

    def _cancel_all_tasks(self):
        for task in asyncio.all_tasks(self.loop):
            task.cancel()
