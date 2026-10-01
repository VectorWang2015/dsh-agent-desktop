#!/usr/bin/env python3
"""Private X11 desktop worker. JSON lines over inherited stdio, no network listener.

Only owns its freshly created Xvfb, session bus, WM and launched applications.
Never attaches to an inherited display, publishes uinput devices or shares clipboard.
"""
import ctypes
import io
import json
import math
from datetime import datetime, timezone
import os
import queue
import re
import secrets
import select
import signal
import socket
import struct
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

REQUEST_LIMIT = 1_048_576
requests = queue.Queue(maxsize=64)
cancelled = set()
ended = threading.Event()
children = []
applications = []
# Keycodes, not keysyms: retain the original code even if a client remaps a held key.
held_keys = {}
held_buttons = {}
saved_repeat = {}
last_auto_release_at = None
KEY_NAMES = {"Control": "Control_L", "Alt": "Alt_L", "Shift": "Shift_L", "Meta": "Super_L", "Enter": "Return", "Backspace": "BackSpace", "ArrowLeft": "Left", "ArrowRight": "Right", "ArrowUp": "Up", "ArrowDown": "Down", "PageUp": "Prior", "PageDown": "Next", " ": "space"}
MODIFIERS = ("Control", "Alt", "Shift", "Meta")
BUTTONS = {"left": 1, "middle": 2, "right": 3}
xdisplay = None
capture = None
runtime = None
gui_env = None
config = None
log_handles = []
cleaned = False


def trace(message):
    if runtime and os.environ.get('AGENT_DESKTOP_DEBUG') == '1':
        with open(runtime / 'worker-events.log', 'a') as log:
            log.write(f'{time.monotonic():.3f} {message}\n')


def answer(identifier, result=None, error=None):
    trace('reply begin ' + str(identifier))
    payload = {"id": identifier, "ok": error is None}
    if error is None:
        payload["result"] = result
    else:
        payload["error"] = str(error)[:2000]
    sys.stdout.write(json.dumps(payload, ensure_ascii=True, separators=(",", ":")) + "\n")
    sys.stdout.flush()
    trace('reply flushed ' + str(identifier))


def queue_request(line):
    if len(line) > REQUEST_LIMIT:
        raise ValueError("request exceeds limit")
    request = json.loads(line)
    if not isinstance(request, dict):
        raise ValueError("request must be an object")
    if request.get("op") == "cancel":
        cancelled.add(request.get("id"))
        return
    while not ended.is_set():
        try:
            requests.put(request, timeout=0.1)
            return
        except queue.Full:
            continue


def reader():
    # A daemon blocked in BufferedReader.readline can abort CPython during
    # shutdown while holding stdin's IO lock. Raw fd reads are interruptible
    # here, bounded, and do not acquire Python's buffered-stdio locks.
    pending = bytearray()
    try:
        fd = sys.stdin.fileno()
        while not ended.is_set():
            if not select.select([fd], [], [], 0.1)[0]:
                continue
            chunk = os.read(fd, min(65536, REQUEST_LIMIT + 1 - len(pending)))
            if not chunk:
                if pending:
                    queue_request(pending)
                break
            pending.extend(chunk)
            while not ended.is_set():
                newline = pending.find(b"\n")
                if newline < 0:
                    break
                line = pending[:newline + 1]
                del pending[:newline + 1]
                queue_request(line)
            if len(pending) > REQUEST_LIMIT:
                raise ValueError("request exceeds limit")
    except Exception as exc:
        try:
            os.write(2, ("desktop worker input closed: " + str(exc)[:2000] + "\n").encode("utf-8", errors="replace"))
        except OSError:
            pass
    finally:
        ended.set()


def check(identifier):
    if ended.is_set() or identifier in cancelled:
        raise InterruptedError("Action cancelled; observe again before retrying")


def clean_env(source):
    result = {}
    for key, value in source.items():
        if re.search(r"KEY|PASSWORD|SECRET|TOKEN", key, re.I) or key.upper().startswith("DSH_"):
            continue
        if re.match(r"^(DISPLAY|WAYLAND_DISPLAY|XAUTHORITY|XDG_RUNTIME_DIR|DBUS_.*|SESSION_MANAGER|PULSE_.*|PIPEWIRE_.*|LD_PRELOAD|SELKIES_.*|PIXELFLUX_.*|VSCODE_.*|ELECTRON_.*)$", key, re.I):
            continue
        result[key] = value
    return result


def authority(path, display_number, cookie):
    # Server reads cookies regardless of record display; client uses the final display.
    fields = [socket.gethostname().encode(), str(display_number).encode(), b"MIT-MAGIC-COOKIE-1", cookie]
    data = struct.pack(">H", 256)
    for field in fields:
        data += struct.pack(">H", len(field)) + field
    path.write_bytes(data)
    path.chmod(0o600)


def spawn(argv, env, name, cwd=None, stdout=None, pass_fds=()):
    log = open(runtime / (name + ".log"), "ab", buffering=0)
    log_handles.append(log)
    process = subprocess.Popen(argv, cwd=cwd or config["cwd"], env=env,
                               stdin=subprocess.DEVNULL, stdout=stdout if stdout is not None else log,
                               stderr=log, pass_fds=pass_fds, start_new_session=True)
    children.append(process)
    return process


def bounded_line(pipe, process, timeout=10):
    deadline = time.monotonic() + timeout
    result = bytearray()
    fd = pipe if isinstance(pipe, int) else pipe.fileno()
    while time.monotonic() < deadline:
        if ended.is_set():
            raise InterruptedError("Startup cancelled")
        if process.poll() is not None:
            raise RuntimeError("Support process exited during startup; inspect owned runtime logs")
        if not select.select([fd], [], [], 0.1)[0]:
            continue
        byte = os.read(fd, 1)
        if byte == b"\n":
            return result.decode().strip()
        if not byte:
            raise RuntimeError("Support process closed startup pipe")
        result.extend(byte)
        if len(result) > 4096:
            raise RuntimeError("Unexpected startup response")
    raise TimeoutError("Timed out starting private desktop")


def validate_bus_directory(directory):
    # libdbus appends a dbus-XXXXXXXXXX name. Linux sockaddr_un.sun_path has
    # 108 bytes including its terminator; do not silently use the host's bus/tmp.
    if len(os.fsencode(Path(directory) / "dbus-XXXXXXXXXX")) > 107:
        raise ValueError("Private session-bus socket path is too long for Linux AF_UNIX (107 pathname bytes); use a shorter stateDir. No fallback session bus is used.")


def start(cfg, identifier):
    global runtime, config, gui_env, xdisplay, capture
    if config is not None:
        raise RuntimeError("Worker already started")
    width, height = cfg["width"], cfg["height"]
    if type(width) is not int or type(height) is not int or not 320 <= width <= 2560 or not 240 <= height <= 1600:
        raise ValueError("Unsupported desktop geometry")
    hold_ms = cfg.get("agentKeyHoldMs", 1500)
    if type(hold_ms) is not int or not 100 <= hold_ms <= 10000:
        raise ValueError("agentKeyHoldMs must be an integer in 100..10000")
    directory = Path(cfg["stateDir"])
    validate_bus_directory(directory)
    config = cfg
    runtime = directory
    runtime.mkdir(mode=0o700, parents=True, exist_ok=True)
    runtime.chmod(0o700)
    paths = cfg["paths"]
    base = clean_env(os.environ)
    base.update({"XDG_RUNTIME_DIR": str(runtime), "XDG_SESSION_TYPE": "x11", "XDG_CURRENT_DESKTOP": "Openbox", "GDK_BACKEND": "x11", "QT_QPA_PLATFORM": "xcb", "NO_AT_BRIDGE": "1", "GTK_USE_PORTAL": "0", "PULSE_SERVER": "unix:" + str(runtime / "disabled-pulse"), "PIPEWIRE_REMOTE": "dsh-agent-desktop-disabled"})
    native_env = dict(base)
    native_env.pop("LD_LIBRARY_PATH", None)
    native_env.pop("PYTHONPATH", None)
    native_env.pop("PYTHONHOME", None)
    if paths.get("libraryPath"):
        native_env["LD_LIBRARY_PATH"] = paths["libraryPath"]
    if paths.get("dataDirs"):
        native_env["XDG_DATA_DIRS"] = paths["dataDirs"]
    cookie = secrets.token_bytes(16)
    auth = runtime / "Xauthority"
    authority(auth, 65534, cookie)
    read_fd, write_fd = os.pipe()
    try:
        proc = spawn([paths["xvfb"], "-displayfd", str(write_fd), "-screen", "0", f"{width}x{height}x24", "-dpi", "96", "-nolisten", "tcp", "-noreset", "-auth", str(auth), "-s", "0", "-dpms"], native_env, "xvfb", pass_fds=(write_fd,))
        os.close(write_fd)
        write_fd = None
        number = bounded_line(read_fd, proc)
        if not number.isdigit():
            raise RuntimeError("Invalid Xvfb display number")
    finally:
        os.close(read_fd)
        if write_fd is not None:
            os.close(write_fd)
    check(identifier)
    authority(auth, number, cookie)
    display_name = ":" + number
    gui_env = dict(base)
    gui_env.update({"DISPLAY": display_name, "XAUTHORITY": str(auth)})
    os.environ["DISPLAY"] = display_name
    os.environ["XAUTHORITY"] = str(auth)
    from Xlib import display
    import mss
    xdisplay = display.Display(display_name)
    # Raw captures must not contain an MSS/XFixes cursor; frame() overlays ours only.
    capture = mss.mss(display=display_name, with_cursor=False)
    native_env.update(gui_env)
    if paths.get("libraryPath"):
        native_env["LD_LIBRARY_PATH"] = paths["libraryPath"]
    if paths.get("dataDirs"):
        native_env["XDG_DATA_DIRS"] = paths["dataDirs"]
    # No standard_session_servicedirs: do not auto-start the host user's keyring,
    # portal, audio or settings daemons just because a GUI application probes D-Bus.
    bus_config = runtime / "dbus.conf"
    bus_config.write_text('<busconfig><type>session</type><listen>unix:tmpdir=' + xml_escape(str(runtime)) + '</listen><auth>EXTERNAL</auth><policy context="default"><allow own="*"/><allow send_destination="*"/><allow receive_sender="*"/></policy></busconfig>')
    bus_read, bus_write = os.pipe()
    try:
        bus = spawn(["/usr/bin/dbus-daemon", "--config-file=" + str(bus_config), "--nofork", "--print-address=" + str(bus_write)], native_env, "dbus", pass_fds=(bus_write,))
        os.close(bus_write)
        bus_write = None
        bus_address = bounded_line(bus_read, bus)
    finally:
        os.close(bus_read)
        if bus_write is not None:
            os.close(bus_write)
    gui_env["DBUS_SESSION_BUS_ADDRESS"] = bus_address
    native_env["DBUS_SESSION_BUS_ADDRESS"] = bus_address
    if paths.get("windowManager"):
        args = paths.get("windowManagerArgs", ["--sm-disable"])
        wm = spawn([paths["windowManager"], *args], native_env, "wm")
        deadline = time.monotonic() + 5
        atom = xdisplay.intern_atom("_NET_SUPPORTING_WM_CHECK")
        while time.monotonic() < deadline:
            check(identifier)
            if wm.poll() is not None:
                raise RuntimeError("Private window manager exited; inspect wm.log")
            if xdisplay.screen().root.get_full_property(atom, 0):
                break
            time.sleep(0.03)
        else:
            raise TimeoutError("Private window manager did not become ready")
    check(identifier)
    if paths.get("terminal") and cfg.get("startTerminal", True):
        terminal = spawn([paths["terminal"], "-title", "AI Desktop — host-native session", "-geometry", "100x28+32+32", "-fa", "Monospace", "-fs", "11"], gui_env, "terminal")
        track_application("terminal", paths["terminal"], terminal)
        deadline = time.monotonic() + 7
        clients_atom = xdisplay.intern_atom("_NET_CLIENT_LIST")
        pid_atom = xdisplay.intern_atom("_NET_WM_PID")
        while time.monotonic() < deadline:
            check(identifier)
            if terminal.poll() is not None:
                raise RuntimeError("Initial terminal exited; inspect terminal.log")
            clients = xdisplay.screen().root.get_full_property(clients_atom, 0)
            found = False
            for wid in clients.value if clients else []:
                try:
                    window = xdisplay.create_resource_object("window", int(wid))
                    pid = window.get_full_property(pid_atom, 0)
                    if pid and int(pid.value[0]) == terminal.pid and window.get_attributes().map_state == 2:
                        found = True
                        break
                except Exception:
                    continue
            if found:
                break
            time.sleep(0.03)
        else:
            raise TimeoutError("Initial terminal did not map a window")
    return {"display": display_name, "pid": os.getpid(), "width": width, "height": height, "backend": "native-x11"}


def iso_time(timestamp=None):
    return datetime.fromtimestamp(time.time() if timestamp is None else timestamp, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def desktop_geometry():
    if xdisplay is None:
        raise RuntimeError("Desktop not started")
    geometry = xdisplay.screen().root.get_geometry()
    return {"x": 0, "y": 0, "width": int(geometry.width), "height": int(geometry.height)}


def validate_point(point, geometry):
    x, y = point.get("x"), point.get("y")
    if type(x) is not int or type(y) is not int or not 0 <= x < geometry["width"] or not 0 <= y < geometry["height"]:
        raise ValueError("Point must use integer pixels within the current desktop")
    return x, y


def keyboard_mapping():
    minimum, maximum = xdisplay.display.info.min_keycode, xdisplay.display.info.max_keycode
    # Do not use python-xlib's keysym cache: clients (and text()) can remap keys.
    return minimum, xdisplay.get_keyboard_mapping(minimum, maximum - minimum + 1)


def key_name(key):
    if not isinstance(key, str) or not 1 <= len(key) <= 64 or any(ord(ch) < 32 for ch in key):
        raise ValueError("Invalid key")
    return KEY_NAMES.get(key, key)


def mapped_key(key, mapping=None):
    from Xlib import XK
    name = key_name(key)
    symbol = XK.string_to_keysym(name)
    if not symbol and len(name) == 1:
        symbol = ord(name) if ord(name) <= 255 else 0x01000000 | ord(name)
    # NoSymbol must never match an unused slot and become a pressed keycode.
    if symbol:
        minimum, rows = keyboard_mapping() if mapping is None else mapping
        matches = [(level, minimum + offset) for offset, row in enumerate(rows) for level, value in enumerate(row) if value == symbol]
        if matches:
            level, code = min(matches)
            if 8 <= code <= 255:
                return code, level
    raise ValueError("Key has no mapping; use text input for Unicode: " + name)


def key_bit(bits, code):
    return bool(int(bits[code // 8]) & (1 << (code % 8)))


def suppress_repeat(code):
    from Xlib import X
    if code not in saved_repeat:
        saved_repeat[code] = key_bit(xdisplay.get_keyboard_control().auto_repeats, code)
    # Always specify a key: never change global repeat or another display.
    xdisplay.change_keyboard_control(key=code, auto_repeat_mode=X.AutoRepeatModeOff)


def restore_repeat(code):
    from Xlib import X
    if code in saved_repeat:
        xdisplay.change_keyboard_control(key=code, auto_repeat_mode=X.AutoRepeatModeOn if saved_repeat[code] else X.AutoRepeatModeOff)
        del saved_repeat[code]


def release_key(code):
    from Xlib import X
    from Xlib.ext import xtest
    try:
        if code in held_keys:
            xtest.fake_input(xdisplay, X.KeyRelease, code)
            del held_keys[code]
    finally:
        # A failed key release must not skip restoring the private per-key bit.
        restore_repeat(code)


def release_button(code):
    from Xlib import X
    from Xlib.ext import xtest
    if code in held_buttons:
        xtest.fake_input(xdisplay, X.ButtonRelease, code)
        del held_buttons[code]


def release_inputs(keys=(), buttons=(), sync=True):
    first_error = None
    for release_one, codes in ((release_key, keys), (release_button, buttons)):
        for code in list(codes):
            try:
                release_one(code)
            except Exception as exc:
                first_error = first_error or exc
    if sync:
        try:
            xdisplay.sync()
        except Exception as exc:
            first_error = first_error or exc
    if first_error is not None:
        raise first_error


def release():
    if xdisplay is not None:
        # Never synthesize arbitrary key-ups or ungrab another client's input.
        release_inputs(list(dict.fromkeys([*reversed(held_keys), *saved_repeat])), list(held_buttons))


def expire_held_input(now=None):
    global last_auto_release_at
    now = time.monotonic() if now is None else now
    expired = [code for code, state in held_keys.items() if state.get("expiresAt") is not None and now >= state["expiresAt"]]
    cancelled_keys = [code for code, state in held_keys.items() if state["requestId"] in cancelled]
    cancelled_buttons = [code for code, state in held_buttons.items() if state["requestId"] in cancelled]
    cancelled_holds = {held_keys[code]["requestId"] for code in cancelled_keys} | {held_buttons[code]["requestId"] for code in cancelled_buttons}
    if expired or cancelled_keys or cancelled_buttons:
        release_inputs(list(dict.fromkeys([*expired, *cancelled_keys])), cancelled_buttons)
        cancelled.difference_update(cancelled_holds)
        if expired:
            last_auto_release_at = iso_time()


def input_wait_timeout():
    deadlines = [state["expiresAt"] for state in held_keys.values() if state.get("expiresAt") is not None]
    return max(0, min(0.2, min(deadlines) - time.monotonic())) if deadlines else 0.2


def hold_key(code, key, actor, identifier, expires_at=None):
    from Xlib import X
    from Xlib.ext import xtest
    # Bookkeep before sending, so even a partially failed operation releases it.
    held_keys[code] = {"key": key, "name": key_name(key), "actor": actor, "requestId": identifier, "expiresAt": expires_at}
    if expires_at is not None:
        suppress_repeat(code)
    xtest.fake_input(xdisplay, X.KeyPress, code)


def raw_key(action, identifier, actor):
    name = key_name(action.get("key"))
    down = action.get("down")
    if type(down) is not bool:
        raise ValueError("down must be boolean")
    # Key-up must use its original code, not a possibly changed mapping.
    code = next((code for code, state in held_keys.items() if state["name"] == name), None)
    if code is None:
        code, _ = mapped_key(action["key"])
    previous = held_keys.get(code)
    if not down:
        if previous is not None and (actor == previous["actor"] or actor == "human"):
            release_key(code)
        return
    if previous is not None:
        if actor == "agent":
            if previous["actor"] != "agent":
                raise ValueError("Key is already held by human input")
            return  # Repeated agent keydown neither repeats nor extends the bound.
        restore_repeat(code)  # Human takeover preserves ordinary repeat behavior.
    elif actor == "agent" and key_bit(xdisplay.query_keymap(), code):
        raise ValueError("Key is already down outside this worker; release it normally first")
    deadline = time.monotonic() + (config or {}).get("agentKeyHoldMs", 1500) / 1000 if actor == "agent" else None
    hold_key(code, action["key"], actor, identifier, deadline)


def atomic_press(action, identifier, actor):
    modifiers = action.get("modifiers", [])
    if not isinstance(modifiers, list) or len(modifiers) > 4 or any(modifier not in MODIFIERS for modifier in modifiers):
        raise ValueError("modifiers must be Control, Alt, Shift or Meta")
    mapping = keyboard_mapping()
    code, level = mapped_key(action.get("key"), mapping)
    if level > 1:
        raise ValueError("Key requires an unsupported layout level; use text input")
    modifiers = list(dict.fromkeys(modifiers))
    if level == 1 and "Shift" not in modifiers:
        modifiers.append("Shift")
    resolved = [(mapped_key(modifier, mapping)[0], modifier) for modifier in modifiers]
    already_down = xdisplay.query_keymap()
    if code in held_keys or key_bit(already_down, code):
        raise ValueError("Key is already held; release it before an atomic press")
    pressed = []
    try:
        for current, label in [*resolved, (code, action["key"])]:
            # Keep pre-existing modifiers held; never release what we did not press.
            if current in pressed or (current != code and (current in held_keys or key_bit(already_down, current))):
                continue
            check(identifier)
            pressed.append(current)
            hold_key(current, label, actor, identifier)
    finally:
        release_inputs(reversed(pressed))


def hold_button(code, actor, identifier):
    from Xlib import X
    from Xlib.ext import xtest
    held_buttons[code] = {"actor": actor, "requestId": identifier}
    xtest.fake_input(xdisplay, X.ButtonPress, code)


def click_button(code, identifier, actor):
    if code in held_buttons:
        raise ValueError("Button is already held; release it before a click")
    try:
        hold_button(code, actor, identifier)
    finally:
        release_button(code)


def type_text(text, identifier, actor):
    from Xlib import XK
    if not isinstance(text, str) or not 1 <= len(text) <= 4000 or any(ord(ch) < 32 and ch not in "\r\n\t" or ord(ch) == 127 or 0xD800 <= ord(ch) <= 0xDFFF for ch in text):
        raise ValueError("Text must contain 1..4000 valid Unicode characters without unsupported controls")
    release()
    # X events carry keycodes, not text. Keep new Unicode mappings for the
    # lifetime of this private display, including for stalled receivers. The
    # existing server grab serializes map updates; it does not override input grabs.
    xdisplay.grab_server()
    try:
        minimum, keymap = keyboard_mapping()
        down = xdisplay.query_keymap()
        known, spares = {}, []
        for offset, row in enumerate(keymap):
            code = minimum + offset
            if not any(row) and not key_bit(down, code):
                spares.append(code)
            for level, symbol in enumerate(row[:2]):
                if symbol and (symbol not in known or (level, code) < (known[symbol][1], known[symbol][0])):
                    known[symbol] = (code, level)
        symbols = [XK.string_to_keysym("Tab" if ch == "\t" else "Return") if ch in "\r\n\t" else (ord(ch) if ord(ch) <= 255 else 0x01000000 | ord(ch)) for ch in text]
        missing = list(dict.fromkeys(symbol for symbol in symbols if symbol not in known))
        if len(missing) > len(spares):
            raise ValueError("Private X11 Unicode keymap capacity exhausted. No text was sent; use the application's file import or a fresh desktop for additional distinct characters.")
        for symbol, code in zip(missing, spares):
            xdisplay.change_keyboard_mapping(code, [(symbol,) * len(keymap[code - minimum])])
            known[symbol] = (code, 0)
        shift = mapped_key("Shift", (minimum, keymap))[0] if any(known[symbol][1] == 1 for symbol in symbols) else None
        if any(key_bit(down, known[symbol][0]) for symbol in symbols) or (shift is not None and key_bit(down, shift)):
            raise ValueError("Text keys are already down outside this worker; release them normally first")
        xdisplay.sync()
        for character, symbol in zip(text, symbols):
            check(identifier)
            code, level = known[symbol]
            sequence = [(shift, "Shift")] if level == 1 else []
            sequence.append((code, "Return" if character in "\r\n" else "Tab" if character == "\t" else character))
            for current, label in sequence:
                hold_key(current, label, actor, identifier)
            release_inputs([current for current, _ in reversed(sequence)], sync=False)
    finally:
        try:
            release()
        finally:
            xdisplay.ungrab_server()
            xdisplay.sync()


def input_action(action, identifier, actor="agent"):
    from Xlib import X
    from Xlib.ext import xtest
    if xdisplay is None:
        raise RuntimeError("Desktop not started")
    if actor not in ("agent", "human"):
        raise ValueError("Invalid input actor")
    check(identifier)
    kind = action["type"]
    if kind == "key" and "down" not in action:
        kind = "press"
    if kind not in ("move", "click", "button", "scroll", "key", "press", "text", "release"):
        raise ValueError("Unknown input action")
    point = None
    if kind in ("move", "click", "button", "scroll") and (kind == "move" or "x" in action or "y" in action):
        point = validate_point(action, desktop_geometry())
    button = BUTTONS.get(action.get("button", "left"))
    if kind in ("click", "button") and button is None:
        raise ValueError("Invalid mouse button")
    count = action.get("count", 1)
    if kind == "click" and (type(count) is not int or count not in (1, 2)):
        raise ValueError("click count must be 1 or 2")
    if kind == "button" and type(action.get("down")) is not bool:
        raise ValueError("down must be boolean")
    if kind == "scroll" and any(type(action.get(key, 0)) not in (int, float) or not math.isfinite(action.get(key, 0)) for key in ("deltaX", "deltaY")):
        raise ValueError("Scroll deltas must be finite numbers")
    try:
        if point is not None:
            xtest.fake_input(xdisplay, X.MotionNotify, x=point[0], y=point[1])
        if kind == "click":
            for _ in range(count):
                check(identifier)
                click_button(button, identifier, actor)
        elif kind == "button":
            if action["down"]:
                hold_button(button, actor, identifier)
            else:
                release_button(button)
        elif kind == "scroll":
            for delta, positive, negative in [(action.get("deltaY", 0), 5, 4), (action.get("deltaX", 0), 7, 6)]:
                for _ in range(min(20, max(1, round(abs(delta) / 100))) if delta else 0):
                    check(identifier)
                    click_button(positive if delta > 0 else negative, identifier, actor)
        elif kind == "key":
            raw_key(action, identifier, actor)
        elif kind == "press":
            atomic_press(action, identifier, actor)
        elif kind == "text":
            type_text(action["text"], identifier, actor)
        elif kind == "release":
            release()
        xdisplay.sync()
        check(identifier)
    except BaseException:
        try:
            release()
        except Exception:
            pass
        raise
    return {"delivered": True}


def resource_id(resource):
    value = int(getattr(resource, "id", resource)) if resource is not None else 0
    # None and PointerRoot are X focus sentinels, not actual window IDs.
    return value if value > 1 else None


def property_values(window, name):
    value = window.get_full_property(xdisplay.intern_atom(name), 0)
    return list(value.value) if value is not None else []


def managed_window_ids():
    root = xdisplay.screen().root
    return list(dict.fromkeys(int(value) for value in property_values(root, "_NET_CLIENT_LIST")[:64] if 1 < int(value) <= 0xFFFFFFFF and int(value) != root.id))


def focused_window_id():
    try:
        return resource_id(xdisplay.get_input_focus().focus)
    except Exception:
        return None


def focus_ancestry(focused):
    ancestors = set()
    root_id = xdisplay.screen().root.id
    for _ in range(64):
        if focused is None or focused in ancestors:
            break
        ancestors.add(focused)
        if focused == root_id:
            break
        try:
            focused = resource_id(xdisplay.create_resource_object("window", focused).query_tree().parent)
        except Exception:
            break  # A focused child may be destroyed during inspection.
    return ancestors


def window_info(window_id, ancestors, active):
    from Xlib import X, Xutil
    root = xdisplay.screen().root
    window = xdisplay.create_resource_object("window", window_id)
    attributes = window.get_attributes()
    geometry = window.get_geometry()
    origin = root.translate_coords(window, 0, 0)
    name = window.get_full_property(xdisplay.intern_atom("_NET_WM_NAME"), xdisplay.intern_atom("UTF8_STRING"))
    title = bytes(name.value).decode("utf-8", errors="replace") if name is not None else str(window.get_wm_name() or "")
    pid = property_values(window, "_NET_WM_PID")
    protocols = list(window.get_wm_protocols() or [])
    hints = window.get_wm_hints()
    focusable = None
    if hints is not None and int(hints["flags"]) & Xutil.InputHint:
        focusable = bool(hints["input"])
    if xdisplay.intern_atom("WM_TAKE_FOCUS") in protocols:
        focusable = True
    return {
        "id": window_id, "title": title[:250],
        "pid": int(pid[0]) if pid and int(pid[0]) > 0 else None,
        "mapped": attributes.map_state == X.IsViewable,
        # ICCCM hint/protocol-derived only, never a grab detector or guarantee.
        "focusable": focusable, "focused": window_id in ancestors, "active": window_id == active,
        "modal": xdisplay.intern_atom("_NET_WM_STATE_MODAL") in property_values(window, "_NET_WM_STATE"),
        "transientFor": resource_id(window.get_wm_transient_for()),
        "supportsDelete": xdisplay.intern_atom("WM_DELETE_WINDOW") in protocols,
        "geometry": {"x": int(origin.x), "y": int(origin.y), "width": int(geometry.width), "height": int(geometry.height)},
    }


def application_info(windows, observed_at):
    states = []
    for record in applications:
        exit_code = record["process"].poll()
        if exit_code is not None and "exitedAt" not in record:
            record["exitedAt"] = time.monotonic()
        states.append((record, exit_code))
    recent = sorted((record for record, code in reversed(states) if code is not None), key=lambda record: record["exitedAt"], reverse=True)[:32]
    retained = {record["id"] for record in recent}
    states = [(record, code) for record, code in states if code is None or record["id"] in retained]
    applications[:] = [record for record, _ in states]
    return [{
        "id": record["id"], "command": record["command"], "pid": record["process"].pid,
        # Only this exact launch process. A wrapper can exit before its GUI child;
        # neither advertised window PIDs nor PID reuse redefine Popen's lifetime.
        "running": exit_code is None, "exitCode": exit_code, "observedAt": observed_at,
        "windowIds": [window["id"] for window in windows if window["pid"] == record["process"].pid],
    } for record, exit_code in states]


def track_application(app_id, command, process):
    applications.append({"id": app_id, "command": command, "process": process})
    application_info([], iso_time())  # Keep only 32 recent exited launchers, even between inspections.


def inspect_desktop():
    if xdisplay is None:
        raise RuntimeError("Desktop not started")
    expire_held_input()
    focused = focused_window_id()
    ancestors = focus_ancestry(focused)
    active_property = property_values(xdisplay.screen().root, "_NET_ACTIVE_WINDOW")
    active = resource_id(active_property[0]) if active_property else None
    windows = []
    for window_id in managed_window_ids():
        try:
            windows.append(window_info(window_id, ancestors, active))
        except Exception:
            continue  # Each client can disappear or change properties independently.
    observed_at = iso_time()
    input_state = {"heldKeys": [state["key"] for state in held_keys.values()], "heldButtons": [next((name for name, value in BUTTONS.items() if value == code), str(code)) for code in held_buttons]}
    if last_auto_release_at is not None:
        input_state["lastAutoReleaseAt"] = last_auto_release_at
    return {"applications": application_info(windows, observed_at), "windows": windows, "focusedWindowId": focused, "activeWindowId": active, "observedAt": observed_at, "input": input_state}


def validate_window_id(window_id):
    if xdisplay is None:
        raise RuntimeError("Desktop not started")
    if type(window_id) is not int or not 1 < window_id <= 0xFFFFFFFF:
        raise ValueError("Invalid windowId")


def focus_window(window_id, identifier=None):
    from Xlib import X, error
    from Xlib.protocol import event
    validate_window_id(window_id)
    check(identifier)
    result = {"requested": False, "confirmed": False, "windowId": window_id, "focusedWindowId": focused_window_id()}
    if window_id not in managed_window_ids():
        return {**result, "reason": "Window is not a current managed client"}
    try:
        xdisplay.create_resource_object("window", window_id).get_attributes()
        root = xdisplay.screen().root
        active = property_values(root, "_NET_ACTIVE_WINDOW")
        message = event.ClientMessage(window=window_id, client_type=xdisplay.intern_atom("_NET_ACTIVE_WINDOW"), data=(32, [1, X.CurrentTime, int(active[0]) if active else 0, 0, 0]))
        errors = error.CatchError()
        # Source 1 is an ordinary application request, not a pager's override.
        root.send_event(message, event_mask=X.SubstructureRedirectMask | X.SubstructureNotifyMask, onerror=errors)
        xdisplay.sync()
        if errors.get_error() is not None:
            return {**result, "reason": "Window activation request was not accepted by X11"}
    except Exception:
        return {**result, "reason": "Window disappeared before activation could be requested"}
    result["requested"] = True
    deadline = time.monotonic() + 0.35
    while True:
        check(identifier)
        expire_held_input()
        result["focusedWindowId"] = focused_window_id()
        if window_id in focus_ancestry(result["focusedWindowId"]):
            result["confirmed"] = True
            return result
        if time.monotonic() >= deadline:
            return {**result, "reason": "Window manager did not focus the requested client; it may refuse or redirect focus"}
        time.sleep(min(0.02, max(0, deadline - time.monotonic())))


def close_window(window_id):
    from Xlib import X, error
    from Xlib.protocol import event
    validate_window_id(window_id)
    result = {"requested": False, "windowId": window_id}
    if window_id not in managed_window_ids():
        return {**result, "reason": "Window is not a current managed client"}
    try:
        window = xdisplay.create_resource_object("window", window_id)
        delete = xdisplay.intern_atom("WM_DELETE_WINDOW")
        if delete not in (window.get_wm_protocols() or []):
            return {**result, "reason": "Window does not support WM_DELETE_WINDOW"}
        message = event.ClientMessage(window=window_id, client_type=xdisplay.intern_atom("WM_PROTOCOLS"), data=(32, [delete, X.CurrentTime, 0, 0, 0]))
        errors = error.CatchError()
        window.send_event(message, event_mask=0, propagate=False, onerror=errors)
        xdisplay.sync()
        if errors.get_error() is not None:
            return {**result, "reason": "Window disappeared before the close request was delivered"}
    except Exception:
        return {**result, "reason": "Window disappeared before close could be requested"}
    # This is only a polite request. The app can refuse or present a save dialog.
    return {"requested": True, "windowId": window_id}


def frame_region(value, geometry):
    if value is None:
        return dict(geometry)
    if not isinstance(value, dict):
        raise ValueError("region must be a rectangle")
    x, y = validate_point(value, geometry)
    width, height = value.get("width"), value.get("height")
    if type(width) is not int or type(height) is not int or width < 1 or height < 1 or x + width > geometry["width"] or y + height > geometry["height"]:
        raise ValueError("region must use positive integer dimensions within the current desktop")
    return {"x": x, "y": y, "width": width, "height": height}


def capture_raw(geometry):
    from PIL import Image
    if capture is None:
        raise RuntimeError("Desktop not started")
    # MSS's monitor cache can be stale after a client changes root geometry.
    shot = capture.grab({"left": 0, "top": 0, "width": geometry["width"], "height": geometry["height"]})
    timestamp = time.time()
    image = Image.frombytes("RGB", shot.size, shot.rgb)
    if image.size != (geometry["width"], geometry["height"]):
        raise RuntimeError("Desktop geometry changed during capture; observe again")
    return image, timestamp, uuid.uuid4().hex


def frame(options=None):
    from PIL import ImageDraw
    options = {} if options is None else options
    if not isinstance(options, dict) or type(options.get("cursor", True)) is not bool:
        raise ValueError("frame options must contain a boolean cursor flag")
    geometry = desktop_geometry()
    region = frame_region(options.get("region"), geometry)
    trace('frame pixels begin')
    image, timestamp, frame_id = capture_raw(geometry)
    trace('frame pixels received')
    image = image.crop((region["x"], region["y"], region["x"] + region["width"], region["y"] + region["height"]))
    if options.get("cursor", True):
        pointer = xdisplay.screen().root.query_pointer()
        x, y = int(pointer.root_x) - region["x"], int(pointer.root_y) - region["y"]
        draw = ImageDraw.Draw(image)
        draw.polygon([(x, y), (x, y + 16), (x + 4, y + 12), (x + 8, y + 19), (x + 11, y + 17), (x + 7, y + 10), (x + 14, y + 10)], fill="#36c896", outline="#10261e")
    buf = io.BytesIO()
    image.save(buf, format="PNG", compress_level=3)
    trace('frame png encoded ' + str(buf.tell()))
    temporary = runtime / 'frame.next.png'
    temporary.write_bytes(buf.getvalue())
    temporary.chmod(0o600)
    temporary.replace(runtime / 'frame.png')
    return {**inspect_desktop(), "imageFile": 'frame.png', "width": image.width, "height": image.height, "timestamp": timestamp, "frameId": frame_id, "region": region}


def probe(points):
    if not isinstance(points, list) or len(points) > 32 or any(not isinstance(point, dict) for point in points):
        raise ValueError("points must be a list of at most 32 desktop pixel coordinates")
    geometry = desktop_geometry()
    coordinates = [validate_point(point, geometry) for point in points]
    image, timestamp, frame_id = capture_raw(geometry)
    # A fresh, independent sample of composited RGB pixels; no pointer query or overlay.
    return {"frameId": frame_id, "capturedAt": iso_time(timestamp), "coordinateSpace": "desktop", "cursorOverlay": False, "samples": [{"x": x, "y": y, "rgba": [*image.getpixel((x, y)), 255]} for x, y in coordinates]}


def launch(request):
    if gui_env is None:
        raise RuntimeError("Desktop not started")
    env = dict(gui_env)
    env.update(request.get("env", {}))
    # Routing fields are validated by Host and authoritatively overwritten here too.
    for key in ("DISPLAY", "XAUTHORITY", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS", "GDK_BACKEND", "QT_QPA_PLATFORM", "PULSE_SERVER", "PIPEWIRE_REMOTE"):
        if key in gui_env:
            env[key] = gui_env[key]
    for key in ("WAYLAND_DISPLAY", "SESSION_MANAGER", "LD_PRELOAD"):
        env.pop(key, None)
    app_id = uuid.uuid4().hex[:12]
    process = spawn([request["command"], *request.get("args", [])], env, "app-" + app_id, cwd=request.get("cwd"))
    track_application(app_id, request["command"], process)
    return {"id": app_id, "pid": process.pid}


def child_ids():
    """Only this living subreaper's direct children; orphaned descendants are adopted."""
    parent = os.getpid()
    return Path(f"/proc/{parent}/task/{parent}/children").read_text().split()


def signal_owned(sig):
    # Never signal a remembered PID/PGID. Pin each kernel task, verify that it is
    # currently our child, and signal the pinned task. Reused PIDs cannot escape
    # the parent check or redirect pidfd_send_signal to another process.
    for value in child_ids():
        pid = int(value)
        fd = None
        try:
            fd = os.pidfd_open(pid)
            stat = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
            if int(stat[1]) == os.getpid():
                signal.pidfd_send_signal(fd, sig)
        except (FileNotFoundError, ProcessLookupError):
            pass
        finally:
            if fd is not None:
                os.close(fd)


def reap():
    for process in children:
        process.poll()
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
            if pid == 0:
                break
        except ChildProcessError:
            break


def cleanup():
    global xdisplay, capture, cleaned
    if cleaned:
        return
    cleaned = True
    try:
        release()
    except Exception:
        pass
    if capture:
        try:
            capture.close()
        except Exception:
            pass
        capture = None
    if xdisplay:
        try:
            xdisplay.close()
        except Exception:
            pass
        xdisplay = None
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        reap()
        if not child_ids():
            break
        signal_owned(signal.SIGTERM)
        time.sleep(0.025)
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        reap()
        if not child_ids():
            break
        signal_owned(signal.SIGKILL)
        time.sleep(0.025)
    children.clear()
    for log in log_handles:
        log.close()
    log_handles.clear()
    if runtime:
        (runtime / "Xauthority").unlink(missing_ok=True)


def main():
    # Adopt orphaned descendants instead of guessing ownership from a stale PID/PGID.
    if not sys.platform.startswith("linux") or not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal") or ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) != 0:
        raise RuntimeError("Native desktop requires Linux child-subreaper support")
    reader_thread = threading.Thread(target=reader, name="desktop-stdin", daemon=True)
    reader_thread.start()
    signal.signal(signal.SIGTERM, lambda *_: ended.set())
    signal.signal(signal.SIGHUP, lambda *_: ended.set())
    try:
        while not ended.is_set() or not requests.empty():
            expire_held_input()
            try:
                request = requests.get(timeout=input_wait_timeout())
            except queue.Empty:
                continue
            identifier = request.get("id")
            try:
                check(identifier)
                op = request["op"]
                trace('request ' + str(identifier) + ' ' + op)
                if op == "start":
                    result = start(request["config"], identifier)
                elif op == "frame":
                    result = frame(request.get("options"))
                elif op == "inspect":
                    result = inspect_desktop()
                elif op == "focus":
                    result = focus_window(request["windowId"], identifier)
                elif op == "closeWindow":
                    result = close_window(request["windowId"])
                elif op == "probe":
                    result = probe(request["points"])
                elif op == "input":
                    result = input_action(request["action"], identifier, request.get("actor", "agent"))
                elif op == "release":
                    release()
                    result = {"released": True}
                elif op == "launch":
                    result = launch(request["request"])
                elif op == "stop":
                    cleanup()
                    answer(identifier, {"stopped": True})
                    return
                else:
                    raise ValueError("Unknown operation")
                answer(identifier, result)
            except Exception as exc:
                try:
                    release()
                except Exception:
                    pass
                answer(identifier, error=exc)
            finally:
                # A cancel can arrive while answer() writes a raw-down reply.
                # Keep that flag for idle maintenance until its held input is
                # released, rather than losing a cancellation in this narrow race.
                if not any(state["requestId"] == identifier for state in (*held_keys.values(), *held_buttons.values())):
                    cancelled.discard(identifier)
    finally:
        ended.set()
        reader_thread.join(timeout=1)
        cleanup()


if __name__ == "__main__":
    main()
