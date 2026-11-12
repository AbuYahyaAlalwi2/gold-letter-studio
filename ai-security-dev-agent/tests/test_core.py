import tempfile
import unittest
from pathlib import Path

from dsh.app import safe_path
from memory.mem0_plugin import ProjectMemory
from security.semgrep_wrapper import ScanResult
from tools.code_intelligence.line_diff_editor import smart_line_diff_edit
from tools.code_intelligence.grep_tool import grep_code

class AgentScaffoldTests(unittest.TestCase):
    def test_workspace_path_rejects_escape(self):
        import os
        old = os.environ.get("PROJECT_ROOT")
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["PROJECT_ROOT"] = tmp
            # safe_path uses module-level ROOT; use a child path traversal check against actual workspace instead.
        from dsh import app as module
        try:
            with self.assertRaises(ValueError):
                module.safe_path("../../etc/passwd")
        finally:
            if old is not None:
                os.environ["PROJECT_ROOT"] = old

    def test_edit_requires_unique_exact_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "test.txt"
            file.write_text("hello\n")
            result = smart_line_diff_edit(str(file), "hello", "world", True)
            self.assertTrue(result["dry_run"])
            self.assertEqual(file.read_text(), "hello\n")
            with self.assertRaises(ValueError):
                smart_line_diff_edit(str(file), "missing", "world")

    def test_grep(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "a.py").write_text("needle\n")
            self.assertEqual(len(grep_code(tmp, "needle")), 1)

    def test_memory_persists(self):
        with tempfile.TemporaryDirectory() as tmp:
            memory = ProjectMemory(str(Path(tmp) / "db.sqlite"))
            memory.remember("demo", "finding")
            self.assertEqual(memory.recall("demo")[0]["fact"], "finding")

    def test_strict_scan_schema(self):
        result = ScanResult(target=".", findings=[], summary={"total": 0}, errors=[])
        with self.assertRaises(Exception):
            result.model_copy(update={"unexpected": True})

if __name__ == "__main__":
    unittest.main()
