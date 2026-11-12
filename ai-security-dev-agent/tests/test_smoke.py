from __future__ import annotations

import os
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
        import dsh.app as module
        with self.assertRaises(ValueError):
            module.safe_path("../../etc/passwd")

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
        model = ScanResult(target=".", findings=[], summary={"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}, errors=[])
        with self.assertRaises(Exception):
            model.model_copy(update={"unexpected": True})


if __name__ == "__main__":
    unittest.main()
