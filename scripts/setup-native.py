#!/usr/bin/python3
"""Reproduce the reviewed Ubuntu 24.04 amd64 native runtime without root.

Only writes .runtime/. Downloads/extracts signed-index, checksum-pinned Ubuntu
packages (no dpkg install or maintainer scripts) and binary-only pinned wheels.
Does not launch a desktop, install a service, modify profiles, or touch :1.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / ".runtime"
NATIVE = RUNTIME / "native"
VENV = RUNTIME / "venv"
PACKAGES = [
    ("xvfb", "2:21.1.12-1ubuntu1.5", "xvfb_2%3a21.1.12-1ubuntu1.5_amd64.deb", "fe29208e58785efdda1f5c49dad7923c70403f76f9b559c045248921033e193f"),
    ("openbox", "3.6.1-12build5", "openbox_3.6.1-12build5_amd64.deb", "bd27fc0ce0b98ecf29a3e4987744b59590c71f87b0f1bc02175228f155b22c71"),
    ("libobrender32v5", "3.6.1-12build5", "libobrender32v5_3.6.1-12build5_amd64.deb", "832c02836f8b0fb06111cf96827ef90f233d28b63d6f34cda20930b33af74009"),
    ("libobt2v5", "3.6.1-12build5", "libobt2v5_3.6.1-12build5_amd64.deb", "82cb85897e7f0386db66e4a3e0f8442286e6b5b52fade9032f3dbd9de6ee32ff"),
]
WORKER_LOCK = """# Ubuntu Noble amd64, /usr/bin/python3 3.12; binary wheels only.
python-xlib==0.33 --hash=sha256:c3534038d42e0df2f1392a1b30a15a4ff5fdc2b86cfa94f072bf11b10a164398
six==1.17.0 --hash=sha256:4721f391ed90541fddacab5acf947aa0d3dc7d27b2e1e8eda2be8970586c3274
Pillow==11.3.0 --hash=sha256:676b2815362456b5b3216b4fd5bd89d362100dc6f4945154ff172e206a22c024
mss==10.1.0 --hash=sha256:9179c110cadfef5dc6dc4a041a0cd161c74c379218648e6640b48c6b5cfe8918
"""
SELKIES_LOCK = """# Reviewed Selkies 2.0.0, exact resolved Ubuntu amd64 CPython 3.12 wheel hashes.
aiofiles==25.1.0 --hash=sha256:abe311e527c862958650f9438e859c1fa7568a141b22abcd015e120e86a85695
aiohappyeyeballs==2.7.1 --hash=sha256:9243213661e29250eb41368e5daa826fc017156c3b8a11440826b2e3ed376472
aiohttp==3.14.3 --hash=sha256:543906c127fb1d929b95076db19b83fa2d46751006ff1e23b093aa5ac4d8db42
aiosignal==1.4.0 --hash=sha256:053243f8b92b990551949e63930a839ff0cf0b0ebbe0597b0f3fb19e1a0fe82e
attrs==26.1.0 --hash=sha256:c647aa4a12dfbad9333ca4e71fe62ddc36f4e63b2d260a37a8b83d2f043ac309
cffi==2.1.1 --hash=sha256:c1453022f490d2459a11819d83ad1d586e9ff65a12ac3e705ffebd46d3685dcf
cryptography==50.0.2 --hash=sha256:9dab55f57c74c3cad24c323bacbbd04be4705ba6eb0d92e920b1fc4837ed5079
dnspython==2.8.0 --hash=sha256:01d9bbc4a2d76bf0db7c1f729812ded6d912bd318d3b1cf81d30c0f845dbf3af
frozenlist==1.8.0 --hash=sha256:494a5952b1c597ba44e0e78113a7266e656b9794eec897b19ead706bd7074383
google-crc32c==1.9.0 --hash=sha256:3abb18297d9ef0ab120531838be0e6d68c9fa876570e11c229c48f2edac23ce7
idna==3.20 --hash=sha256:ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c
msgpack==1.2.3 --hash=sha256:ede33b2892ceb976283e009ad12fa1834cfdf1f9c43ee9c97849fc588d00a618
multidict==6.9.1 --hash=sha256:976fd7689d69ec78d67d31d38d396d8adb562f7e8368279f76aed4aa451fa06d
nvidia-ml-py==13.615.71 --hash=sha256:959bf4adf6fe1308e4bd739e722236b0d1ec8392e2cefad33ff70c311380b9b6
pcmflux==2.1.0 --hash=sha256:566fbb9e4af3534906adf757e860921679cd9c3cec3894b0de4fc700c75c5a73
pillow==11.3.0 --hash=sha256:676b2815362456b5b3216b4fd5bd89d362100dc6f4945154ff172e206a22c024
pixelflux==2.1.0 --hash=sha256:776bb8e80970a2d07d391cf043b77a6cb203cfdff565dd43713dd07ce9bdf257
prometheus_client==0.26.0 --hash=sha256:fa93d06737aa02bacd05794768508bb97d2fbee28cb3bca04eaae92f0ca953d6
propcache==0.5.4 --hash=sha256:2814ecd8e818f487bee4b0f921bc4d1c176cc5fc71ac0f072d0fa67eda4ac14b
psutil==7.2.2 --hash=sha256:076a2d2f923fd4821644f5ba89f059523da90dc9014e85f8e45a5774ca5bc6f9
pulsectl==24.12.0 --hash=sha256:13a60be940594f03ead3245b3dfe3aff4a3f9a792af347674bde5e716d4f76d2
pulsectl-asyncio==1.3.2 --hash=sha256:aa3adf89fe91a80ec1a5c92de3dcfd17a8f171006a07a2ec59a4a13d031fc70d
pycparser==3.0 --hash=sha256:b727414169a36b7d524c1c3e31839a521725078d7b2ff038656844266160a992
pyee==14.0.0 --hash=sha256:3ac2d3229a9677f7de2c33d7f52fe25b638a46b19c413fea2edc8c6d0a644e4d
pylibsrtp==1.0.0 --hash=sha256:293c9f2ac21a2bd689c477603a1aa235d85cf252160e6715f0101e42a43cbedc
pyOpenSSL==26.4.0 --hash=sha256:f0eb0cb2d581d3ad2b9c489468485e7f2ab6727d08401bcf9d824c3caddf3c1c
selkies==2.0.0 --hash=sha256:f2777e74d191e2b5063190d40bfc6df00d7a77930620e0048a79267f211cbead
typing_extensions==4.16.0 --hash=sha256:481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8
uvloop==0.23.0 --hash=sha256:090865d8ce7a03986755a3ce711b7dd0d4b44eb14ab74368b717f3fad1180208
watchdog==6.0.0 --hash=sha256:20ffe5b202af80ab4266dcd3e91aae72bf2da48c0d33bdb15c66658e685e94e2
yarl==1.25.1 --hash=sha256:c6f117789d22dce188e5754e8bc65b7e6ebf8cb73963b9fa761f672a5883769d
"""
OPENBOX_CONFIG = """<?xml version="1.0" encoding="UTF-8"?>
<!-- Project-owned minimal WM config: no session/autostart commands or desktop services. -->
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <focus><focusNew>yes</focusNew><followMouse>no</followMouse><focusLast>yes</focusLast><underMouse>no</underMouse></focus>
  <placement><policy>Smart</policy><center>yes</center><monitor>Primary</monitor></placement>
  <theme>
    <name>Clearlooks</name><titleLayout>NLIMC</titleLayout><keepBorder>yes</keepBorder><animateIconify>no</animateIconify>
    <font place="ActiveWindow"><name>sans</name><size>10</size><weight>bold</weight></font>
    <font place="InactiveWindow"><name>sans</name><size>10</size></font>
  </theme>
  <desktops><number>1</number><firstdesk>1</firstdesk><names><name>Agent private desktop</name></names></desktops>
  <keyboard>
    <keybind key="A-Tab"><action name="NextWindow"/></keybind>
    <keybind key="A-F4"><action name="Close"/></keybind>
  </keyboard>
  <mouse>
    <dragThreshold>8</dragThreshold><doubleClickTime>300</doubleClickTime>
    <context name="Client">
      <mousebind button="Left" action="Press"><action name="Focus"/><action name="Raise"/></mousebind>
    </context>
    <context name="Titlebar">
      <mousebind button="Left" action="Press"><action name="Focus"/><action name="Raise"/></mousebind>
      <mousebind button="Left" action="Drag"><action name="Move"/></mousebind>
      <mousebind button="Left" action="DoubleClick"><action name="ToggleMaximize"/></mousebind>
    </context>
    <context name="Close"><mousebind button="Left" action="Click"><action name="Close"/></mousebind></context>
    <context name="Maximize"><mousebind button="Left" action="Click"><action name="ToggleMaximize"/></mousebind></context>
    <context name="Iconify"><mousebind button="Left" action="Click"><action name="Iconify"/></mousebind></context>
    <context name="Bottom"><mousebind button="Left" action="Drag"><action name="Resize"/></mousebind></context>
    <context name="BLCorner"><mousebind button="Left" action="Drag"><action name="Resize"/></mousebind></context>
    <context name="BRCorner"><mousebind button="Left" action="Drag"><action name="Resize"/></mousebind></context>
  </mouse>
  <menu><showIcons>no</showIcons></menu>
  <applications/>
</openbox_config>
"""


def clean_env():
    env = dict(os.environ)
    for key in list(env):
        if key in ("LD_PRELOAD", "LD_LIBRARY_PATH", "PYTHONPATH", "PYTHONHOME", "DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY") or key.startswith(("SELKIES_", "PIXELFLUX_")):
            env.pop(key, None)
    env.update(PATH="/usr/bin:/bin", PYTHONNOUSERSITE="1")
    return env


ENV = clean_env()


def run(args, **kwargs):
    print("+ " + " ".join(map(str, args)), flush=True)
    return subprocess.run(list(map(str, args)), check=True, env=ENV, **kwargs)


def put(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Preserve unchanged generated configuration (run setup before starting sessions).
    if path.exists() and path.read_text() == text:
        return
    path.write_text(text)


def sha256(path: Path):
    with path.open("rb") as fh:
        return hashlib.file_digest(fh, "sha256").hexdigest()


def preflight():
    if os.geteuid() == 0:
        raise RuntimeError("Run as the intended desktop user, not root")
    if platform.machine() != "x86_64":
        raise RuntimeError("This lock was reviewed for Ubuntu 24.04 amd64 only")
    release = Path("/etc/os-release").read_text()
    if 'ID=ubuntu' not in release or 'VERSION_ID="24.04"' not in release:
        raise RuntimeError("This native package lock requires Ubuntu 24.04")
    version = run(["/usr/bin/python3", "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"], capture_output=True, text=True).stdout.strip()
    if version != "3.12":
        raise RuntimeError("The wheel hashes are pinned for the host /usr/bin/python3 3.12")
    for path in ("/usr/bin/xterm", "/usr/bin/xauth", "/usr/bin/xdpyinfo", "/usr/bin/dbus-run-session", "/usr/bin/dpkg-deb"):
        if not os.access(path, os.X_OK):
            raise RuntimeError(f"Required existing host prerequisite missing: {path}; no system install will be attempted")


def prepare_packages(offline: bool):
    downloads = NATIVE / "downloads"
    audit = NATIVE / "audit"
    downloads.mkdir(parents=True, exist_ok=True)
    audit.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name, version, filename, expected in PACKAGES:
        path = downloads / filename
        if not path.exists():
            if offline:
                raise RuntimeError(f"Offline artifact missing: {path}")
            run(["/usr/bin/apt-get", "-o", "Acquire::Retries=0", "-o", "Acquire::http::Timeout=30", "download", f"{name}={version}"], cwd=downloads)
        actual = sha256(path)
        if actual != expected:
            raise RuntimeError(f"SHA256 mismatch for {filename}; refusing extraction")
        metadata = run(["/usr/bin/dpkg-deb", "--info", path], capture_output=True, text=True).stdout
        contents = run(["/usr/bin/dpkg-deb", "--contents", path], capture_output=True, text=True).stdout
        put(audit / f"{filename[:-4]}.control.txt", metadata)
        put(audit / f"{filename[:-4]}.contents.txt", contents)
        manifest.append({"package": name, "version": version, "filename": filename, "sha256": actual})
    put(audit / "native-packages.json", json.dumps(manifest, indent=2) + "\n")
    return [downloads / item[2] for item in PACKAGES]


def prepare_wheels(python: Path, lock: Path, wheelhouse: Path, offline: bool):
    wheelhouse.mkdir(parents=True, exist_ok=True)
    if not offline:
        run([python, "-m", "pip", "--isolated", "--disable-pip-version-check", "--no-cache-dir", "download",
             "--index-url", "https://pypi.org/simple", "--only-binary=:all:", "--no-deps", "--require-hashes",
             "--dest", wheelhouse, "-r", lock])
    # Save metadata/source entry points as data before any package import.
    audit = wheelhouse.parent / (wheelhouse.name + "-audit")
    audit.mkdir(parents=True, exist_ok=True)
    wheel_records = []
    expected_hashes = {line.split("--hash=sha256:", 1)[1].strip() for line in lock.read_text().splitlines() if "--hash=sha256:" in line}
    seen_hashes = set()
    for wheel in sorted(wheelhouse.glob("*.whl")):
        digest = sha256(wheel)
        if digest not in expected_hashes:
            raise RuntimeError(f"Unpinned or corrupt wheel: {wheel.name}; refusing install")
        seen_hashes.add(digest)
        with ZipFile(wheel) as archive:
            entries = archive.namelist()
            if any(n.endswith(".pth") for n in entries):
                raise RuntimeError(f"Wheel contains executable path hook; review before using: {wheel.name}")
            for name in entries:
                if name.endswith(("/METADATA", "/entry_points.txt", "/WHEEL", "/__init__.py")) or (name.startswith("selkies/") and name.endswith(".py")):
                    target = (audit / name).resolve()
                    if not target.is_relative_to(audit.resolve()):
                        raise RuntimeError("Unsafe wheel member path")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.read(name))
        wheel_records.append({"file": wheel.name, "sha256": digest, "size": wheel.stat().st_size})
    if seen_hashes != expected_hashes:
        raise RuntimeError("Missing pinned wheels; rerun without --offline to prepare them")
    put(audit / "wheels.json", json.dumps(wheel_records, indent=2) + "\n")


def install_wheels(python: Path, lock: Path, wheelhouse: Path):
    run([python, "-m", "pip", "--isolated", "--disable-pip-version-check", "install", "--no-index", "--no-deps",
         "--find-links", wheelhouse, "--only-binary=:all:", "--require-hashes", "-r", lock])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Reuse cached, hash-verified artifacts; no network")
    parser.add_argument("--prepare-only", action="store_true", help="Download and inventory only; do not extract/install")
    parser.add_argument("--with-selkies", action="store_true", help="Also prepare/install the optional pinned Selkies 2.0 wheel stack (about 55 MB)")
    args = parser.parse_args()
    os.umask(0o077)
    preflight()
    for path in (RUNTIME, NATIVE, RUNTIME / "wheels", RUNTIME / "tmp", RUNTIME / "pycache"):
        path.mkdir(parents=True, exist_ok=True)
    ENV.update(TMPDIR=str(RUNTIME / "tmp"), PYTHONPYCACHEPREFIX=str(RUNTIME / "pycache"))
    if not (VENV / "bin/python").exists():
        run(["/usr/bin/python3", "-m", "venv", VENV])
    python = VENV / "bin/python"
    lock = RUNTIME / "requirements-native.lock"
    put(lock, WORKER_LOCK)
    packages = prepare_packages(args.offline)
    prepare_wheels(python, lock, RUNTIME / "wheels", args.offline)
    selkies_lock = RUNTIME / "requirements-selkies.lock"
    if args.with_selkies:
        put(selkies_lock, SELKIES_LOCK)
        prepare_wheels(python, selkies_lock, RUNTIME / "selkies/wheels", args.offline)
    if args.prepare_only:
        print("Prepared only; inspect .runtime/native/audit, .runtime/wheels-audit and optional .runtime/selkies/wheels-audit before installation.")
        return 0
    for path in packages:
        run(["/usr/bin/dpkg-deb", "--extract", path, NATIVE])
    install_wheels(python, lock, RUNTIME / "wheels")
    if args.with_selkies:
        install_wheels(python, selkies_lock, RUNTIME / "selkies/wheels")
        run([python, "-m", "pip", "--isolated", "--disable-pip-version-check", "check"])
        run([VENV / "bin/selkies", "--version"])
    library = NATIVE / "usr/lib/x86_64-linux-gnu"
    for binary in (NATIVE / "usr/bin/Xvfb", NATIVE / "usr/bin/openbox"):
        check = subprocess.run(["/usr/bin/ldd", str(binary)], env={**ENV, "LD_LIBRARY_PATH": str(library)}, capture_output=True, text=True, check=True)
        put(NATIVE / "audit" / (binary.name + ".ldd.txt"), check.stdout + check.stderr)
        if "not found" in check.stdout:
            raise RuntimeError(f"Unresolved host library for {binary.name}; see .runtime/native/audit. No system install attempted.")
    put(NATIVE / "openbox-rc.xml", OPENBOX_CONFIG)
    prior = json.loads((RUNTIME / "native.json").read_text()) if (RUNTIME / "native.json").exists() else {}
    native = {
        "python": str(python), "xvfb": str(NATIVE / "usr/bin/Xvfb"),
        "windowManager": str(NATIVE / "usr/bin/openbox"),
        "windowManagerArgs": ["--sm-disable", "--config-file", str(NATIVE / "openbox-rc.xml")],
        "terminal": "/usr/bin/xterm", "libraryPath": str(library), "binaryPath": str(NATIVE / "usr/bin"),
        "dataDirs": str(NATIVE / "usr/share") + ":/usr/local/share:/usr/share", "selkies": str(VENV / "bin/selkies") if args.with_selkies else prior.get("selkies"),
        "versions": {**prior.get("versions", {}), "xvfb": PACKAGES[0][1], "openbox": PACKAGES[1][1], "python": platform.python_version(),
                     "xterm": run(["/usr/bin/dpkg-query", "-W", "-f=${Version}", "xterm"], capture_output=True, text=True).stdout.strip(),
                     "python-xlib": "0.33", "Pillow": "11.3.0", "mss": "10.1.0"},
    }
    if args.with_selkies:
        native["versions"].update(selkies="2.0.0", pixelflux="2.1.0", pcmflux="2.1.0")
    put(RUNTIME / "native.json", json.dumps(native, indent=2) + "\n")
    run([python, "-c", "import Xlib, PIL, mss; print('Native imports:', Xlib.__version_string__, PIL.__version__, mss.__version__)"])
    print("Ready: " + str(RUNTIME / "native.json"))
    print("No desktop started. Run .runtime/venv/bin/python scripts/probe-native.py as a managed job for acceptance.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
