# Desktop sidebar frontend

This directory is the Chinese, session-scoped browser half of `dsh-agent-desktop`. Its package client entry exports only the named Cordis `apply` and `inject`. The Host and build configuration are owned outside this directory.

## DSH composition

The plugin registers kind `agent-desktop`, implementation id `dsh-agent-desktop`, and a guide entry through official `sidebarRightTabs`. Its body waits for the keyed `sidebar.right.pane.tab` declaration with `slots.inject`. The session comes from that slot's injection argument; components read framework `useTabInfo`, `useDesktopState`, and the localized `t` seat, never Cordis or a globally selected session.

The React-free controller exposes its private observable through `inject.hooks`. Controls and lifecycle operations are injected callbacks. CSS Modules compile to the parent-owned client stylesheet, loaded by an effect-scoped link to `/api/agent-desktop/style.css`.

## Ownership and input

Opening or restoring a tab only observes. A successful explicit takeover must return a newer human epoch and a one-shot `controlToken`. The controller retains the token privately, projects it out of all status/observable data, and sends it only in `X-Desktop-Control` headers for input, human status renewal, and release. A second pane or a page refresh cannot obtain input authority from public `owner:human` status alone.

Input additionally requires a visible tab, active DSH connection, fresh status, and a decoded same-epoch PNG with matching fixed resolution. A queued mutation is never retried. Changed epochs, failure, disconnection, blur, hidden tabs, and disposal withdraw the local capability. Best-effort release invalidates Host input without stopping applications; the Host human lease timeout is required for abrupt browser/process loss.

Status polling is non-overlapping at 1500 ms; PNG polling is non-overlapping at 500 ms. Hidden browser/sidebar tabs stop polling and discard object URLs. The remote resolution never follows sidebar resizing. Pointer coordinates undo centered `object-fit: contain` letterboxes, reject initial clicks in bars, and clamp an already captured drag's final position.

Keyboard handlers live on the focusable preview only. Shift+Escape relinquishes control. The separate local text draft supports native Chinese/IME composition and submits at most 4000 UTF-16 characters only after an explicit Send or non-composing Ctrl/Meta+Enter. Browser-reserved shortcuts may remain local. No clipboard synchronization, audio, camera, microphone, device, recording, iframe, or upstream remote-protocol integration is installed. A supplied `viewerUrl` is merely reported as available; it is not opened without a future read-only/capability policy.

Stopping requires a separate confirmation, acknowledgement of unsaved application loss, and the same epoch the human confirmed. Closing, hiding, HMR, and disposal never issue `stop` or `resume`.

## Build and test inputs

Browser module-table baseline imports: `react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-store`, and `@deepseek-ai/dsh-client-ui-primitives`. `clsx` is bundled privately. Do not add feature-plugin `dsh.client.external` entries. Type-only inputs are Cordis `4.0.4` and the DSH `connection`, `locale`, `ui-renderer`, `ui-session`, `ui-sidebar-right`, and `ui-slots` client faces, matching DSH `0.2.0-rc.2`.

Tested installed development versions: React/React DOM `18.3.1`, `clsx` `2.1.1`, TypeScript `5.9.3`, Vitest `3.2.7`, jsdom `26.1.0`, `@types/react` `18.3.31`, and `@types/react-dom` `18.3.7`. The Node type package is also needed because the shared Host type module contains Node-only declarations. Tests use React DOM directly; no Testing Library dependency is required.

```sh
./node_modules/.bin/tsc --noEmit -p tsconfig.client.json
./node_modules/.bin/vitest run tests/client-helpers.test.ts tests/client-http.test.ts tests/client-controller.test.ts tests/client-view.test.tsx tests/client-plugin.test.tsx
```

The component tests use jsdom and fake framework hooks. Registration/disposal tests use a real Cordis fiber with narrow service doubles; they do not replace a real DSH Loader/browser integration check. Real authenticated DSH sidebar integration was validated separately; see [validation](<../../docs/validation.md>). Run these tests after source changes and rebuild the committed ModuleLoader bundle before live use.
