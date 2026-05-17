from .manager import TaskManager

# Global singleton instance
task_manager = TaskManager()

__all__ = ["task_manager", "TaskManager"]
