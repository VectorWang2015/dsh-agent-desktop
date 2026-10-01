"""No GUI required: validate the public demo's files and refusal boundaries."""
import csv
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

DEMO = Path(__file__).resolve().parents[1] / 'examples' / 'desktop-demo.py'
MARKER = 'DSH_DESKTOP_OK 中文✓'


class DemoTests(unittest.TestCase):
    def run_demo(self, output, text):
        return subprocess.run([sys.executable, str(DEMO), '--output', str(output)], input=text, text=True, encoding='utf-8', capture_output=True, timeout=5)

    def test_valid_input_creates_only_synthetic_artifacts(self):
        with tempfile.TemporaryDirectory() as base:
            output = Path(base) / 'new-run'
            run = self.run_demo(output, MARKER + '\n')
            self.assertEqual(run.returncode, 0, run.stderr)
            result = json.loads((output / 'result.json').read_text())
            self.assertEqual(result['marker'], MARKER)
            self.assertEqual(result['total'], 10)
            self.assertEqual(result['row_count'], 3)
            self.assertEqual(result['python_executable'], str(Path(sys.executable).resolve()))
            with (output / 'samples.csv').open() as stream:
                self.assertEqual(len(list(csv.DictReader(stream))), 3)
            self.assertIn('PASS', run.stdout)

    def test_incorrect_input_writes_nothing(self):
        with tempfile.TemporaryDirectory() as base:
            output = Path(base) / 'new-run'
            self.assertEqual(self.run_demo(output, 'wrong\n').returncode, 2)
            self.assertFalse(output.exists())

    def test_existing_output_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as base:
            output = Path(base)
            sentinel = output / 'keep.txt'
            sentinel.write_text('original')
            self.assertEqual(self.run_demo(output, MARKER + '\n').returncode, 2)
            self.assertEqual(sentinel.read_text(), 'original')
            self.assertFalse((output / 'result.json').exists())


if __name__ == '__main__':
    unittest.main()
