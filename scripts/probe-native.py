#!/usr/bin/env python3
"""Bounded, own-process-only private X11 acceptance probe; never inject into :1.

Invoke with .runtime/venv/bin/python scripts/probe-native.py from a managed job.
The parent plugin owns the production worker. This is a separate disposable test.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import select
import signal
import socket
import struct
import stat
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / ".runtime"


def dump(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n")
    path.chmod(0o600)


def auth_record(family: int, address: bytes, number: bytes, cookie: bytes) -> bytes:
    fields = (address, number, b"MIT-MAGIC-COOKIE-1", cookie)
    return struct.pack(">H", family) + b"".join(struct.pack(">H", len(v)) + v for v in fields)


def wait_until(test, timeout: float = 12.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = test()
        if result:
            return result
        time.sleep(0.05)
    raise TimeoutError("Probe readiness condition timed out")


def terminal_child(receipt: Path) -> int:
    print("AGENT PRIVATE NATIVE DESKTOP", flush=True)
    print("Existing host xterm; isolated Xvfb + Openbox + D-Bus", flush=True)
    print(f"UID: {os.getuid()}   working directory: {ROOT}", flush=True)
    print(f"DISPLAY: {os.environ['DISPLAY']}   Python: {sys.version.split()[0]}", flush=True)
    print("No audio / clipboard / gamepad / physical input forwarding", flush=True)
    print("\nAwaiting unattended XTEST input: ", end="", flush=True)
    text = sys.stdin.readline().rstrip("\n")
    dump(receipt, {"text": text, "display": os.environ["DISPLAY"], "uid": os.getuid(), "pid": os.getpid()})
    print(f"\nReceived: {text}\nINPUT ROUNDTRIP PASS", flush=True)
    while True:
        signal.pause()


def desktop_child(run: Path) -> int:
    run = run.resolve()
    if (not run.is_relative_to((RUNTIME / "probes").resolve())
            or os.environ.get("DISPLAY", "") in ("", ":1", ":1.0")
            or os.environ.get("XAUTHORITY") != str(run / "client.Xauthority")
            or not (run / "server.Xauthority").is_file()):
        raise RuntimeError("Desktop child requires this probe's private display and authority")
    native = json.loads((RUNTIME / "native.json").read_text())
    wm_log = (run / "openbox.log").open("w")
    term_log = (run / "xterm.log").open("w")
    wm = subprocess.Popen([native["windowManager"], *native["windowManagerArgs"]], stdout=wm_log, stderr=subprocess.STDOUT)
    subprocess.run(["/usr/bin/xsetroot", "-solid", "#1b2436"], check=True)
    terminal = subprocess.Popen([
        native["terminal"], "-T", "Agent Native Probe", "-fa", "DejaVu Sans Mono", "-fs", "13",
        "-geometry", "96x24+40+40", "-bg", "#101827", "-fg", "#dbeafe",
        "-xrm", "XTerm*allowWindowOps:false", "-e", sys.executable, str(Path(__file__).resolve()),
        "--terminal-child", str(run / "input-receipt.json"),
    ], stdout=term_log, stderr=subprocess.STDOUT)
    dump(run / "desktop.json", {"desktopPid": os.getpid(), "desktopPgid": os.getpgrp(),
         "windowManagerPid": wm.pid, "terminalPid": terminal.pid,
         "dbusAddress": os.environ["DBUS_SESSION_BUS_ADDRESS"], "display": os.environ["DISPLAY"]})
    try:
        while wm.poll() is None and terminal.poll() is None:
            time.sleep(0.2)
        return 1
    finally:
        for proc in (terminal, wm):
            if proc.poll() is None:
                proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()


def observe_host():
    """Read coordinates/focus IDs only; deliberately no host screenshot/window text."""
    from Xlib import display
    human_display = os.environ.get("DISPLAY")
    if not human_display:
        return None, {"available": False, "reason": "No inherited display for read-only query"}
    try:
        connection = display.Display(human_display)
        return connection, query_pointer_focus(connection, human_display)
    except Exception as exc:
        return None, {"available": False, "reason": type(exc).__name__}


def query_pointer_focus(connection, name):
    pointer = connection.screen().root.query_pointer()
    focus = connection.get_input_focus()
    return {"available": True, "display": name, "pointer": [pointer.root_x, pointer.root_y],
            "pointerMask": pointer.mask, "focus": getattr(focus.focus, "id", focus.focus)}


def infrastructure_env(native, run: Path):
    env = dict(os.environ)
    drop = {"DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "DBUS_SESSION_BUS_ADDRESS",
            "DBUS_STARTER_ADDRESS", "DBUS_STARTER_BUS_TYPE", "SESSION_MANAGER", "XDG_SESSION_ID",
            "XDG_CURRENT_DESKTOP", "DESKTOP_SESSION", "XDG_SESSION_DESKTOP", "XDG_SEAT", "XDG_VTNR",
            "LD_PRELOAD", "LD_LIBRARY_PATH", "PYTHONPATH", "PYTHONHOME", "QT_PLUGIN_PATH",
            "QT_QPA_PLATFORM_PLUGIN_PATH", "GTK_MODULES", "GTK_PATH", "GDK_BACKEND"}
    for key in list(env):
        if key in drop or key.startswith(("SELKIES_", "PIXELFLUX_", "PULSE_", "PIPEWIRE_", "DBUS_")):
            env.pop(key, None)
    env.update({"XDG_RUNTIME_DIR": str(run), "XDG_SESSION_TYPE": "x11", "XDG_CURRENT_DESKTOP": "Openbox",
                "XDG_CONFIG_HOME": str(run / "config"), "XDG_CACHE_HOME": str(run / "cache"),
                "XDG_DATA_DIRS": native["dataDirs"], "LD_LIBRARY_PATH": native["libraryPath"],
                "PATH": native["binaryPath"] + ":/usr/bin:/bin", "LIBGL_ALWAYS_SOFTWARE": "1",
                "GDK_BACKEND": "x11", "QT_QPA_PLATFORM": "xcb", "PYTHONNOUSERSITE": "1",
                "PULSE_SERVER": "unix:" + str(run / "audio-disabled"),
                "PULSE_RUNTIME_PATH": str(run / "audio-disabled"), "PIPEWIRE_RUNTIME_DIR": str(run)})
    for subdir in ("config", "cache"):
        (run / subdir).mkdir(mode=0o700)
    return env


def selkies_probe(native, run: Path, env, spawn, private, host, host_name):
    """Attach reviewed Selkies to THIS disposable display, never selkies-session."""
    import asyncio
    import base64
    from http import client as http_client
    import io
    import re
    import secrets
    from Xlib import X
    from PIL import Image

    class UnixConnection(http_client.HTTPConnection):
        def connect(self):
            self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            self.sock.settimeout(self.timeout)
            self.sock.connect(str(run / "selkies.sock"))

    def http(method, path, body=None, token=None):
        conn = UnixConnection("localhost", timeout=10)
        headers = {}
        if body is not None:
            body = json.dumps(body)
            headers["Content-Type"] = "application/json"
        if token is not None:
            headers["Authorization"] = "Bearer " + token
        try:
            conn.request(method, path, body, headers)
            response = conn.getresponse()
            return response.status, response.read()
        finally:
            conn.close()

    token = secrets.token_hex(32)  # memory only; never log/persist or return it
    sel_env = dict(env)
    for key in ("PASSWORD", "PASSWD", "VIEWONLY_PASSWORD", "CUSTOM_USER", "USERNAME"):
        sel_env.pop(key, None)
    sel_env["SELKIES_MASTER_TOKEN"] = token
    # Explicit session-private paths avoid the package's HOME/Desktop/print defaults.
    args = [str(RUNTIME / "venv/bin/selkies"), "--unix-socket=" + str(run / "selkies.sock"),
            "--computer-use-bind=127.0.0.1:0", "--enable-basic-auth=false", "--enable-https=false",
            "--mode=websockets", "--enable-dual-mode=false", "--encoder=jpeg", "--framerate=10-10",
            "--auto-gpu=false", "--gpu-id=-1", "--audio-enabled=false", "--microphone-enabled=false",
            "--webcam-enabled=false", "--webcam-device=false", "--gamepad-enabled=false",
            "--gamepad-on-start=false", "--uinput-gamepad=false", "--publish-input-devices=false",
            "--enable-clipboard=false", "--enable-binary-clipboard=false", "--clipboard-seamless=false",
            "--command-enabled=false", "--file-transfers=none", "--printing-enabled=false",
            "--enable-player2=false", "--enable-player3=false", "--enable-player4=false",
            "--second-screen=false", "--enable-resize=false", "--enable-collab=false",
            "--file-manager-path=" + str(run / "files"), "--print-spool-path=" + str(run / "print"),
            "--js-socket-path=" + str(run), "--webcam-socket-path=" + str(run), "--wayland=false"]
    string_false_flags = {"--auto-gpu", "--uinput-gamepad", "--webcam-device", "--enable-clipboard"}
    args = [arg + "|locked" if arg.endswith("=false") and arg.split("=", 1)[0] not in string_false_flags else arg for arg in args]
    nodes_before = sorted(p.name for p in Path("/sys/class/input").iterdir())
    before = query_pointer_focus(host, host_name) if host else None
    proc = spawn(args, sel_env, "selkies")
    proof = {"pid": proc.pid, "processGroup": proc.pid, "display": env["DISPLAY"],
             "streamingSocket": str(run / "selkies.sock"), "flags": args[1:], "viewerConnectedForInitialSnapshot": False}

    def ready():
        if proc.poll() is not None:
            raise RuntimeError(f"Selkies exited {proc.returncode}; inspect {run / 'selkies.log'}")
        if not (run / "selkies.sock").exists():
            return False
        try:
            return http("GET", "/api/health")[0] == 200
        except (OSError, http_client.HTTPException):
            return False

    wait_until(ready, 60)
    proof["anonymousHealthStatus"] = http("GET", "/api/health")[0]
    proof["anonymousScreenshotStatus"] = http("GET", "/api/screenshot")[0]
    proof["wrongBearerScreenshotStatus"] = http("GET", "/api/screenshot", token="incorrect-probe-token")[0]
    status, png = http("GET", "/api/screenshot", token=token)
    proof["authenticatedScreenshotStatus"] = status
    assert proof["anonymousScreenshotStatus"] == 401 and proof["wrongBearerScreenshotStatus"] == 401
    assert status == 200 and png.startswith(b"\x89PNG")
    (run / "selkies-http.png").write_bytes(png)
    proof["httpScreenshotSize"] = list(Image.open(io.BytesIO(png)).size)
    # The CU listener is deliberately loopback-only and bounded to this test lifecycle.
    match = wait_until(lambda: re.search(r"ComputerUse\] Server listening on 127\.0\.0\.1:(\d+)", (run / "selkies.log").read_text()), 10)
    port = int(match.group(1))
    proof["cuLoopbackPort"] = port

    def cu(body, path="/computer-use"):
        conn = http_client.HTTPConnection("127.0.0.1", port, timeout=15)
        try:
            # An invalid Bearer is intentional: this test proves CU has NO auth gate.
            conn.request("POST", path, json.dumps(body), {"Content-Type": "application/json", "Authorization": "Bearer incorrect-probe-token"})
            response = conn.getresponse()
            return response.status, json.loads(response.read())
        finally:
            conn.close()

    status, data = cu({"action": "screenshot"})
    assert status == 200 and "data" in data
    (run / "selkies-cu.png").write_bytes(base64.b64decode(data["data"]))
    proof["cuIgnoresInvalidBearer"] = True
    proof["cuPauseResponse"] = cu({"action": "pause"})
    assert "Unknown action" in proof["cuPauseResponse"][1].get("error", "")
    proof["cuPathValidationResponse"] = cu({"action": "cursor_position"}, "/not-a-cu-route")
    receipt = run / "selkies-input-receipt.json"
    term = spawn([native["terminal"], "-u8", "-T", "Selkies Native Input Probe", "-fa", "DejaVu Sans Mono", "-fs", "13",
                  "-geometry", "96x24+40+40", "-bg", "#101827", "-fg", "#dbeafe", "-e", sys.executable,
                  str(Path(__file__).resolve()), "--terminal-child", str(receipt)], env, "selkies-xterm")
    proof["terminalPid"] = term.pid
    client_atom = private.intern_atom("_NET_CLIENT_LIST")

    def focused_terminal():
        private.sync()
        clients = private.screen().root.get_full_property(client_atom, X.AnyPropertyType)
        if clients:
            for ident in clients.value:
                window = private.create_resource_object("window", int(ident))
                if window.get_wm_name() == "Selkies Native Input Probe" and private.get_input_focus().focus == window:
                    return window
        return None

    wait_until(focused_terminal)
    time.sleep(0.3)
    assert cu({"action": "left_click", "coordinate": [180, 150]})[1] == {"result": "ok"}
    expected = "selkies native ok \u2713 \u4e2d\u6587"
    assert cu({"action": "type", "text": expected})[1] == {"result": "ok"}
    assert cu({"action": "key", "text": "Return"})[1] == {"result": "ok"}
    wait_until(receipt.exists)
    proof["inputReceipt"] = json.loads(receipt.read_text())
    assert proof["inputReceipt"]["text"] == expected
    status, png = http("GET", "/api/screenshot", token=token)
    assert status == 200
    (run / "selkies-after-input.png").write_bytes(png)
    proof["hostAfterInput"] = query_pointer_focus(host, host_name) if host else None
    proof["hostBeforeInput"] = before
    proof["hostInputUnchanged"] = proof["hostAfterInput"] == before if host else None

    # A provisioned read-only viewer can request streaming with no controller page.
    viewer_token = secrets.token_hex(24)
    status, _ = http("POST", "/api/tokens", {viewer_token: {"role": "viewer", "mk_control": False}}, token)
    assert status == 200

    async def receive_stream():
        import aiohttp
        events = []
        async with aiohttp.ClientSession(connector=aiohttp.UnixConnector(path=str(run / "selkies.sock"))) as session:
            async with session.ws_connect("http://localhost/api/websockets?token=" + viewer_token, timeout=10) as ws:
                await ws.send_str("START_VIDEO")
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    msg = await ws.receive(timeout=10)
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        # Never retain large settings payloads or session credentials.
                        if msg.data.startswith(("AUTH_SUCCESS", "MODE ", "MK_ACCESS", "PIPELINE_RESETTING", "VIDEO_")):
                            events.append(msg.data)
                    elif msg.type == aiohttp.WSMsgType.BINARY and msg.data and msg.data[0] in (3, 4):
                        data = bytes(msg.data)
                        (run / "selkies-video-packet.bin").write_bytes(data)
                        info = {"packetType": data[0], "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "events": events}
                        offset = data.find(b"\xff\xd8")
                        if data[0] == 3 and offset >= 0:
                            image = Image.open(io.BytesIO(data[offset:]))
                            image.load()
                            info["decodedJpegStripe"] = list(image.size)
                            image.save(run / "selkies-first-stripe.png")
                        await ws.send_str("STOP_VIDEO")
                        return info
                    elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        raise RuntimeError("Selkies viewer closed before delivering video")
        raise TimeoutError("No Selkies video packet received")

    try:
        proof["websocketStream"] = asyncio.run(receive_stream())
    except Exception as exc:
        proof["streamErrorType"] = type(exc).__name__
        dump(run / "selkies-result.json", proof)
        # aiohttp exception text may contain a URL token: retain type only.
        raise RuntimeError("Selkies WebSocket probe failed: " + type(exc).__name__) from None
    proof["snapshotAfterViewerDisconnect"] = http("GET", "/api/screenshot", token=token)[0]
    assert proof["snapshotAfterViewerDisconnect"] == 200
    proof["inputNodesUnchanged"] = nodes_before == sorted(p.name for p in Path("/sys/class/input").iterdir())
    fds = []
    for fd in Path(f"/proc/{proc.pid}/fd").iterdir():
        try:
            target = os.readlink(fd)
        except OSError:
            continue
        if target.startswith(("/dev/input", "/dev/uinput")):
            fds.append(target)
    proof["kernelInputDeviceFds"] = fds
    assert not fds
    proof["passed"] = True
    dump(run / "selkies-result.json", proof)
    return proof


def probe(selkies_enabled: bool = False) -> int:
    from Xlib import X, XK, display
    from Xlib.ext import xtest
    from PIL import Image
    import mss

    native = json.loads((RUNTIME / "native.json").read_text())
    (RUNTIME / "probes").mkdir(exist_ok=True, mode=0o700)
    run = Path(tempfile.mkdtemp(prefix="native-", dir=RUNTIME / "probes"))
    run.chmod(0o700)
    os.umask(0o077)
    started = []
    private = None
    host, before = observe_host()
    host_name = before.get("display")
    result = {"runtime": str(run), "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
              "hostBefore": before, "native": native, "probePid": os.getpid()}
    old_auth = os.environ.get("XAUTHORITY")
    logs = []

    def spawn(args, env, name, **kwargs):
        log = (run / f"{name}.log").open("w")
        logs.append(log)
        p = subprocess.Popen(args, env=env, cwd=ROOT, start_new_session=True,
                             stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, **kwargs)
        started.append(p)
        return p

    def on_signal(signum, _frame):
        raise InterruptedError(f"Signal {signum}; cleanup own probe process groups")

    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, on_signal)

    try:
        env = infrastructure_env(native, run)
        cookie = os.urandom(16)
        server_auth = run / "server.Xauthority"
        client_auth = run / "client.Xauthority"
        server_auth.write_bytes(auth_record(65535, b"", b"", cookie))
        server_auth.chmod(0o600)
        read_fd, write_fd = os.pipe()
        try:
            xvfb = spawn([native["xvfb"], "-displayfd", str(write_fd), "-auth", str(server_auth),
                          "-screen", "0", "1280x720x24", "-nolisten", "tcp", "-noreset",
                          "+extension", "XTEST", "+extension", "RANDR"], env, "xvfb", pass_fds=(write_fd,))
        finally:
            os.close(write_fd)
        try:
            if not select.select([read_fd], [], [], 15)[0]:
                raise TimeoutError("Xvfb -displayfd not ready")
            number = os.read(read_fd, 64).decode().strip()
        finally:
            os.close(read_fd)
        if not number.isdecimal() or number == "1" or f":{number}" == host_name:
            raise RuntimeError("Refuse invalid / human display from Xvfb")
        own_display = f":{number}"
        client_auth.write_bytes(auth_record(256, socket.gethostname().encode(), number.encode(), cookie))
        client_auth.chmod(0o600)
        env.update(DISPLAY=own_display, XAUTHORITY=str(client_auth))
        os.environ["XAUTHORITY"] = str(client_auth)
        private = display.Display(own_display)
        assert private.has_extension("XTEST")
        private.sync()
        result.update({"display": own_display, "xvfbPid": xvfb.pid, "xvfbPgid": xvfb.pid,
                       "authorityMode": oct(client_auth.stat().st_mode & 0o777),
                       "runtimeMode": oct(run.stat().st_mode & 0o777), "xtest": True})
        bad_auth = run / "wrong.Xauthority"
        bad_auth.write_bytes(auth_record(256, socket.gethostname().encode(), number.encode(), os.urandom(16)))
        bad_auth.chmod(0o600)
        denied = subprocess.run(["/usr/bin/xdpyinfo"], env={**env, "XAUTHORITY": str(bad_auth)}, capture_output=True, timeout=5)
        result["wrongCookieRejected"] = denied.returncode != 0
        assert result["wrongCookieRejected"], "Incorrect Xauthority unexpectedly admitted"
        bad_auth.unlink()
        desktop = spawn(["/usr/bin/dbus-run-session", "--", sys.executable, str(Path(__file__).resolve()),
                         "--desktop-child", str(run)], env, "desktop")
        wait_until(lambda: (run / "desktop.json").exists())
        result.update(json.loads((run / "desktop.json").read_text()))
        env["DBUS_SESSION_BUS_ADDRESS"] = result["dbusAddress"]
        result["dbusRunSessionPid"] = desktop.pid
        result["dbusProcessGroup"] = desktop.pid
        result["dbusPrivate"] = result["dbusAddress"] != os.environ.get("DBUS_SESSION_BUS_ADDRESS")
        dump(run / "live.json", result)
        dump(RUNTIME / "probe-native-current.json", {"runtime": str(run), "probePid": os.getpid(),
             "display": own_display, "xvfbPid": xvfb.pid, "desktopGroup": desktop.pid})
        print(json.dumps({"event": "ready", "runtime": str(run), "display": own_display,
                          "xvfbPid": xvfb.pid, "desktopGroup": desktop.pid}), flush=True)
        atom = private.intern_atom("_NET_CLIENT_LIST")

        def find_terminal():
            private.sync()
            clients = private.screen().root.get_full_property(atom, X.AnyPropertyType)
            if clients:
                for ident in clients.value:
                    window = private.create_resource_object("window", int(ident))
                    if window.get_wm_name() == "Agent Native Probe":
                        return window
            return None

        window = wait_until(find_terminal)
        wait_until(lambda: private.get_input_focus().focus == window)
        time.sleep(0.3)  # let terminal paint once after its focus event
        root = private.screen().root
        img = root.get_image(0, 0, 1280, 720, X.ZPixmap, 0xFFFFFFFF)
        Image.frombytes("RGB", (1280, 720), img.data, "raw", "BGRX").save(run / "before.png")
        before_action = query_pointer_focus(host, host_name) if host else before
        # Explicit private connection ONLY. No host injection API is called anywhere.
        xtest.fake_input(private, X.MotionNotify, x=180, y=150)
        xtest.fake_input(private, X.ButtonPress, 1)
        xtest.fake_input(private, X.ButtonRelease, 1)
        expected = "native probe ok"
        for char in expected:
            keysym = XK.string_to_keysym("space" if char == " " else char)
            keycode = private.keysym_to_keycode(keysym)
            assert keycode
            xtest.fake_input(private, X.KeyPress, keycode)
            xtest.fake_input(private, X.KeyRelease, keycode)
        keycode = private.keysym_to_keycode(XK.string_to_keysym("Return"))
        xtest.fake_input(private, X.KeyPress, keycode)
        xtest.fake_input(private, X.KeyRelease, keycode)
        private.sync()
        wait_until(lambda: (run / "input-receipt.json").exists())
        receipt = json.loads((run / "input-receipt.json").read_text())
        result["inputReceipt"] = receipt
        assert receipt["text"] == expected
        after_action = query_pointer_focus(host, host_name) if host else before
        result["hostBeforeInput"] = before_action
        result["hostAfterInput"] = after_action
        result["hostInputUnchanged"] = before_action == after_action if host else None
        result["privatePointerFocus"] = query_pointer_focus(private, own_display)
        time.sleep(0.2)
        with mss.mss(display=own_display, with_cursor=False) as capture:
            frame = capture.grab({"left": 0, "top": 0, "width": 1280, "height": 720})
            Image.frombytes("RGB", frame.size, frame.rgb).save(run / "after.png")
        result["capture"] = {"methods": ["Xlib XGetImage", "mss XGetImage"], "width": 1280, "height": 720,
                             "viewerConnected": False, "afterPngSha256": hashlib.sha256((run / "after.png").read_bytes()).hexdigest()}
        result["captureChanged"] = (run / "before.png").read_bytes() != (run / "after.png").read_bytes()
        if selkies_enabled:
            result["selkies"] = selkies_probe(native, run, env, spawn, private, host, host_name)
        glx = subprocess.run(["/usr/bin/glxinfo", "-B"], env=env, capture_output=True, text=True, timeout=20)
        (run / "glxinfo.txt").write_text(glx.stdout + glx.stderr)
        result["glxinfoExit"] = glx.returncode
        result["hostAfter"] = query_pointer_focus(host, host_name) if host else before
        result["hostWholeProbeUnchanged"] = result["hostAfter"] == before if host else None
        result["passed"] = True
    except Exception as exc:
        result["passed"] = False
        result["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        if private:
            private.close()
        if host:
            host.close()
        if old_auth is None:
            os.environ.pop("XAUTHORITY", None)
        else:
            os.environ["XAUTHORITY"] = old_auth
        stopped = []
        for proc in reversed(started):
            if proc.poll() is None:
                try:
                    os.killpg(proc.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.wait()
            stopped.append({"pid": proc.pid, "exitCode": proc.returncode})
        for log in logs:
            log.close()
        for auth in run.glob("*.Xauthority"):
            auth.unlink(missing_ok=True)
        # Upstream Selkies leaves idle interposer socket names after process exit.
        # This mkdtemp directory belongs only to this probe; never unlink live/foreign sockets.
        for entry in run.iterdir():
            if stat.S_ISSOCK(entry.lstat().st_mode):
                entry.unlink()
        result["stopped"] = stopped
        result["authorityRemoved"] = not list(run.glob("*.Xauthority"))
        dump(run / "result.json", result)
        dump(RUNTIME / "probe-native-current.json", {"runtime": str(run), "finished": True,
             "passed": result.get("passed", False), "stopped": stopped})
        print(json.dumps({"event": "finished", "runtime": str(run), "passed": result.get("passed"), "stopped": stopped}), flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selkies", action="store_true", help="Also validate optional reviewed Selkies runtime on the private display")
    parser.add_argument("--desktop-child", type=Path, help=argparse.SUPPRESS)
    parser.add_argument("--terminal-child", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.desktop_child:
        return desktop_child(args.desktop_child)
    if args.terminal_child:
        return terminal_child(args.terminal_child)
    return probe(args.selkies)


if __name__ == "__main__":
    raise SystemExit(main())
