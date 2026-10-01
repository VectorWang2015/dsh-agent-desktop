"""Pure unit checks for PID reuse handling; no real process is signalled."""
import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('worker_under_test', Path(__file__).parents[1] / 'runtime/desktop_worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class CleanupTests(unittest.TestCase):
    def test_unrelated_reused_pid_is_not_signalled(self):
        with patch.object(worker, 'child_ids', return_value=['123']), patch.object(os, 'pidfd_open', return_value=42), patch.object(worker.Path, 'read_text', return_value='123 (unrelated) S 999 0 0'), patch.object(worker.signal, 'pidfd_send_signal') as send, patch.object(os, 'close'):
            worker.signal_owned(worker.signal.SIGTERM)
            send.assert_not_called()

    def test_owned_child_uses_pinned_pidfd_not_pid_kill(self):
        with patch.object(worker, 'child_ids', return_value=['123']), patch.object(os, 'pidfd_open', return_value=42), patch.object(worker.Path, 'read_text', return_value=f'123 (child) S {os.getpid()} 0 0'), patch.object(worker.signal, 'pidfd_send_signal') as send, patch.object(os, 'close') as close, patch.object(os, 'kill') as unsafe:
            worker.signal_owned(worker.signal.SIGTERM)
            send.assert_called_once_with(42, worker.signal.SIGTERM)
            close.assert_called_once_with(42)
            unsafe.assert_not_called()

    def test_already_exited_child_is_ignored(self):
        with patch.object(worker, 'child_ids', return_value=['123']), patch.object(os, 'pidfd_open', side_effect=ProcessLookupError), patch.object(worker.signal, 'pidfd_send_signal') as send:
            worker.signal_owned(worker.signal.SIGTERM)
            send.assert_not_called()


if __name__ == '__main__':
    unittest.main()
