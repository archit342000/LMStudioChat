import os
import pytest
from unittest.mock import patch, MagicMock
from backend.tools.implementations.git_executor import (
    execute_git, _sanitize_arg, _scrub_pat_from_output, _inject_pat_into_url
)

def test_sanitize_arg():
    # Safe args
    assert _sanitize_arg("main") == "main"
    assert _sanitize_arg("origin/main") == "origin/main"
    
    # Dangerous args
    with pytest.raises(ValueError, match="forbidden shell metacharacter"):
        _sanitize_arg("main; rm -rf")
    with pytest.raises(ValueError, match="forbidden shell metacharacter"):
        _sanitize_arg("foo | bar")
    with pytest.raises(ValueError, match="forbidden shell metacharacter"):
        _sanitize_arg("$(whoami)")

def test_scrub_pat_from_output():
    # Raw token URL
    assert _scrub_pat_from_output("Cloning into 'repo'...\nhttps://mytoken@github.com/org/repo") == "Cloning into 'repo'...\nhttps://<redacted>@github.com/org/repo"
    
    # Normal text unchanged
    assert _scrub_pat_from_output("Everything is up-to-date") == "Everything is up-to-date"

def test_inject_pat_into_url():
    # Mock db.get_setting
    with patch("backend.database.db.get_setting", return_value="my_secret_token"):
        # Github HTTPS URL
        assert _inject_pat_into_url("https://github.com/user/repo") == "https://my_secret_token@github.com/user/repo"
        
        # Non-Github or non-HTTPS URL
        assert _inject_pat_into_url("https://gitlab.com/user/repo") == "https://gitlab.com/user/repo"
        assert _inject_pat_into_url("git@github.com:user/repo.git") == "git@github.com:user/repo.git"

@patch("backend.tools.implementations.git_executor._get_allowed_commands")
@patch("shutil.which", return_value="/usr/bin/git")
@patch("subprocess.run")
def test_execute_git_flow(mock_run, mock_which, mock_allowed):
    mock_allowed.return_value = ["status", "clone", "checkout"]
    
    # Mock subprocess success
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "On branch main\nYour branch is up to date"
    mock_result.stderr = ""
    mock_run.return_value = mock_result
    
    # 1. Successful execution
    res = execute_git(
        subcommand="status",
        args=[],
        working_directory="my-repo/",
        chat_id="test_chat"
    )
    assert "git status succeeded." in res
    assert "On branch main" in res
    
    # 2. Blocked subcommand
    res_blocked = execute_git(
        subcommand="push",
        args=[],
        working_directory="my-repo/",
        chat_id="test_chat"
    )
    assert "is not in the allowed list" in res_blocked

    # 3. Tree-modifying command invalidates DB
    mock_result.stdout = "Switched to branch 'dev'"
    with patch("backend.database.db.get_chat_file_systems", return_value=[{"id": "fs1", "filename": "my-repo/file.txt"}]), \
         patch("backend.database.db.delete_file_system") as mock_delete:
        execute_git(
            subcommand="checkout",
            args=["dev"],
            working_directory="my-repo/",
            chat_id="test_chat"
        )
        # Should delete corresponding cached file records
        mock_delete.assert_called_once()

def test_execute_git_workspace_restriction_outside_workspace():
    # 1. Prohibited case: Outside workspace, target directory argument contains workspace prefix
    with patch("backend.file_system.utils.get_workspace_for_chat", return_value=None), \
         patch("backend.tools.implementations.git_executor._get_allowed_commands", return_value=["clone"]):
        
        res = execute_git(
            subcommand="clone",
            args=["https://github.com/user/repo", "workspace/target_dir"],
            working_directory=".",
            chat_id="chat_outside"
        )
        assert "The 'workspace/' directory is reserved for Workspace Folders" in res

    # 2. Prohibited case with relative dots/backslashes
    with patch("backend.file_system.utils.get_workspace_for_chat", return_value=None), \
         patch("backend.tools.implementations.git_executor._get_allowed_commands", return_value=["clone"]):
        
        res = execute_git(
            subcommand="clone",
            args=["https://github.com/user/repo", "./workspace"],
            working_directory=".",
            chat_id="chat_outside"
        )
        assert "The 'workspace/' directory is reserved for Workspace Folders" in res

    # 3. Allowed case: Chat has workspace ID
    with patch("backend.file_system.utils.get_workspace_for_chat", return_value="ws_id"), \
         patch("backend.tools.implementations.git_executor._get_allowed_commands", return_value=["clone"]), \
         patch("shutil.which", return_value="/usr/bin/git"), \
         patch("subprocess.run") as mock_run:
        
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "cloned successfully"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        res = execute_git(
            subcommand="clone",
            args=["https://github.com/user/repo", "workspace/target_dir"],
            working_directory=".",
            chat_id="chat_inside"
        )
        assert "The 'workspace/' directory is reserved" not in res

def test_git_executor_clone_subdirectory_forcing():
    from backend.tools.implementations.git_executor import _extract_repo_name
    assert _extract_repo_name("https://github.com/org/my-repo.git") == "my-repo"
    assert _extract_repo_name("git@github.com:org/another-repo.git") == "another-repo"
    assert _extract_repo_name("https://github.com/org/repo-without-git") == "repo-without-git"

    # 1. Test clone with args=url only and working_directory="/"
    with patch("backend.file_system.utils.get_workspace_for_chat", return_value="ws_id"), \
         patch("backend.tools.implementations.git_executor._get_allowed_commands", return_value=["clone"]), \
         patch("shutil.which", return_value="/usr/bin/git"), \
         patch("subprocess.run") as mock_run:
        
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "cloned successfully"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        res = execute_git(
            subcommand="clone",
            args=["https://github.com/org/my-repo.git"],
            working_directory="/",
            chat_id="chat_inside",
            workspace_id="ws_id"
        )
        # Verify that git clone cmd was constructed with repo name as second arg
        called_cmd = mock_run.call_args[0][0]
        assert called_cmd[-1] == "my-repo"

    # 2. Test clone with args=[url, "."] and working_directory="/"
    with patch("backend.file_system.utils.get_workspace_for_chat", return_value="ws_id"), \
         patch("backend.tools.implementations.git_executor._get_allowed_commands", return_value=["clone"]), \
         patch("shutil.which", return_value="/usr/bin/git"), \
         patch("subprocess.run") as mock_run:
        
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "cloned successfully"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        res = execute_git(
            subcommand="clone",
            args=["https://github.com/org/my-repo.git", "."],
            working_directory="/",
            chat_id="chat_inside",
            workspace_id="ws_id"
        )
        called_cmd = mock_run.call_args[0][0]
        assert called_cmd[-1] == "my-repo"

def test_execute_git_all_supported_subcommands():
    from backend.config import GIT_ALL_KNOWN_COMMANDS
    
    with patch("shutil.which", return_value="/usr/bin/git"), \
         patch("subprocess.run") as mock_run, \
         patch("backend.tools.implementations.git_executor._get_allowed_commands", return_value=GIT_ALL_KNOWN_COMMANDS):
        
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "command executed successfully"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        for cmd in GIT_ALL_KNOWN_COMMANDS:
            res = execute_git(subcommand=cmd, args=["arg1"], working_directory=".", chat_id="chat1")
            assert f"git {cmd} succeeded" in res

def test_execute_git_tree_modifying_subcommands_cache_invalidation():
    from backend.tools.implementations.git_executor import _TREE_MODIFYING_SUBCOMMANDS
    
    with patch("shutil.which", return_value="/usr/bin/git"), \
         patch("subprocess.run") as mock_run:
        
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "switched/reset successfully"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        for cmd in _TREE_MODIFYING_SUBCOMMANDS:
            with patch("backend.database.db.get_chat_file_systems", return_value=[{"id": f"fs_{cmd}", "filename": "repo/file"}]), \
                 patch("backend.database.db.delete_file_system") as mock_delete, \
                 patch("backend.tools.implementations.git_executor._get_allowed_commands", return_value=[cmd]):
                
                res = execute_git(subcommand=cmd, args=[], working_directory="repo/", chat_id="chat1")
                assert f"git {cmd} succeeded" in res
                mock_delete.assert_called_once_with(f"fs_{cmd}", chat_id="chat1", workspace_id=None)

def test_execute_git_dynamic_settings_persistence():
    with patch("backend.database.db.get_setting") as mock_get_setting, \
         patch("shutil.which", return_value="/usr/bin/git"), \
         patch("subprocess.run") as mock_run:
        
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "git diff output"
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        # 1. Diff is not in custom list -> blocked
        mock_get_setting.return_value = ["status", "clone"]
        res = execute_git(subcommand="diff", args=[], working_directory=".", chat_id="c1")
        assert "is not in the allowed list" in res
        
        # 2. Diff added to custom list -> allowed
        mock_get_setting.return_value = ["status", "clone", "diff"]
        res_allowed = execute_git(subcommand="diff", args=[], working_directory=".", chat_id="c1")
        assert "git diff succeeded" in res_allowed

def test_execute_git_real_binary_integration(tmp_path):
    import shutil
    import subprocess
    git_binary = shutil.which("git")
    if not git_binary:
        pytest.skip("Git binary not found on PATH, skipping integration test.")

    repo_dir = tmp_path / "my-test-repo"
    repo_dir.mkdir()
    
    env = os.environ.copy()
    env.pop("GIT_DIR", None)
    env.pop("GIT_WORK_TREE", None)
    env["GIT_AUTHOR_NAME"] = "Test Author"
    env["GIT_AUTHOR_EMAIL"] = "test@example.com"
    env["GIT_COMMITTER_NAME"] = "Test Committer"
    env["GIT_COMMITTER_EMAIL"] = "test@example.com"

    try:
        # Run real git init
        subprocess.run([git_binary, "init"], cwd=repo_dir, env=env, capture_output=True, text=True, check=True)
        dummy_file = repo_dir / "README.md"
        dummy_file.write_text("Hello Git Integration Test")
        
        # Run real git add
        subprocess.run([git_binary, "add", "README.md"], cwd=repo_dir, env=env, capture_output=True, text=True, check=True)
        # Run real git commit
        subprocess.run([git_binary, "commit", "-m", "initial commit"], cwd=repo_dir, env=env, capture_output=True, text=True, check=True)
        
        # Execute execute_git on this real physical path via mock resolve
        with patch("backend.tools.implementations.git_executor.resolve_owner_and_physical_path", return_value=("chat1", None, str(repo_dir))), \
             patch("backend.tools.implementations.git_executor.FILE_SYSTEMS_DIR", str(tmp_path)), \
             patch("backend.tools.implementations.git_executor._get_allowed_commands", return_value=["status", "log"]):
            
            res_status = execute_git(subcommand="status", args=[], working_directory=".", chat_id="chat1")
            assert "git status succeeded" in res_status
            assert "On branch" in res_status or "HEAD" in res_status
            
            res_log = execute_git(subcommand="log", args=["--oneline"], working_directory=".", chat_id="chat1")
            assert "git log succeeded" in res_log
            assert "initial commit" in res_log
    except subprocess.CalledProcessError as e:
        pytest.skip(f"Live git command failed: {e.stderr}")
