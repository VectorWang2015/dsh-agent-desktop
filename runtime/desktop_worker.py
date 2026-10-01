#!/usr/bin/env python3
"""Private X11 desktop worker. JSON lines over inherited stdio, no network listener.

Only owns its freshly created Xvfb, session bus, WM and launched applications.
Never attaches to an inherited display, publishes uinput devices or shares clipboard.
"""
import base64
import ctypes
import io
import json
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
held_keys = set()
held_buttons = set()
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


def reader():
    try:
        while True:
            line = sys.stdin.buffer.readline(REQUEST_LIMIT + 1)
            if not line:
                break
            if len(line) > REQUEST_LIMIT:
                raise ValueError("request exceeds limit")
            request = json.loads(line)
            if request.get("op") == "cancel":
                cancelled.add(request.get("id"))
                continue
            requests.put(request)
    except Exception as exc:
        print("desktop worker input closed: " + str(exc), file=sys.stderr)
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


def start(cfg, identifier):
    global runtime, config, gui_env, xdisplay, capture
    if config is not None:
        raise RuntimeError("Worker already started")
    config = cfg
    width, height = int(cfg["width"]), int(cfg["height"])
    if not 320 <= width <= 2560 or not 240 <= height <= 1600:
        raise ValueError("Unsupported desktop geometry")
    runtime = Path(cfg["stateDir"])
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
    capture = mss.mss(display=display_name)
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


def release():
    if xdisplay is None:
        return
    from Xlib import X
    from Xlib.ext import xtest
    for code in list(held_keys):
        xtest.fake_input(xdisplay, X.KeyRelease, code)
    held_keys.clear()
    for code in list(held_buttons):
        xtest.fake_input(xdisplay, X.ButtonRelease, code)
    held_buttons.clear()
    xdisplay.sync()


def input_action(action, identifier):
    from Xlib import X, XK
    from Xlib.ext import xtest
    if xdisplay is None:
        raise RuntimeError("Desktop not started")
    check(identifier)
    kind = action["type"]
    if "x" in action:
        xtest.fake_input(xdisplay, X.MotionNotify, x=int(action["x"]), y=int(action["y"]))
    if kind == "move":
        pass
    elif kind in ("click", "button"):
        b = {"left": 1, "middle": 2, "right": 3}[action.get("button", "left")]
        if kind == "click":
            for _ in range(action.get("count", 1)):
                check(identifier)
                xtest.fake_input(xdisplay, X.ButtonPress, b)
                xtest.fake_input(xdisplay, X.ButtonRelease, b)
        else:
            down = action["down"]
            xtest.fake_input(xdisplay, X.ButtonPress if down else X.ButtonRelease, b)
            (held_buttons.add if down else held_buttons.discard)(b)
    elif kind == "scroll":
        for delta, positive, negative in [(action.get("deltaY", 0), 5, 4), (action.get("deltaX", 0), 7, 6)]:
            for _ in range(min(20, max(1, round(abs(delta) / 100))) if delta else 0):
                check(identifier)
                b = positive if delta > 0 else negative
                xtest.fake_input(xdisplay, X.ButtonPress, b)
                xtest.fake_input(xdisplay, X.ButtonRelease, b)
    elif kind == "key":
        names = {"Control": "Control_L", "Alt": "Alt_L", "Shift": "Shift_L", "Meta": "Super_L", "Enter": "Return", "Escape": "Escape", "Backspace": "BackSpace", "ArrowLeft": "Left", "ArrowRight": "Right", "ArrowUp": "Up", "ArrowDown": "Down", "PageUp": "Prior", "PageDown": "Next", " ": "space"}
        name = names.get(action["key"], action["key"])
        keysym = XK.string_to_keysym(name)
        if not keysym and len(name) == 1:
            keysym = ord(name)
        code = xdisplay.keysym_to_keycode(keysym)
        if not code:
            raise ValueError("Key has no mapping; use text input for Unicode: " + name)
        down = action["down"]
        xtest.fake_input(xdisplay, X.KeyPress if down else X.KeyRelease, code)
        (held_keys.add if down else held_keys.discard)(code)
    elif kind == "text":
        text = action["text"]
        if len(text) > 4000:
            raise ValueError("Text exceeds 4000 characters")
        release()
        # X events carry keycodes, not text. Keep new Unicode mappings for the
        # lifetime of this private display so even a stalled receiver resolves
        # queued events correctly. Never recycle a slot based on a sleep timer.
        minimum, maximum = xdisplay.display.info.min_keycode, xdisplay.display.info.max_keycode
        keymap = xdisplay.get_keyboard_mapping(minimum, maximum - minimum + 1)
        known, spares = {}, []
        for offset, row in enumerate(keymap):
            code = minimum + offset
            if not any(row):
                spares.append(code)
            for level, sym in enumerate(row[:2]):
                if sym and sym not in known:
                    known[sym] = (code, level)
        shift = xdisplay.keysym_to_keycode(XK.string_to_keysym("Shift_L"))
        symbols = [XK.string_to_keysym("Tab" if ch == "\t" else "Return") if ch in "\r\n\t" else (ord(ch) if ord(ch) <= 255 else 0x01000000 | ord(ch)) for ch in text]
        missing = list(dict.fromkeys(sym for sym in symbols if sym not in known))
        if len(missing) > len(spares):
            raise ValueError("Private X11 Unicode keymap capacity exhausted. No text was sent; use the application's file import or a fresh desktop for additional distinct characters.")
        xdisplay.grab_server()
        try:
            for sym, code in zip(missing, spares):
                xdisplay.change_keyboard_mapping(code, [(sym,) * len(keymap[code - minimum])])
                known[sym] = (code, 0)
            xdisplay.sync()
            for sym in symbols:
                check(identifier)
                code, level = known[sym]
                if level == 1:
                    xtest.fake_input(xdisplay, X.KeyPress, shift)
                xtest.fake_input(xdisplay, X.KeyPress, code)
                xtest.fake_input(xdisplay, X.KeyRelease, code)
                if level == 1:
                    xtest.fake_input(xdisplay, X.KeyRelease, shift)
        finally:
            xdisplay.ungrab_server()
            xdisplay.sync()
    else:
        raise ValueError("Unknown input action")
    xdisplay.sync()
    check(identifier)
    return {"delivered": True}


def frame():
    from PIL import Image, ImageDraw
    if capture is None:
        raise RuntimeError("Desktop not started")
    trace('frame pixels begin')
    shot = capture.grab(capture.monitors[0])
    trace('frame pixels received')
    image = Image.frombytes("RGB", shot.size, shot.rgb)
    trace('frame pointer begin')
    pointer = xdisplay.screen().root.query_pointer()
    trace('frame pointer received')
    x, y = int(pointer.root_x), int(pointer.root_y)
    draw = ImageDraw.Draw(image)
    draw.polygon([(x, y), (x, y + 16), (x + 4, y + 12), (x + 8, y + 19), (x + 11, y + 17), (x + 7, y + 10), (x + 14, y + 10)], fill="#36c896", outline="#10261e")
    buf = io.BytesIO()
    image.save(buf, format="PNG", compress_level=3)
    trace('frame png encoded ' + str(buf.tell()))
    windows = []
    clients = xdisplay.screen().root.get_full_property(xdisplay.intern_atom('_NET_CLIENT_LIST'), 0)
    for wid in list(clients.value)[:32] if clients else []:
        try:
            window = xdisplay.create_resource_object('window', int(wid))
            name = window.get_full_property(xdisplay.intern_atom('_NET_WM_NAME'), xdisplay.intern_atom('UTF8_STRING'))
            title = bytes(name.value).decode('utf-8', errors='replace') if name else str(window.get_wm_name() or '')
            windows.append({'id': int(wid), 'title': title[:250]})
        except Exception:
            continue
    trace('frame windows read')
    temporary = runtime / 'frame.next.png'
    temporary.write_bytes(buf.getvalue())
    temporary.chmod(0o600)
    temporary.replace(runtime / 'frame.png')
    return {"windows": windows, "imageFile": 'frame.png', "width": image.width, "height": image.height, "timestamp": time.time()}


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
    threading.Thread(target=reader, daemon=True).start()
    signal.signal(signal.SIGTERM, lambda *_: ended.set())
    signal.signal(signal.SIGHUP, lambda *_: ended.set())
    try:
        while not ended.is_set() or not requests.empty():
            try:
                request = requests.get(timeout=0.2)
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
                    result = frame()
                elif op == "input":
                    result = input_action(request["action"], identifier)
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
                cancelled.discard(identifier)
    finally:
        cleanup()


if __name__ == "__main__":
    main()
