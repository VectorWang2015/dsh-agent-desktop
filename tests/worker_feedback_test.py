"""Worker feedback contract checks using only in-process X11/capture/process mocks.

Run with .runtime/venv/bin/python -B tests/worker_feedback_test.py.
No display, browser, subprocess, input device or installed DSH is touched.
"""
import importlib.util
import queue
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from PIL import Image
from Xlib import X, XK, Xutil
from Xlib.ext import xtest

spec = importlib.util.spec_from_file_location('feedback_worker', Path(__file__).parents[1] / 'runtime/desktop_worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class Clock:
    def __init__(self):
        self.now = 1000.0

    def monotonic(self):
        return self.now

    def time(self):
        return 1700000000.0 + self.now

    def sleep(self, seconds):
        self.now += seconds


class Window:
    def __init__(self, display, window_id, title='client', pid=None, parent=None):
        self.display = display
        self.id = window_id
        self.title = title
        self.pid = pid
        self.parent = parent
        self.width, self.height = 200, 100
        self.x, self.y = 30, 40
        self.mapped = X.IsViewable
        self.protocols = []
        self.hints = None
        self.transient = None
        self.properties = {}
        self.sent = []
        self.on_send = None
        self.send_event = Mock(side_effect=self._send)
        self.query_pointer = Mock(side_effect=lambda: SimpleNamespace(root_x=display.pointer[0], root_y=display.pointer[1]))
        self.set_input_focus = Mock(side_effect=AssertionError('forced window focus'))
        self.kill_client = Mock(side_effect=AssertionError('forced client close'))
        self.destroy = Mock(side_effect=AssertionError('forced window destroy'))

    def get_full_property(self, atom, _kind):
        name = self.display.atom_names[atom]
        if name in self.properties:
            value = self.properties[name]
        elif name == '_NET_WM_NAME':
            value = self.title.encode('utf-8')
        elif name == '_NET_WM_PID' and self.pid is not None:
            value = [self.pid]
        else:
            return None
        return SimpleNamespace(value=value)

    def get_attributes(self):
        return SimpleNamespace(map_state=self.mapped)

    def get_geometry(self):
        return SimpleNamespace(width=self.width, height=self.height)

    def translate_coords(self, source, x, y):
        if self is not self.display.root:
            raise AssertionError('geometry must translate client origin into root coordinates')
        return SimpleNamespace(x=source.x + x, y=source.y + y)

    def get_wm_name(self):
        return self.title

    def get_wm_protocols(self):
        return list(self.protocols)

    def get_wm_hints(self):
        return self.hints

    def get_wm_transient_for(self):
        return self.transient

    def query_tree(self):
        return SimpleNamespace(parent=self.parent)

    def _send(self, message, **kwargs):
        self.sent.append((message, kwargs))
        if self.on_send:
            self.on_send(message)


class Display:
    def __init__(self):
        self.atoms, self.atom_names = {}, {}
        self.display = SimpleNamespace(info=SimpleNamespace(min_keycode=8, max_keycode=255))
        self.mapping = {code: (0, 0) for code in range(8, 256)}
        for code, values in {
            10: ('1', '!'), 23: ('Tab',), 24: ('q', 'Q'), 36: ('Return',),
            37: ('Control_L',), 38: ('a', 'A'), 39: ('s', 'S'), 50: ('Shift_L',),
            64: ('Alt_L',), 65: ('space',), 133: ('Super_L',),
        }.items():
            self.mapping[code] = tuple(XK.string_to_keysym(value) for value in values)
        self.repeat = [255] * 32
        self.repeat_changes = []
        self.server_keys, self.server_buttons = set(), set()
        self.events, self.map_changes = [], []
        self.fail_press, self.fail_release = set(), set()
        self.on_input = None
        self.pointer = (20, 30)
        self.focused = 0
        self.root = Window(self, 100, title='root')
        self.root.width, self.root.height = 640, 480
        self.root.properties.update({'_NET_CLIENT_LIST': [], '_NET_ACTIVE_WINDOW': [0]})
        self.windows = {100: self.root}
        self.sync = Mock()
        self.close = Mock()
        self.grab_server = Mock()
        self.ungrab_server = Mock()
        self.set_input_focus = Mock(side_effect=AssertionError('forced display focus'))
        self.ungrab_keyboard = Mock(side_effect=AssertionError('forced keyboard ungrab'))
        self.ungrab_pointer = Mock(side_effect=AssertionError('forced pointer ungrab'))
        self.kill_client = Mock(side_effect=AssertionError('forced client kill'))
        self.keysym_to_keycode = Mock(side_effect=AssertionError('stale keymap cache'))

    def screen(self):
        return SimpleNamespace(root=self.root)

    def intern_atom(self, name):
        if name not in self.atoms:
            atom = len(self.atoms) + 1000
            self.atoms[name], self.atom_names[atom] = atom, name
        return self.atoms[name]

    def create_resource_object(self, kind, window_id):
        if kind != 'window' or window_id not in self.windows:
            raise RuntimeError('BadWindow')
        return self.windows[window_id]

    def add_window(self, window_id, **kwargs):
        window = Window(self, window_id, parent=self.root, **kwargs)
        self.windows[window_id] = window
        self.root.properties['_NET_CLIENT_LIST'].append(window_id)
        return window

    def get_input_focus(self):
        return SimpleNamespace(focus=self.windows.get(self.focused, self.focused))

    def get_keyboard_mapping(self, minimum, count):
        return [self.mapping[code] for code in range(minimum, minimum + count)]

    def change_keyboard_mapping(self, first, rows):
        for index, row in enumerate(rows):
            self.mapping[first + index] = row
            self.map_changes.append((first + index, row))

    def get_keyboard_control(self):
        return SimpleNamespace(auto_repeats=list(self.repeat), global_auto_repeat=X.AutoRepeatModeOn)

    def change_keyboard_control(self, **kwargs):
        if set(kwargs) != {'key', 'auto_repeat_mode'}:
            raise AssertionError('must change only a specific key repeat bit')
        code, mode = kwargs['key'], kwargs['auto_repeat_mode']
        self.repeat_changes.append((code, mode))
        if mode == X.AutoRepeatModeOn:
            self.repeat[code // 8] |= 1 << (code % 8)
        else:
            self.repeat[code // 8] &= ~(1 << (code % 8))

    def query_keymap(self):
        bits = [0] * 32
        for code in self.server_keys:
            bits[code // 8] |= 1 << (code % 8)
        return bits

    def fake_input(self, display, kind, code=0, **kwargs):
        if display is not self:
            raise AssertionError('input routed to another display')
        self.events.append((kind, code, kwargs))
        if kind == X.KeyPress:
            self.server_keys.add(code)
            if code in self.fail_press:
                raise OSError('partial key press failure')
        elif kind == X.KeyRelease:
            if code in self.fail_release:
                raise OSError('key release failure')
            self.server_keys.discard(code)
        elif kind == X.ButtonPress:
            self.server_buttons.add(code)
        elif kind == X.ButtonRelease:
            self.server_buttons.discard(code)
        elif kind == X.MotionNotify:
            self.pointer = (kwargs['x'], kwargs['y'])
        if self.on_input:
            self.on_input(kind, code)


class Capture:
    def __init__(self):
        self.image = Image.new('RGB', (640, 480), (12, 34, 56))
        self.grab = Mock(side_effect=self._grab)
        self.close = Mock()

    @property
    def monitors(self):
        raise AssertionError('must not trust cached monitor dimensions')

    def _grab(self, region):
        image = self.image.crop((region['left'], region['top'], region['left'] + region['width'], region['top'] + region['height']))
        return SimpleNamespace(size=image.size, rgb=image.tobytes())


class Process:
    def __init__(self, pid, returncode=None):
        self.pid, self.returncode = pid, returncode
        self.poll = Mock(side_effect=lambda: self.returncode)
        self.kill = Mock(side_effect=AssertionError('application kill'))
        self.terminate = Mock(side_effect=AssertionError('application terminate'))


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.display, self.capture, self.clock = Display(), Capture(), Clock()
        self.temporary = tempfile.TemporaryDirectory(prefix='worker-feedback-mock-')
        self.addCleanup(self.temporary.cleanup)
        worker.xdisplay, worker.capture = self.display, self.capture
        worker.runtime = Path(self.temporary.name)
        worker.config = {'width': 1280, 'height': 800, 'agentKeyHoldMs': 1500}
        worker.gui_env = {'DISPLAY': ':owned', 'XAUTHORITY': '/owned/Xauthority', 'DBUS_SESSION_BUS_ADDRESS': 'unix:path=/owned/bus'}
        worker.held_keys, worker.held_buttons, worker.saved_repeat = {}, {}, {}
        worker.last_auto_release_at = None
        worker.applications = []
        worker.cleaned = False
        worker.cancelled.clear()
        worker.ended.clear()
        for target, name, replacement in (
            (xtest, 'fake_input', self.display.fake_input),
            (worker.time, 'monotonic', self.clock.monotonic),
            (worker.time, 'time', self.clock.time),
            (worker.time, 'sleep', self.clock.sleep),
        ):
            context = patch.object(target, name, replacement)
            context.start()
            self.addCleanup(context.stop)

    def key_events(self):
        return [(kind, code) for kind, code, _ in self.display.events if kind in (X.KeyPress, X.KeyRelease)]

    def input(self, action, actor='agent', identifier=1):
        return worker.input_action(action, identifier, actor)

    def raw(self, key, down=True, actor='agent', identifier=1):
        return self.input({'type': 'key', 'key': key, 'down': down}, actor, identifier)

    def assert_no_force(self):
        for method in (self.display.set_input_focus, self.display.ungrab_keyboard, self.display.ungrab_pointer, self.display.kill_client):
            method.assert_not_called()
        for window in self.display.windows.values():
            window.set_input_focus.assert_not_called()
            window.kill_client.assert_not_called()
            window.destroy.assert_not_called()


class InputTests(WorkerTests):
    def test_atomic_return_and_missing_down_are_paired(self):
        for action in ({'type': 'press', 'key': 'Enter'}, {'type': 'key', 'key': 'Return'}):
            self.display.events.clear()
            self.assertTrue(self.input(action)['delivered'])
            self.assertEqual(self.key_events(), [(X.KeyPress, 36), (X.KeyRelease, 36)])
            self.assertFalse(worker.held_keys)
        self.assertFalse(self.display.repeat_changes)

    def test_shortcut_modifiers_release_in_reverse_order(self):
        self.input({'type': 'press', 'key': 's', 'modifiers': ['Control', 'Alt']})
        self.assertEqual(self.key_events(), [(X.KeyPress, 37), (X.KeyPress, 64), (X.KeyPress, 39), (X.KeyRelease, 39), (X.KeyRelease, 64), (X.KeyRelease, 37)])
        self.assertFalse(self.display.server_keys)

    def test_shortcut_finally_releases_a_partially_failed_main_key(self):
        self.display.fail_press.add(39)
        with self.assertRaisesRegex(OSError, 'partial key press'):
            self.input({'type': 'press', 'key': 's', 'modifiers': ['Control']})
        self.assertEqual(self.key_events(), [(X.KeyPress, 37), (X.KeyPress, 39), (X.KeyRelease, 39), (X.KeyRelease, 37)])
        self.assertFalse(worker.held_keys)
        self.assertFalse(self.display.server_keys)

    def test_shortcut_cancellation_releases_pressed_modifiers(self):
        self.display.on_input = lambda kind, code: worker.cancelled.add(7) if kind == X.KeyPress and code == 37 else None
        with self.assertRaises(InterruptedError):
            self.input({'type': 'press', 'key': 's', 'modifiers': ['Control']}, identifier=7)
        self.assertEqual(self.key_events(), [(X.KeyPress, 37), (X.KeyRelease, 37)])

    def test_press_preserves_preexisting_modifier(self):
        self.raw('Control', actor='human')
        self.input({'type': 'press', 'key': 's', 'modifiers': ['Control']})
        self.assertEqual(self.key_events(), [(X.KeyPress, 37), (X.KeyPress, 39), (X.KeyRelease, 39)])
        self.assertEqual(worker.held_keys[37]['actor'], 'human')
        self.assertFalse(self.display.repeat_changes)

    def test_shifted_symbol_is_typed_with_paired_shift(self):
        self.input({'type': 'press', 'key': 'A'})
        self.assertEqual(self.key_events(), [(X.KeyPress, 50), (X.KeyPress, 38), (X.KeyRelease, 38), (X.KeyRelease, 50)])

    def test_unknown_keys_do_not_match_nosymbol_spares(self):
        with self.assertRaisesRegex(ValueError, 'no mapping'):
            self.input({'type': 'press', 'key': 'not-a-real-keysym', 'modifiers': ['Control']})
        self.assertFalse(self.display.events)
        self.display.keysym_to_keycode.assert_not_called()

    def test_atomic_press_does_not_release_an_external_pressed_key(self):
        self.display.server_keys.add(36)
        with self.assertRaisesRegex(ValueError, 'already held'):
            self.input({'type': 'press', 'key': 'Enter'})
        self.assertFalse(self.display.events)
        self.assertIn(36, self.display.server_keys)

    def test_raw_agent_disables_and_restores_exact_repeat_bit(self):
        before = list(self.display.repeat)
        self.raw('Enter')
        self.assertFalse(worker.key_bit(self.display.repeat, 36))
        self.assertEqual(worker.saved_repeat, {36: True})
        self.raw('Enter', False)
        self.assertEqual(self.display.repeat, before)
        self.assertEqual(self.display.repeat_changes, [(36, X.AutoRepeatModeOff), (36, X.AutoRepeatModeOn)])
        self.assertFalse(worker.held_keys)
        self.assertFalse(worker.saved_repeat)

    def test_previously_disabled_repeat_stays_disabled(self):
        self.display.repeat[36 // 8] &= ~(1 << (36 % 8))
        self.raw('Enter')
        worker.release()
        self.assertEqual(self.display.repeat_changes, [(36, X.AutoRepeatModeOff), (36, X.AutoRepeatModeOff)])

    def test_repeat_suppression_failure_still_restores_and_releases(self):
        original = self.display.change_keyboard_control

        def fail_after_disable(**kwargs):
            original(**kwargs)
            if len(self.display.repeat_changes) == 1:
                raise OSError('repeat change failed')

        with patch.object(self.display, 'change_keyboard_control', side_effect=fail_after_disable):
            with self.assertRaisesRegex(OSError, 'repeat change failed'):
                self.raw('Enter')
        self.assertTrue(worker.key_bit(self.display.repeat, 36))
        self.assertFalse(worker.saved_repeat)
        self.assertFalse(worker.held_keys)

    def test_agent_duplicate_down_neither_repeats_nor_renews_expiry(self):
        self.raw('Enter', identifier=5)
        deadline = worker.held_keys[36]['expiresAt']
        self.clock.now += 1
        self.raw('Enter', identifier=6)
        self.assertEqual(worker.held_keys[36]['expiresAt'], deadline)
        self.assertEqual(self.key_events(), [(X.KeyPress, 36)])
        self.clock.now = deadline
        worker.expire_held_input()
        self.assertEqual(self.key_events()[-1], (X.KeyRelease, 36))
        self.assertFalse(worker.saved_repeat)
        self.assertTrue(worker.last_auto_release_at.endswith('Z'))

    def test_human_repeat_and_hold_are_unchanged(self):
        self.raw('a', actor='human')
        self.raw('a', actor='human')
        self.clock.now += 100
        worker.expire_held_input()
        self.assertIn(38, worker.held_keys)
        self.assertIsNone(worker.held_keys[38]['expiresAt'])
        self.assertFalse(self.display.repeat_changes)
        self.raw('a', False, actor='human')
        self.assertEqual(self.key_events(), [(X.KeyPress, 38), (X.KeyPress, 38), (X.KeyRelease, 38)])

    def test_human_takeover_restores_repeat_without_agent_expiry(self):
        self.raw('a')
        self.raw('a', actor='human')
        self.assertTrue(worker.key_bit(self.display.repeat, 38))
        self.clock.now += 10
        worker.expire_held_input()
        self.assertIn(38, worker.held_keys)
        self.assertEqual(worker.held_keys[38]['actor'], 'human')
        self.assertFalse(worker.saved_repeat)

    def test_key_up_uses_original_code_after_mapping_changes(self):
        self.raw('Enter')
        self.display.mapping[36] = (0, 0)
        self.display.mapping[82] = (XK.string_to_keysym('Return'),)
        self.raw('Return', False)
        self.assertEqual(self.key_events(), [(X.KeyPress, 36), (X.KeyRelease, 36)])
        self.assertFalse(worker.saved_repeat)

    def test_release_failure_does_not_skip_other_keys_or_repeat_restoration(self):
        self.raw('Control')
        self.raw('Enter')
        self.display.fail_release.add(36)
        with self.assertRaisesRegex(OSError, 'release failure'):
            worker.release()
        self.assertNotIn(37, worker.held_keys)
        self.assertIn(36, worker.held_keys)
        self.assertFalse(worker.saved_repeat)
        self.assertTrue(worker.key_bit(self.display.repeat, 37))
        self.assertTrue(worker.key_bit(self.display.repeat, 36))
        self.display.fail_release.clear()
        worker.release()
        self.assertFalse(worker.held_keys)

    def test_failed_repeat_restore_is_retained_for_the_next_release(self):
        self.raw('Enter')
        with patch.object(self.display, 'change_keyboard_control', side_effect=OSError('restore failed')):
            with self.assertRaisesRegex(OSError, 'restore failed'):
                worker.release()
        self.assertFalse(worker.held_keys)
        self.assertEqual(worker.saved_repeat, {36: True})
        worker.release()
        self.assertFalse(worker.saved_repeat)
        self.assertTrue(worker.key_bit(self.display.repeat, 36))

    def test_cleanup_restores_repeat_before_closing_the_private_display(self):
        self.raw('Enter')

        def closing():
            self.assertFalse(worker.held_keys)
            self.assertFalse(worker.saved_repeat)
            self.assertTrue(worker.key_bit(self.display.repeat, 36))

        self.display.close.side_effect = closing
        with patch.object(worker, 'reap'), patch.object(worker, 'child_ids', return_value=[]), patch.object(worker, 'signal_owned') as signal_owned:
            worker.cleanup()
        self.display.close.assert_called_once()
        self.capture.close.assert_called_once()
        signal_owned.assert_not_called()
        self.assertIsNone(worker.xdisplay)
        self.assertIsNone(worker.capture)
        self.assert_no_force()

    def test_stale_agent_key_up_does_not_release_human_hold(self):
        self.raw('Enter', actor='human')
        self.raw('Enter', False, actor='agent')
        self.assertEqual(self.key_events(), [(X.KeyPress, 36)])
        self.assertIn(36, worker.held_keys)
        self.assertFalse(self.display.repeat_changes)

    def test_cancel_of_returned_raw_action_restores_repeat(self):
        self.raw('Enter', identifier=8)
        worker.cancelled.add(8)
        worker.expire_held_input()
        self.assertFalse(worker.held_keys)
        self.assertFalse(worker.saved_repeat)
        self.assertTrue(worker.key_bit(self.display.repeat, 36))

    def test_idle_loop_expires_agent_without_another_input(self):
        worker.config['agentKeyHoldMs'] = 100
        self.raw('Enter')
        fake_requests = Mock()
        fake_requests.empty.return_value = False
        calls = []

        def get_request(timeout):
            calls.append(timeout)
            if len(calls) == 1:
                self.clock.now += timeout + 0.001
                raise queue.Empty()
            return {'id': 90, 'op': 'stop'}

        fake_requests.get.side_effect = get_request
        with patch.object(worker, 'requests', fake_requests), patch.object(worker.threading, 'Thread'), patch.object(worker.signal, 'signal'), patch.object(worker.ctypes, 'CDLL', return_value=SimpleNamespace(prctl=lambda *_: 0)), patch.object(worker, 'cleanup') as cleanup, patch.object(worker, 'answer'):
            worker.main()
        self.assertAlmostEqual(calls[0], 0.1)
        self.assertFalse(worker.held_keys)
        self.assertTrue(worker.key_bit(self.display.repeat, 36))
        self.assertGreaterEqual(cleanup.call_count, 1)

    def test_expiry_keeps_human_keys_and_reports_held_input(self):
        self.raw('Control', actor='human')
        self.raw('Enter')
        self.input({'type': 'button', 'button': 'left', 'down': True})
        self.clock.now += 1.5
        info = worker.inspect_desktop()['input']
        self.assertEqual(info['heldKeys'], ['Control'])
        self.assertEqual(info['heldButtons'], ['left'])
        self.assertIn('lastAutoReleaseAt', info)

    def test_release_action_releases_only_worker_inputs(self):
        self.display.server_keys.add(24)
        self.raw('Enter')
        self.input({'type': 'button', 'button': 'left', 'down': True})
        self.input({'type': 'release'})
        self.assertEqual(self.display.server_keys, {24})
        self.assertFalse(self.display.server_buttons)
        self.assertFalse(worker.saved_repeat)
        self.assert_no_force()

    def test_text_keeps_unicode_slots_and_never_maps_a_pressed_spare(self):
        self.display.server_keys.add(8)  # Blank mapping, but logically pressed by another client.
        self.input({'type': 'text', 'text': '你'})
        first = list(self.display.map_changes)
        self.assertEqual(first[0][0], 9)
        self.input({'type': 'text', 'text': '你好'})
        self.assertEqual(self.display.map_changes[0], first[0])
        self.assertEqual(len(self.display.map_changes), 2)
        self.assertEqual(self.display.map_changes[1][0], 11)  # 10 already maps '1'.
        self.assertEqual(self.display.server_keys, {8})
        self.assertFalse(worker.held_keys)
        self.assertEqual(self.display.grab_server.call_count, self.display.ungrab_server.call_count)

    def test_text_failure_releases_shift_and_server_grab(self):
        self.display.fail_press.add(38)
        with self.assertRaises(OSError):
            self.input({'type': 'text', 'text': 'A'})
        self.assertFalse(self.display.server_keys)
        self.assertFalse(worker.held_keys)
        self.display.ungrab_server.assert_called_once()

    def test_input_validates_actual_root_geometry_before_motion(self):
        with self.assertRaises(ValueError):
            self.input({'type': 'move', 'x': 700, 'y': 100})
        self.assertFalse(self.display.events)
        self.input({'type': 'move', 'x': 639, 'y': 479})
        self.assertEqual(self.display.pointer, (639, 479))


class InspectionTests(WorkerTests):
    def test_launch_tracks_exact_process_and_preserves_owned_routing(self):
        process = Process(321)
        with patch.object(worker, 'spawn', return_value=process) as spawn:
            launched = worker.launch({'command': '/bin/wrapper', 'args': ['arg'], 'env': {'DISPLAY': ':other', 'DBUS_SESSION_BUS_ADDRESS': 'other', 'WAYLAND_DISPLAY': 'wayland-0'}})
        self.assertEqual(spawn.call_args.args[1]['DISPLAY'], ':owned')
        self.assertEqual(spawn.call_args.args[1]['DBUS_SESSION_BUS_ADDRESS'], worker.gui_env['DBUS_SESSION_BUS_ADDRESS'])
        self.assertNotIn('WAYLAND_DISPLAY', spawn.call_args.args[1])
        initial = worker.inspect_desktop()['applications'][0]
        self.assertEqual(initial['id'], launched['id'])
        self.assertTrue(initial['running'])
        self.assertEqual(initial['windowIds'], [])  # No window-count AND condition.
        process.returncode = 7
        self.display.add_window(201, title='surviving child GUI', pid=322)
        info = worker.inspect_desktop()
        self.assertFalse(info['applications'][0]['running'])
        self.assertEqual(info['applications'][0]['exitCode'], 7)
        self.assertEqual(info['applications'][0]['windowIds'], [])
        self.assertEqual(info['windows'][0]['id'], 201)
        # A same-PID advertised window is not evidence that the launcher revived.
        self.display.windows[201].pid = 321
        final = worker.inspect_desktop()['applications'][0]
        self.assertFalse(final['running'])
        self.assertEqual(final['windowIds'], [201])
        process.kill.assert_not_called()
        process.terminate.assert_not_called()

    def test_only_32_recent_exited_records_are_kept_with_all_live_launchers(self):
        worker.track_application('live', '/live', Process(400))
        for index in range(40):
            self.clock.now += 0.001
            worker.track_application(str(index), '/exited', Process(500 + index, index))
        applications = worker.inspect_desktop()['applications']
        self.assertEqual([record['id'] for record in applications], ['live', *map(str, range(8, 40))])
        self.assertEqual(len(worker.applications), 33)

    def test_recent_exit_retention_breaks_observation_time_ties_by_recency(self):
        for index in range(40):
            worker.track_application(str(index), '/exited', Process(500 + index, 0))
        self.assertEqual([record['id'] for record in worker.applications], list(map(str, range(8, 40))))

    def test_window_metadata_includes_raw_child_focus_and_icccm_hints(self):
        parent = self.display.add_window(201, title='文档', pid=123)
        modal = self.display.add_window(202, title='save?', pid=123)
        modal.transient = parent
        modal.properties['_NET_WM_STATE'] = [self.display.intern_atom('_NET_WM_STATE_MODAL')]
        modal.protocols = [self.display.intern_atom('WM_TAKE_FOCUS'), self.display.intern_atom('WM_DELETE_WINDOW')]
        modal.hints = {'flags': Xutil.InputHint, 'input': 0}
        child = Window(self.display, 301, parent=modal)
        self.display.windows[301] = child
        self.display.focused = 301
        self.display.root.properties['_NET_ACTIVE_WINDOW'] = [202]
        info = worker.inspect_desktop()
        self.assertEqual(info['focusedWindowId'], 301)
        self.assertEqual(info['activeWindowId'], 202)
        actual = info['windows'][1]
        self.assertEqual(actual, {
            'id': 202, 'title': 'save?', 'pid': 123, 'mapped': True, 'focusable': True,
            'focused': True, 'active': True, 'modal': True, 'transientFor': 201,
            'supportsDelete': True, 'geometry': {'x': 30, 'y': 40, 'width': 200, 'height': 100},
        })
        self.assertFalse(info['windows'][0]['focused'])
        self.assertIsNone(info['windows'][0]['focusable'])
        self.capture.grab.assert_not_called()
        self.display.root.query_pointer.assert_not_called()
        self.assert_no_force()

    def test_focusable_is_only_hint_or_protocol_derived(self):
        window = self.display.add_window(201)
        for hints, expected in ((None, None), ({'flags': 0, 'input': 0}, None), ({'flags': Xutil.InputHint, 'input': 0}, False), ({'flags': Xutil.InputHint, 'input': 1}, True)):
            with self.subTest(hints=hints):
                window.hints = hints
                self.assertIs(worker.inspect_desktop()['windows'][0]['focusable'], expected)

    def test_managed_window_limit_races_and_ancestry_cycles_are_bounded(self):
        for index in range(65):
            self.display.add_window(200 + index)
        self.display.windows[200].parent = self.display.windows[200]
        self.display.focused = 200
        del self.display.windows[201]  # Disappears after appearing in the client list.
        info = worker.inspect_desktop()
        self.assertEqual(len(info['windows']), 63)
        self.assertTrue(info['windows'][0]['focused'])
        self.assertNotIn(264, [window['id'] for window in info['windows']])


class WindowRequestTests(WorkerTests):
    def test_focus_refusal_is_reported_without_force(self):
        target = self.display.add_window(201)
        other = self.display.add_window(202)
        self.display.focused = other.id
        start = self.clock.now
        result = worker.focus_window(target.id, 1)
        self.assertTrue(result['requested'])
        self.assertFalse(result['confirmed'])
        self.assertEqual(result['focusedWindowId'], other.id)
        self.assertIn('refuse or redirect', result['reason'])
        self.assertLessEqual(self.clock.now - start, 0.36)
        message, kwargs = self.display.root.sent[0]
        self.assertEqual(message.client_type, self.display.intern_atom('_NET_ACTIVE_WINDOW'))
        self.assertEqual(message.window, target.id)
        self.assertEqual(message.data[1][0], 1)  # ordinary application source, not pager
        self.assertEqual(kwargs['event_mask'], X.SubstructureRedirectMask | X.SubstructureNotifyMask)
        self.assert_no_force()

    def test_focus_confirms_descendant_input_focus_not_just_active_property(self):
        target = self.display.add_window(201)
        child = Window(self.display, 301, parent=target)
        self.display.windows[301] = child
        self.display.root.on_send = lambda _: setattr(self.display, 'focused', 301)
        result = worker.focus_window(target.id, 1)
        self.assertTrue(result['confirmed'])
        self.assertEqual(result['focusedWindowId'], 301)
        self.assert_no_force()

    def test_focus_wait_also_expires_agent_keys(self):
        worker.config['agentKeyHoldMs'] = 100
        self.raw('Enter')
        self.display.add_window(201)
        self.assertFalse(worker.focus_window(201, 2)['confirmed'])
        self.assertFalse(worker.held_keys)
        self.assertFalse(worker.saved_repeat)

    def test_focus_rejects_unmanaged_client_without_sending(self):
        result = worker.focus_window(999, 1)
        self.assertFalse(result['requested'])
        self.assertFalse(result['confirmed'])
        self.display.root.send_event.assert_not_called()
        self.assert_no_force()

    def test_close_unsupported_is_a_refusal_not_a_kill(self):
        window = self.display.add_window(201)
        result = worker.close_window(window.id)
        self.assertFalse(result['requested'])
        self.assertIn('WM_DELETE_WINDOW', result['reason'])
        window.send_event.assert_not_called()
        self.assert_no_force()

    def test_close_sends_only_wm_delete_and_does_not_claim_closure(self):
        window = self.display.add_window(201)
        delete = self.display.intern_atom('WM_DELETE_WINDOW')
        window.protocols = [delete]
        self.assertEqual(worker.close_window(window.id), {'requested': True, 'windowId': window.id})
        message, kwargs = window.sent[0]
        self.assertEqual(message.client_type, self.display.intern_atom('WM_PROTOCOLS'))
        self.assertEqual(list(message.data[1]), [delete, X.CurrentTime, 0, 0, 0])
        self.assertEqual(kwargs['event_mask'], 0)
        self.assertFalse(kwargs['propagate'])
        self.assertIn(window.id, worker.managed_window_ids())
        self.assert_no_force()

    def test_close_window_race_is_handled_without_force(self):
        window = self.display.add_window(201)
        window.protocols = [self.display.intern_atom('WM_DELETE_WINDOW')]
        window.send_event.side_effect = OSError('BadWindow')
        self.assertFalse(worker.close_window(201)['requested'])
        self.assert_no_force()


class CaptureTests(WorkerTests):
    def test_probe_is_fresh_raw_pixels_without_any_cursor_query(self):
        first = worker.probe([{'x': 21, 'y': 35}])
        second = worker.probe([{'x': 21, 'y': 35}])
        self.assertEqual(first['samples'], [{'x': 21, 'y': 35, 'rgba': [12, 34, 56, 255]}])
        self.assertFalse(first['cursorOverlay'])
        self.assertEqual(first['coordinateSpace'], 'desktop')
        self.assertTrue(first['capturedAt'].endswith('Z'))
        self.assertNotEqual(first['frameId'], second['frameId'])
        self.assertEqual(self.capture.grab.call_count, 2)
        self.display.root.query_pointer.assert_not_called()
        self.assertFalse((worker.runtime / 'frame.png').exists())

    def test_region_coordinates_and_cursor_overlay_are_in_desktop_space(self):
        region = {'x': 10, 'y': 20, 'width': 80, 'height': 60}
        frame = worker.frame({'region': region})
        self.assertEqual(frame['region'], region)
        self.assertEqual((frame['width'], frame['height']), (80, 60))
        with Image.open(worker.runtime / 'frame.png') as image:
            self.assertEqual(image.getpixel((11, 15)), (54, 200, 150))
        self.assertEqual(worker.probe([{'x': 21, 'y': 35}])['samples'][0]['rgba'], [12, 34, 56, 255])
        self.assertEqual((worker.runtime / 'frame.png').stat().st_mode & 0o777, 0o600)
        self.assertFalse((worker.runtime / 'frame.next.png').exists())
        self.assertIn('applications', frame)
        self.assertIn('input', frame)
        self.assertIsInstance(frame['timestamp'], float)

    def test_cursor_false_crops_raw_image_and_never_queries_pointer(self):
        self.capture.image.putpixel((10, 20), (7, 8, 9))
        first = worker.frame({'cursor': False, 'region': {'x': 10, 'y': 20, 'width': 40, 'height': 30}})
        with Image.open(worker.runtime / 'frame.png') as image:
            self.assertEqual(image.getpixel((0, 0)), (7, 8, 9))
            self.assertEqual(image.getpixel((11, 15)), (12, 34, 56))
        second = worker.frame({'cursor': False, 'region': first['region']})
        self.assertNotEqual(first['frameId'], second['frameId'])
        self.display.root.query_pointer.assert_not_called()

    def test_default_frame_is_full_current_root_and_has_cursor(self):
        self.display.root.width, self.display.root.height = 320, 240
        frame = worker.frame()
        self.assertEqual((frame['width'], frame['height']), (320, 240))
        self.assertEqual(frame['region'], {'x': 0, 'y': 0, 'width': 320, 'height': 240})
        self.capture.grab.assert_called_once_with({'left': 0, 'top': 0, 'width': 320, 'height': 240})
        self.display.root.query_pointer.assert_called_once()

    def test_region_validation_happens_before_capture(self):
        for region in (
            {'x': -1, 'y': 0, 'width': 10, 'height': 10},
            {'x': 0.5, 'y': 0, 'width': 10, 'height': 10},
            {'x': 0, 'y': 0, 'width': 0, 'height': 10},
            {'x': 630, 'y': 0, 'width': 20, 'height': 10},
            {'x': 0, 'y': 470, 'width': 10, 'height': 20},
        ):
            with self.subTest(region=region), self.assertRaises(ValueError):
                worker.frame({'region': region})
        self.capture.grab.assert_not_called()

    def test_probe_validates_all_points_and_limit_before_capture(self):
        for points in ([{'x': 0, 'y': 0}] * 33, [{'x': 640, 'y': 1}], [{'x': 1.5, 'y': 1}], [{'x': True, 'y': 1}]):
            with self.subTest(points=points), self.assertRaises(ValueError):
                worker.probe(points)
        self.capture.grab.assert_not_called()


class RuntimeLifecycleTests(WorkerTests):
    def test_raw_reader_handles_fragments_cancel_and_final_unterminated_line(self):
        incoming = queue.Queue()
        stdin = SimpleNamespace(fileno=lambda: 91, buffer=Mock())
        chunks = [b'{"id":1,"op":"ins', b'pect"}\n{"op":"cancel","id":1}\n', b'{"id":2,"op":"inspect"}', b'']
        with patch.object(worker, 'requests', incoming), patch.object(worker.sys, 'stdin', stdin), patch.object(worker.select, 'select', return_value=([91], [], [])), patch.object(worker.os, 'read', side_effect=chunks) as raw_read:
            worker.reader()
        self.assertEqual(incoming.get_nowait(), {'id': 1, 'op': 'inspect'})
        self.assertEqual(incoming.get_nowait(), {'id': 2, 'op': 'inspect'})
        self.assertIn(1, worker.cancelled)
        self.assertTrue(worker.ended.is_set())
        stdin.buffer.readline.assert_not_called()
        self.assertTrue(all(0 < call.args[1] <= 65536 for call in raw_read.call_args_list))

    def test_raw_reader_rejects_oversized_partial_line(self):
        incoming = queue.Queue()
        with patch.object(worker, 'REQUEST_LIMIT', 16), patch.object(worker, 'requests', incoming), patch.object(worker.sys, 'stdin', SimpleNamespace(fileno=lambda: 91)), patch.object(worker.select, 'select', return_value=([91], [], [])), patch.object(worker.os, 'read', return_value=b'x' * 17), patch.object(worker.os, 'write') as diagnostic:
            worker.reader()
        self.assertTrue(incoming.empty())
        self.assertTrue(worker.ended.is_set())
        self.assertIn(b'request exceeds limit', diagnostic.call_args.args[1])

    def test_full_request_queue_does_not_prevent_reader_shutdown(self):
        incoming = Mock()

        def full(*_args, **_kwargs):
            worker.ended.set()
            raise queue.Full()

        incoming.put.side_effect = full
        with patch.object(worker, 'requests', incoming):
            worker.queue_request(b'{"id":1,"op":"inspect"}')
        incoming.put.assert_called_once_with({'id': 1, 'op': 'inspect'}, timeout=0.1)

    def test_stop_sets_end_and_joins_raw_reader_before_cleanup_finishes(self):
        incoming = queue.Queue()
        incoming.put({'id': 1, 'op': 'stop'})
        with patch.object(worker, 'requests', incoming), patch.object(worker.threading, 'Thread') as thread, patch.object(worker.signal, 'signal'), patch.object(worker.ctypes, 'CDLL', return_value=SimpleNamespace(prctl=lambda *_: 0)), patch.object(worker, 'cleanup'), patch.object(worker, 'answer') as answer:
            worker.main()
        thread.return_value.start.assert_called_once()
        thread.return_value.join.assert_called_once_with(timeout=1)
        self.assertTrue(worker.ended.is_set())
        answer.assert_called_once_with(1, {'stopped': True})

    def test_cancel_arriving_during_raw_keydown_reply_is_not_discarded(self):
        incoming = queue.Queue()
        incoming.put({'id': 1, 'op': 'input', 'action': {'type': 'key', 'key': 'Enter', 'down': True}})
        incoming.put({'id': 2, 'op': 'inspect'})
        incoming.put({'id': 3, 'op': 'stop'})
        observed = []

        def answer(identifier, result=None, error=None):
            self.assertIsNone(error)
            if identifier == 1:
                worker.cancelled.add(identifier)  # Reader cancellation races reply/finally.
            if identifier == 2:
                observed.append(result['input'])

        with patch.object(worker, 'requests', incoming), patch.object(worker.threading, 'Thread'), patch.object(worker.signal, 'signal'), patch.object(worker.ctypes, 'CDLL', return_value=SimpleNamespace(prctl=lambda *_: 0)), patch.object(worker, 'cleanup'), patch.object(worker, 'answer', side_effect=answer):
            worker.main()
        self.assertEqual(observed, [{'heldKeys': [], 'heldButtons': []}])
        self.assertFalse(worker.saved_repeat)
        self.assertNotIn(1, worker.cancelled)
        self.assertTrue(worker.key_bit(self.display.repeat, 36))

    def test_rpc_forwards_actor_options_inspection_and_window_operations(self):
        incoming = queue.Queue()
        action = {'type': 'key', 'key': 'a', 'down': True}
        points = [{'x': 1, 'y': 2}]
        for request in (
            {'id': 1, 'op': 'input', 'action': action, 'actor': 'human'},
            {'id': 2, 'op': 'frame', 'options': {'cursor': False}},
            {'id': 3, 'op': 'inspect'},
            {'id': 4, 'op': 'focus', 'windowId': 201},
            {'id': 5, 'op': 'closeWindow', 'windowId': 201},
            {'id': 6, 'op': 'probe', 'points': points},
            {'id': 7, 'op': 'stop'},
        ):
            incoming.put(request)
        with patch.object(worker, 'requests', incoming), patch.object(worker.threading, 'Thread'), patch.object(worker.signal, 'signal'), patch.object(worker.ctypes, 'CDLL', return_value=SimpleNamespace(prctl=lambda *_: 0)), patch.object(worker, 'cleanup'), patch.object(worker, 'answer'), patch.object(worker, 'input_action') as input_action, patch.object(worker, 'frame') as frame, patch.object(worker, 'inspect_desktop') as inspect, patch.object(worker, 'focus_window') as focus, patch.object(worker, 'close_window') as close, patch.object(worker, 'probe') as probe:
            worker.main()
        input_action.assert_called_once_with(action, 1, 'human')
        frame.assert_called_once_with({'cursor': False})
        inspect.assert_called_once_with()
        focus.assert_called_once_with(201, 4)
        close.assert_called_once_with(201)
        probe.assert_called_once_with(points)

    def test_bus_path_error_is_explicit_and_does_not_launch_or_fall_back(self):
        with patch.object(worker, 'config', None), patch.object(worker, 'spawn') as spawn:
            with self.assertRaisesRegex(ValueError, 'session-bus socket path is too long.*shorter stateDir'):
                worker.start({'width': 640, 'height': 480, 'stateDir': '/private/' + 'nested' * 20}, 1)
        spawn.assert_not_called()
        worker.validate_bus_directory('/short/private')
        with self.assertRaises(ValueError):
            worker.validate_bus_directory('/private/' + '界' * 35)  # bytes, not characters


if __name__ == '__main__':
    unittest.main()
