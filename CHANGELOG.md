# Changelog

## 0.2.1 — DSH 0.2.0-rc.2 compatibility

- Pin all DSH peer/development dependencies and the Host engine to `0.2.0-rc.2`; package checks reject mismatched DSH versions.
- Add real-Cordis Host registration tests for per-call session permission resolution, read-only observation, cancellation and rejection before native process creation.
- Keep desktop owner/epoch, human capability/lease, atomic keypress, raw-hold expiry and native worker behavior unchanged. No native setup, live worker or GUI smoke is part of this compatibility update.
- Document immutable tarball deployment with an explicit stable `runtimeRoot`; switching away from a live source link still needs a save/reload maintenance window.

## 0.2.0 — GUI feedback improvements

- Atomic `press`/modifier chords; a key without `down` defaults to press. Explicit raw agent holds suppress private per-key repeat and expire after a configurable bounded duration (default 1500ms); human repeat/leases are unchanged. Added explicit release and unconfirmed-release quarantine.
- Live tracked launch-process status with exit code and observation time, separate managed-window/focus/modal/held-input diagnostics. Launcher exit is not treated as whole-app exit.
- `desktop_windows`, non-forcing `desktop_focus`, and confirmed WM_DELETE-only `desktop_close_window`; no kill or auto-discard fallback.
- Model screenshots default to fresh capture and include capture id/time/cache state; optional absolute region and cursor exclusion with correct coordinate offsets.
- `desktop_probe` returns fresh composited RGBA samples without the synthetic pointer; not source-image/layer pixels or semantic validation.
- Per-session startup width/height; no live resize or larger default imposed on all users.
- Fixed raw stdin reader shutdown, avoiding Python buffered-reader daemon finalization abort; explicit long D-Bus path diagnostic without host-session fallback.
- Added worker mocks, broker/HTTP/metadata tests, opt-in real native regression, and [GUI operation notes](<docs/gui-pitfalls.md>). Test discovery excludes ignored experiment snapshots.

Unresolved: the reported persistent GIMP Script-Fu freeze was not reproduced. No blanket double-click, forced focus/grab override or force-terminate application behavior was added.

## 0.1.0

Initial independent X11 desktop, official DSH sidebar, six core tools, epoch/capability ownership, user-local native setup and prebuilt Git distribution for DSH 0.1.7-rc.2.
