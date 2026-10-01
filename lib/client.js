window.__ModuleLoader__.load({id:"dsh-agent-desktop",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/DesktopBody.tsx
var import_react = require("react");

// node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
function r(e) {
  var t, f, n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e) if (Array.isArray(e)) {
    var o = e.length;
    for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
  } else for (f in e) e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}
var clsx_default = clsx;

// src/client/DesktopBody.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/coordinates.ts
function imageRect(bounds, width, height) {
  if (![bounds.left, bounds.top, bounds.width, bounds.height, width, height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) return void 0;
  const scale = Math.min(bounds.width / width, bounds.height / height);
  return {
    left: bounds.left + (bounds.width - width * scale) / 2,
    top: bounds.top + (bounds.height - height * scale) / 2,
    width: width * scale,
    height: height * scale,
    scale
  };
}
function remotePoint(bounds, width, height, clientX, clientY, clampDrag = false) {
  const rect = imageRect(bounds, width, height);
  if (rect === void 0 || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return void 0;
  const x = (clientX - rect.left) / rect.scale;
  const y = (clientY - rect.top) / rect.scale;
  if (!clampDrag && (x < 0 || y < 0 || x >= width || y >= height)) return void 0;
  return { x: Math.max(0, Math.min(width - 1, Math.floor(x))), y: Math.max(0, Math.min(height - 1, Math.floor(y))) };
}

// src/client/input.ts
var ignoredKeys = /* @__PURE__ */ new Set(["Dead", "Process", "Unidentified", "Compose"]);
var namedKeys = /* @__PURE__ */ new Set([
  "Enter",
  "Escape",
  "Tab",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Control",
  "Alt",
  "Shift",
  "Meta",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Pause",
  "PrintScreen"
]);
function remoteKey(event) {
  if (event.isComposing || event.keyCode === 229 || ignoredKeys.has(event.key)) return void 0;
  if (namedKeys.has(event.key) || /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.key)) return event.key;
  return event.key.length === 1 && event.key >= " " && event.key <= "~" ? event.key : void 0;
}
var LocalKeys = class {
  held = /* @__PURE__ */ new Map();
  /** @returns one non-repeating key-down, or undefined for IME/unsupported/repeated keys. */
  down(event) {
    const key = remoteKey(event);
    const identity = event.code || event.key;
    if (key === void 0 || event.repeat || this.held.has(identity)) return void 0;
    this.held.set(identity, key);
    return { type: "key", key, down: true };
  }
  /** @returns a release only for a key whose down was observed by this local input surface. */
  up(event) {
    const identity = event.code || event.key;
    const key = this.held.get(identity);
    if (key === void 0) return void 0;
    this.held.delete(identity);
    return { type: "key", key, down: false };
  }
  /** Forget local held state; the controller/Host releases any delivered input. */
  clear() {
    this.held.clear();
  }
};
function remoteButton(button) {
  return button === 0 ? "left" : button === 1 ? "middle" : button === 2 ? "right" : void 0;
}
function wheelDelta(delta, mode, pagePixels) {
  if (!Number.isFinite(delta) || !Number.isFinite(pagePixels) || pagePixels <= 0) return 0;
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pagePixels : 1);
  return Math.max(-2e3, Math.min(2e3, Math.round(pixels)));
}
function validText(text) {
  return text.length > 0 && text.length <= 4e3 && !text.includes("\0");
}

// src/client/Desktop.module.css
var Desktop_default = {
  root: "Desktop_root",
  header: "Desktop_header",
  statusLine: "Desktop_statusLine",
  mode: "Desktop_mode",
  human: "Desktop_human",
  toolbar: "Desktop_toolbar",
  danger: "Desktop_danger",
  muted: "Desktop_muted",
  instructions: "Desktop_instructions",
  footer: "Desktop_footer",
  previewMeta: "Desktop_previewMeta",
  notice: "Desktop_notice",
  warning: "Desktop_warning",
  confirm: "Desktop_confirm",
  errorDetail: "Desktop_errorDetail",
  acknowledge: "Desktop_acknowledge",
  preview: "Desktop_preview",
  interactive: "Desktop_interactive",
  frame: "Desktop_frame",
  placeholder: "Desktop_placeholder",
  reset: "Desktop_reset",
  textForm: "Desktop_textForm",
  textInput: "Desktop_textInput",
  textActions: "Desktop_textActions",
  details: "Desktop_details"
};

// src/client/DesktopBody.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function DesktopBody(props) {
  const {
    useDesktopState,
    useTabInfo,
    mount,
    setVisible,
    control,
    input,
    refresh,
    frameLoaded,
    frameFailed,
    releaseHeld,
    suspend,
    t
  } = props;
  const { tab } = useTabInfo();
  const state = useDesktopState((value) => value);
  const status = state.status;
  const viewport = (0, import_react.useRef)(null);
  const keys = (0, import_react.useRef)(new LocalKeys());
  const pointer = (0, import_react.useRef)();
  const composing = (0, import_react.useRef)(false);
  const [isComposing, setComposing] = (0, import_react.useState)(false);
  const [draft, setDraft] = (0, import_react.useState)("");
  const [textNotice, setTextNotice] = (0, import_react.useState)();
  const [stopEpoch, setStopEpoch] = (0, import_react.useState)();
  const [acknowledged, setAcknowledged] = (0, import_react.useState)(false);
  const textId = (0, import_react.useId)();
  const hintId = (0, import_react.useId)();
  const stopId = (0, import_react.useId)();
  const ownHuman = state.humanTabId === tab.id;
  const enabled = ownHuman && state.inputReady && tab.visible && stopEpoch === void 0;
  const busy = state.pending !== void 0;
  const running = status?.state === "running";
  const controlsReady = tab.visible && state.connected && status !== void 0 && !busy;
  (0, import_react.useLayoutEffect)(() => mount(tab.id, tab.signal), [mount, tab.id, tab.signal]);
  (0, import_react.useEffect)(() => {
    setVisible(tab.id, tab.visible);
  }, [setVisible, tab.id, tab.visible]);
  (0, import_react.useEffect)(() => tab.actions.bindCommands({ refresh }), [tab.actions, refresh]);
  (0, import_react.useEffect)(() => {
    if (!enabled) {
      keys.current.clear();
      pointer.current = void 0;
      composing.current = false;
      setComposing(false);
    }
  }, [enabled, status?.epoch]);
  (0, import_react.useEffect)(() => {
    const element = viewport.current;
    if (element === null || !enabled || status === void 0) return;
    const wheel = (event) => {
      const point = remotePoint(element.getBoundingClientRect(), status.width, status.height, event.clientX, event.clientY);
      if (point === void 0) return;
      const deltaY = wheelDelta(event.deltaY, event.deltaMode, status.height);
      const deltaX = wheelDelta(event.deltaX, event.deltaMode, status.width);
      if (deltaX === 0 && deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      input(tab.id, { type: "scroll", ...point, deltaY, deltaX });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", wheel);
    };
  }, [enabled, input, tab.id, status?.width, status?.height, status?.epoch]);
  const pointFor = (event, clamp = false) => status === void 0 ? void 0 : remotePoint(event.currentTarget.getBoundingClientRect(), status.width, status.height, event.clientX, event.clientY, clamp);
  const releaseLocal = () => {
    keys.current.clear();
    pointer.current = void 0;
    releaseHeld(tab.id);
  };
  const keyDown = (event) => {
    if (ownHuman && event.key === "Escape" && event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      releaseLocal();
      suspend(tab.id);
      event.currentTarget.blur();
      return;
    }
    if (!enabled || remoteKey(event.nativeEvent) === void 0) return;
    event.preventDefault();
    event.stopPropagation();
    const action = keys.current.down(event.nativeEvent);
    if (action !== void 0 && !input(tab.id, action)) keys.current.clear();
  };
  const keyUp = (event) => {
    const action = keys.current.up(event.nativeEvent);
    if (!enabled || action === void 0) return;
    event.preventDefault();
    event.stopPropagation();
    input(tab.id, action);
  };
  const run = (action, epoch) => {
    keys.current.clear();
    pointer.current = void 0;
    void control(tab.id, action, epoch);
  };
  const sendText = () => {
    if (!enabled || composing.current) return;
    if (!validText(draft)) {
      setTextNotice("invalid");
      return;
    }
    if (input(tab.id, { type: "text", text: draft })) setTextNotice("queued");
  };
  const displayState = status === void 0 ? t("state.unknown") : running && status.owner === "none" ? t("state.paused") : t(`state.${status.state}`);
  const mode = ownHuman ? t(state.inputReady ? "mode.human" : "mode.waitFrame") : status?.owner === "human" ? t("mode.otherHuman") : t("mode.readonly");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: Desktop_default.root, "aria-label": t("title"), onBlur: (event) => {
    if (event.relatedTarget === null || !event.currentTarget.contains(event.relatedTarget)) {
      keys.current.clear();
      pointer.current = void 0;
      suspend(tab.id);
    }
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: Desktop_default.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Desktop_default.statusLine, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: displayState }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: clsx_default(Desktop_default.mode, ownHuman && Desktop_default.human), children: mode })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Desktop_default.muted, children: [
        t("owner.label"),
        "\uFF1A",
        status === void 0 ? "\u2014" : t(`owner.${status.owner}`)
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Desktop_default.toolbar, "aria-busy": busy, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          size: "sm",
          variant: "primary",
          disabled: !controlsReady || status.state !== "stopped" && status.state !== "error",
          onClick: () => {
            run("start");
          },
          children: t("control.start")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          size: "sm",
          variant: "outline",
          disabled: !controlsReady || !running || status.owner === "none",
          onClick: () => {
            run("pause");
          },
          children: t("control.pause")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          size: "sm",
          variant: "outline",
          disabled: !controlsReady || !running || status.owner !== "none",
          onClick: () => {
            run("resume");
          },
          children: t("control.resume")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          size: "sm",
          variant: "outline",
          disabled: !controlsReady || !running || ownHuman,
          onClick: () => {
            run("takeover");
          },
          children: t("control.takeover")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          size: "sm",
          variant: "outline",
          disabled: !controlsReady || !running || !ownHuman,
          onClick: () => {
            run("release");
          },
          children: t("control.release")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          size: "sm",
          variant: "ghost",
          disabled: !controlsReady || status.state === "stopped" || status.state === "stopping",
          className: Desktop_default.danger,
          onClick: () => {
            releaseLocal();
            if (status !== void 0) setStopEpoch(status.epoch);
            setAcknowledged(false);
          },
          children: t("control.stop")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", variant: "ghost", disabled: !state.connected || busy, onClick: refresh, children: t("control.refresh") })
    ] }),
    state.pending !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Desktop_default.notice, role: "status", children: t("control.pending", { action: t(`control.${state.pending}`) }) }),
    !state.connected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Desktop_default.warning, role: "status", children: t("connection.offline") }),
    state.problem !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Desktop_default.warning, role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t(`error.${state.problem.kind}`) }),
      state.problem.detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Desktop_default.errorDetail, children: state.problem.detail })
    ] }),
    status?.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Desktop_default.warning, role: "alert", children: status.error }),
    stopEpoch !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: Desktop_default.confirm, "aria-labelledby": stopId, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { id: stopId, children: t("stop.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("stop.warning") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: Desktop_default.acknowledge, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: acknowledged,
            onChange: (event) => {
              setAcknowledged(event.currentTarget.checked);
            }
          }
        ),
        t("stop.acknowledge")
      ] }),
      status?.epoch !== stopEpoch && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: t("stop.changed") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Desktop_default.toolbar, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", variant: "outline", onClick: () => {
          setStopEpoch(void 0);
          setAcknowledged(false);
        }, children: t("stop.cancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_dsh_client_ui_primitives.Button,
          {
            size: "sm",
            variant: "primary",
            disabled: !acknowledged || !controlsReady || status.epoch !== stopEpoch,
            onClick: () => {
              run("stop", stopEpoch);
              setStopEpoch(void 0);
              setAcknowledged(false);
            },
            children: t("stop.confirm")
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Desktop_default.previewMeta, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("preview.rate") }),
      state.frame !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("preview.received", {
        time: new Date(state.frame.receivedAt).toLocaleTimeString("zh-CN", { hour12: false })
      }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        ref: viewport,
        className: clsx_default(Desktop_default.preview, enabled && Desktop_default.interactive),
        role: enabled ? "application" : "img",
        tabIndex: enabled ? 0 : -1,
        "aria-label": t(enabled ? "preview.interactive" : "preview.label"),
        "aria-describedby": hintId,
        onKeyDown: keyDown,
        onKeyUp: keyUp,
        onBlur: releaseLocal,
        onContextMenu: (event) => {
          if (enabled) event.preventDefault();
        },
        onPointerDown: (event) => {
          if (!enabled || event.isPrimary === false || pointer.current !== void 0) return;
          const button = remoteButton(event.button);
          const point = pointFor(event);
          if (button === void 0 || point === void 0) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.focus({ preventScroll: true });
          if (input(tab.id, { type: "button", button, down: true, ...point })) {
            pointer.current = { id: event.pointerId, button };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }
        },
        onPointerMove: (event) => {
          if (!enabled) return;
          const held = pointer.current;
          if (held !== void 0 && held.id !== event.pointerId) return;
          const point = pointFor(event, held !== void 0);
          if (point !== void 0) input(tab.id, { type: "move", ...point });
        },
        onPointerUp: (event) => {
          const held = pointer.current;
          if (held === void 0 || held.id !== event.pointerId) return;
          const point = pointFor(event, true);
          pointer.current = void 0;
          if (enabled) input(tab.id, { type: "button", button: held.button, down: false, ...point });
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        },
        onPointerCancel: releaseLocal,
        onLostPointerCapture: () => {
          if (pointer.current !== void 0) releaseLocal();
        },
        children: state.frame !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "img",
          {
            src: state.frame.url,
            alt: t("preview.label"),
            className: Desktop_default.frame,
            draggable: false,
            onLoad: (event) => {
              frameLoaded(tab.id, event.currentTarget.src, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
            },
            onError: (event) => {
              frameFailed(tab.id, event.currentTarget.src);
            }
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Desktop_default.placeholder, children: t(!state.watching ? "preview.hidden" : state.problem !== void 0 ? "preview.error" : running ? "preview.waiting" : "preview.empty") })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Desktop_default.instructions, id: hintId, children: [
      status !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("preview.fixed", { width: status.width, height: status.height }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t(stopEpoch !== void 0 ? "input.confirming" : enabled ? "input.hint" : "preview.hint") }),
      ownHuman && !state.inputReady && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("input.wait") })
    ] }),
    ownHuman && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", variant: "ghost", className: Desktop_default.reset, onClick: releaseLocal, children: t("input.reset") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: Desktop_default.textForm, onSubmit: (event) => {
      event.preventDefault();
      sendText();
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: textId, children: t("text.label") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          id: textId,
          className: Desktop_default.textInput,
          value: draft,
          disabled: !enabled,
          maxLength: 4e3,
          rows: 3,
          placeholder: t("text.placeholder"),
          spellCheck: false,
          autoComplete: "off",
          autoCapitalize: "off",
          onChange: (event) => {
            setDraft(event.currentTarget.value);
            setTextNotice(void 0);
          },
          onCompositionStart: () => {
            composing.current = true;
            setComposing(true);
          },
          onCompositionEnd: () => {
            composing.current = false;
            setComposing(false);
          },
          onKeyDown: (event) => {
            event.stopPropagation();
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
              event.preventDefault();
              sendText();
            }
          },
          onKeyUp: (event) => {
            event.stopPropagation();
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Desktop_default.textActions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Desktop_default.muted, children: isComposing ? t("text.composing") : t("text.count", { count: draft.length }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", variant: "outline", type: "submit", disabled: !enabled || isComposing || !validText(draft), children: t("text.send") })
      ] }),
      textNotice !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Desktop_default.muted, role: "status", children: t(`text.${textNotice}`) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: Desktop_default.details, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("details.label") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("details.session") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: props.sessionId }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("details.backend") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: status?.backend ?? "\u2014" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("details.display") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: status?.display ?? "\u2014" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("details.epoch") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: status?.epoch ?? "\u2014" })
      ] }),
      status?.viewerUrl !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("details.viewer") }),
      status?.applications !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: t("apps.title", { count: status.applications.length }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: status.applications.map((app) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: app.command }),
          " \xB7 ",
          t(app.running ? "apps.running" : "apps.exited")
        ] }, app.id)) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: Desktop_default.footer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("control.description") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("input.loss") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("safety.note") })
    ] })
  ] });
}

// src/client/DesktopController.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");

// src/client/protocol.ts
var DesktopRequestError = class extends Error {
  constructor(kind2, message, status, httpStatus) {
    super(message);
    this.kind = kind2;
    this.status = status;
    this.httpStatus = httpStatus;
    this.name = "DesktopRequestError";
  }
};
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function integer(value, min) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min;
}
function optionalString(value) {
  return value === void 0 || typeof value === "string";
}
function desktopState(value) {
  return typeof value === "string" && ["stopped", "starting", "running", "stopping", "error"].includes(value);
}
function desktopOwner(value) {
  return value === "none" || value === "agent" || value === "human";
}
function parseApplication(value) {
  if (!record(value) || typeof value.id !== "string" || typeof value.command !== "string" || typeof value.running !== "boolean" || value.pid !== void 0 && !integer(value.pid, 1)) {
    throw new DesktopRequestError("protocol", "Invalid desktop applications response");
  }
  return {
    id: value.id,
    command: value.command,
    running: value.running,
    ...value.pid === void 0 ? {} : { pid: value.pid }
  };
}
function parseStatus(value, sessionId) {
  if (!record(value) || value.sessionId !== sessionId || !desktopState(value.state) || !desktopOwner(value.owner) || !integer(value.epoch, 0) || typeof value.backend !== "string" || !integer(value.width, 1) || !integer(value.height, 1) || value.width > 32768 || value.height > 32768 || !["startedAt", "lastFrameAt", "lastActionAt", "error", "display", "viewerUrl"].every((key) => optionalString(value[key]))) {
    throw new DesktopRequestError("protocol", "Invalid desktop status response");
  }
  if (value.applications !== void 0 && !Array.isArray(value.applications)) {
    throw new DesktopRequestError("protocol", "Invalid desktop applications response");
  }
  return {
    sessionId,
    state: value.state,
    owner: value.owner,
    epoch: value.epoch,
    backend: value.backend,
    width: value.width,
    height: value.height,
    ...typeof value.startedAt === "string" ? { startedAt: value.startedAt } : {},
    ...typeof value.lastFrameAt === "string" ? { lastFrameAt: value.lastFrameAt } : {},
    ...typeof value.lastActionAt === "string" ? { lastActionAt: value.lastActionAt } : {},
    ...typeof value.error === "string" ? { error: value.error } : {},
    ...typeof value.display === "string" ? { display: value.display } : {},
    ...typeof value.viewerUrl === "string" ? { viewerUrl: value.viewerUrl } : {},
    ...value.applications === void 0 ? {} : { applications: value.applications.map(parseApplication) }
  };
}
function parseControlResult(value, sessionId) {
  const status = parseStatus(value, sessionId);
  if (!record(value) || value.controlToken === void 0) return status;
  if (typeof value.controlToken !== "string" || !/^[A-Za-z0-9_-]{16,512}$/.test(value.controlToken)) {
    throw new DesktopRequestError("protocol", "Invalid desktop control capability");
  }
  return { ...status, controlToken: value.controlToken };
}
function parseHttpError(value, sessionId, httpStatus) {
  let status;
  if (record(value) && value.status !== void 0) status = parseStatus(value.status, sessionId);
  return new DesktopRequestError("http", record(value) && typeof value.error === "string" ? value.error : `HTTP ${httpStatus}`, status, httpStatus);
}
async function pngSize(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length !== 24 || signature.some((byte, index) => bytes[index] !== byte) || bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) {
    throw new DesktopRequestError("frame", "Invalid PNG response");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// src/client/DesktopController.ts
var statusInterval = 1500;
var frameInterval = 500;
var maxFreshAge = 5e3;
var maxPendingInput = 64;
var DesktopController = class {
  constructor(sessionId, transport, objectUrls = URL) {
    this.sessionId = sessionId;
    this.transport = transport;
    this.objectUrls = objectUrls;
    this.injected = {
      hooks: { desktopState: this.state },
      mount: (id2, signal) => this.mount(id2, signal),
      setVisible: (id2, visible) => this.setVisible(id2, visible),
      refresh: () => this.refresh(),
      control: (id2, action, epoch) => this.track(this.control(id2, action, epoch)),
      input: (id2, action) => this.input(id2, action),
      releaseHeld: (id2) => this.releaseHeld(id2),
      suspend: (id2) => this.suspend(id2),
      frameLoaded: (id2, url, width, height) => this.frameLoaded(id2, url, width, height),
      frameFailed: (id2, url) => {
        if (!this.views.has(id2) || this.state.getSnapshot().frame?.url !== url) return;
        this.fail(new DesktopRequestError("frame", "The preview image could not be decoded"));
      }
    };
  }
  state = (0, import_dsh_client_store.createSnapshotStore)({
    status: void 0,
    frame: void 0,
    connected: false,
    watching: false,
    checkedAt: void 0,
    pending: void 0,
    humanTabId: void 0,
    inputReady: false,
    problem: void 0
  });
  views = /* @__PURE__ */ new Map();
  tasks = /* @__PURE__ */ new Set();
  requests = /* @__PURE__ */ new Set();
  keys = /* @__PURE__ */ new Set();
  buttons = /* @__PURE__ */ new Set();
  queue = [];
  inputRunning = false;
  grant;
  interactionRevision = 0;
  pendingTab;
  connection;
  generation = 0;
  pageVisible = true;
  disposed = false;
  disposal;
  sequence = 0;
  acceptedSequence = 0;
  loop;
  statusTimer;
  frameTimer;
  frameRunning = false;
  lastMoveAt = -Infinity;
  pendingControl = false;
  injected;
  /** Connection replacement withdraws local authority and requires a fresh status baseline. */
  setConnection(id2) {
    if (this.disposed || id2 === this.connection) return;
    this.suspend();
    this.stopPolling();
    this.connection = id2;
    this.generation++;
    this.acceptedSequence = 0;
    this.clearFrame();
    this.publish({ connected: id2 !== void 0, status: void 0, checkedAt: void 0 });
    this.reconcilePolling();
  }
  /** Browser-tab visibility complements the framework's sidebar-tab visibility. */
  setPageVisible(visible) {
    if (this.disposed || visible === this.pageVisible) return;
    this.pageVisible = visible;
    if (!visible) this.suspend();
    this.reconcilePolling();
  }
  /** Window/root blur releases human ownership; it never stops or resumes the desktop. */
  suspend(tabId) {
    const grant = this.grant;
    if (tabId === void 0 || grant?.tabId === tabId || this.pendingTab === tabId) this.interactionRevision++;
    if (grant === void 0 || tabId !== void 0 && grant.tabId !== tabId) return;
    this.withdrawGrant();
    this.track(this.releaseEpoch(grant.epoch, grant.token));
  }
  /** Stop local resources and await in-flight work; only an explicit control command can stop Host apps. */
  dispose() {
    if (this.disposal !== void 0) return this.disposal;
    this.suspend();
    this.disposed = true;
    this.stopPolling();
    for (const request of this.requests) request.abort();
    for (const [id2, view] of this.views) {
      view.signal.removeEventListener("abort", view.detach);
      this.views.delete(id2);
    }
    this.clearFrame();
    this.disposal = Promise.allSettled([...this.tasks]).then(() => {
    });
    return this.disposal;
  }
  track(task) {
    this.tasks.add(task);
    void task.then(() => {
      this.tasks.delete(task);
    }, () => {
      this.tasks.delete(task);
    });
    return task;
  }
  publish(patch) {
    if (this.disposed) return;
    const next = { ...this.state.getSnapshot(), ...patch, humanTabId: this.grant?.tabId };
    this.state.set({ ...next, inputReady: this.grant !== void 0 && this.canInput(this.grant.tabId, next) });
  }
  mount(tabId, signal) {
    if (this.disposed || signal.aborted) return () => {
    };
    this.views.get(tabId)?.detach();
    const view = { visible: false, signal, loadedEpoch: void 0, loadedAt: 0, detach: () => {
      if (this.views.get(tabId) !== view) return;
      this.suspend(tabId);
      signal.removeEventListener("abort", view.detach);
      this.views.delete(tabId);
      this.reconcilePolling();
    } };
    this.views.set(tabId, view);
    signal.addEventListener("abort", view.detach, { once: true });
    return view.detach;
  }
  setVisible(tabId, visible) {
    const view = this.views.get(tabId);
    if (view === void 0 || this.disposed) return;
    view.visible = visible;
    if (!visible) {
      view.loadedEpoch = void 0;
      this.suspend(tabId);
    }
    this.reconcilePolling();
  }
  active() {
    return !this.disposed && this.connection !== void 0 && this.pageVisible && [...this.views.values()].some((view) => view.visible && !view.signal.aborted);
  }
  canInput(tabId, state = this.state.getSnapshot()) {
    const view = this.views.get(tabId);
    const status = state.status;
    const now = Date.now();
    return this.active() && view?.visible === true && !view.signal.aborted && state.pending === void 0 && this.grant?.tabId === tabId && this.grant.epoch === status?.epoch && status?.state === "running" && status.owner === "human" && state.checkedAt !== void 0 && now - state.checkedAt <= maxFreshAge && state.frame?.epoch === status.epoch && now - state.frame.receivedAt <= maxFreshAge && view.loadedEpoch === status.epoch && now - view.loadedAt <= maxFreshAge;
  }
  reconcilePolling() {
    if (!this.active()) {
      this.stopPolling();
      this.clearFrame();
      this.publish({ watching: false });
      return;
    }
    if (this.loop !== void 0) {
      this.publish({});
      return;
    }
    this.loop = new AbortController();
    this.publish({ watching: true });
    this.scheduleStatus(0, this.loop);
  }
  stopPolling() {
    this.loop?.abort();
    this.loop = void 0;
    clearTimeout(this.statusTimer);
    clearTimeout(this.frameTimer);
    this.statusTimer = void 0;
    this.frameTimer = void 0;
  }
  refresh() {
    if (!this.active()) return;
    this.stopPolling();
    this.reconcilePolling();
  }
  scheduleStatus(delay, loop) {
    if (this.loop !== loop || loop.signal.aborted) return;
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => {
      this.statusTimer = void 0;
      this.track(this.pollStatus(loop));
    }, delay);
  }
  async pollStatus(loop) {
    const sequence = ++this.sequence;
    try {
      const snapshot = this.state.getSnapshot();
      const currentGrant = this.grant;
      if (currentGrant !== void 0 && Date.now() - currentGrant.acquiredAt > maxFreshAge && !this.canInput(currentGrant.tabId, snapshot)) this.suspend(currentGrant.tabId);
      const grant = this.grant;
      const human = grant !== void 0 && this.views.get(grant.tabId)?.visible === true ? { epoch: grant.epoch, token: grant.token } : void 0;
      const status = await this.transport.status(loop.signal, human);
      if (this.loop !== loop || loop.signal.aborted) return;
      if (this.accept(status, sequence)) this.publish({ problem: void 0 });
      this.scheduleFrame(0, loop);
    } catch (error) {
      if (this.loop === loop && !loop.signal.aborted && sequence >= this.acceptedSequence) this.fail(error);
    } finally {
      this.scheduleStatus(statusInterval, loop);
    }
  }
  scheduleFrame(delay, loop) {
    if (this.loop !== loop || loop.signal.aborted || this.frameTimer !== void 0 || this.frameRunning || this.state.getSnapshot().status?.state !== "running") return;
    this.frameTimer = setTimeout(() => {
      this.frameTimer = void 0;
      this.track(this.pollFrame(loop));
    }, delay);
  }
  async pollFrame(loop) {
    const status = this.state.getSnapshot().status;
    if (status?.state !== "running" || this.loop !== loop) return;
    this.frameRunning = true;
    try {
      const blob = await this.transport.frame(status.epoch, loop.signal);
      const size = await pngSize(blob);
      if (this.loop !== loop || loop.signal.aborted) return;
      const current = this.state.getSnapshot().status;
      if (current?.epoch !== status.epoch || current.state !== "running") return;
      if (size.width !== current.width || size.height !== current.height) {
        throw new DesktopRequestError("frame", "PNG dimensions do not match the fixed desktop resolution");
      }
      const previous = this.state.getSnapshot().frame;
      const frame = { url: this.objectUrls.createObjectURL(blob), epoch: current.epoch, ...size, receivedAt: Date.now() };
      this.publish({ frame });
      if (previous !== void 0) this.objectUrls.revokeObjectURL(previous.url);
    } catch (error) {
      if (this.loop === loop && !loop.signal.aborted && this.state.getSnapshot().status?.epoch === status.epoch) this.fail(error);
    } finally {
      this.frameRunning = false;
      if (this.loop !== void 0) this.scheduleFrame(frameInterval, this.loop);
    }
  }
  frameLoaded(tabId, url, width, height) {
    const frame = this.state.getSnapshot().frame;
    const view = this.views.get(tabId);
    if (view === void 0 || frame?.url !== url || !view.visible) return;
    if (width !== frame.width || height !== frame.height) {
      this.fail(new DesktopRequestError("frame", "Decoded image dimensions do not match the desktop"));
      return;
    }
    view.loadedEpoch = frame.epoch;
    view.loadedAt = Date.now();
    this.publish({});
  }
  clearFrame() {
    const frame = this.state.getSnapshot().frame;
    if (frame !== void 0) this.objectUrls.revokeObjectURL(frame.url);
    for (const view of this.views.values()) view.loadedEpoch = void 0;
    this.publish({ frame: void 0 });
  }
  accept(status, sequence) {
    const current = this.state.getSnapshot().status;
    if (this.disposed || status.sessionId !== this.sessionId || current !== void 0 && (status.epoch < current.epoch || status.epoch === current.epoch && sequence < this.acceptedSequence)) return false;
    this.acceptedSequence = sequence;
    if (current !== void 0 && current.epoch === status.epoch && (current.width !== status.width || current.height !== status.height)) this.suspend();
    if (this.grant !== void 0 && (status.epoch !== this.grant.epoch || status.owner !== "human" || status.state !== "running")) {
      this.withdrawGrant();
    }
    if (current?.epoch !== status.epoch || current.width !== status.width || current.height !== status.height || status.state !== "running") this.clearFrame();
    this.publish({ status, checkedAt: Date.now() });
    return true;
  }
  withdrawGrant() {
    this.grant = void 0;
    this.queue = [];
    this.keys.clear();
    this.buttons.clear();
    this.publish({});
  }
  async releaseEpoch(epoch, token) {
    const generation = this.generation;
    const sequence = ++this.sequence;
    try {
      const { controlToken: _discarded, ...status } = await this.transport.control("release", epoch, new AbortController().signal, true, token);
      if (generation === this.generation) this.accept(status, sequence);
    } catch (error) {
      if (!this.disposed && generation === this.generation && error instanceof DesktopRequestError && error.status !== void 0) {
        this.accept(error.status, sequence);
      }
    }
  }
  async control(tabId, action, expectedEpoch) {
    const before = this.state.getSnapshot();
    const view = this.views.get(tabId);
    if (!this.active() || view?.visible !== true || this.pendingControl || before.status === void 0 || before.checkedAt === void 0 || Date.now() - before.checkedAt > maxFreshAge) return false;
    if (expectedEpoch !== void 0 && expectedEpoch !== before.status.epoch) return false;
    if (action === "release" && this.grant?.tabId !== tabId) return false;
    const token = action === "release" ? this.grant?.token : void 0;
    const epoch = before.status.epoch;
    const generation = this.generation;
    const request = new AbortController();
    const sequence = ++this.sequence;
    const interactionRevision = this.interactionRevision;
    this.requests.add(request);
    this.pendingControl = true;
    this.pendingTab = tabId;
    this.withdrawGrant();
    this.publish({ pending: action, problem: void 0 });
    try {
      const { controlToken, ...status } = await this.transport.control(action, epoch, request.signal, false, token);
      if (generation !== this.generation) return false;
      if (this.disposed || !this.active() || this.views.get(tabId) !== view || !view.visible || action === "takeover" && interactionRevision !== this.interactionRevision) {
        if (action === "takeover" && status.owner === "human" && controlToken !== void 0) await this.releaseEpoch(status.epoch, controlToken);
        return false;
      }
      const accepted = this.accept(status, sequence);
      if (action === "takeover") {
        if (!accepted || status.owner !== "human" || status.state !== "running" || status.epoch <= epoch || controlToken === void 0) {
          throw new DesktopRequestError("protocol", "Takeover was not confirmed with a new human capability");
        }
        this.grant = { tabId, epoch: status.epoch, acquiredAt: Date.now(), token: controlToken };
      }
      if (this.loop !== void 0) this.scheduleFrame(0, this.loop);
      return accepted;
    } catch (error) {
      if (!this.disposed && generation === this.generation && !request.signal.aborted) this.fail(error);
      return false;
    } finally {
      this.requests.delete(request);
      this.pendingControl = false;
      this.pendingTab = void 0;
      this.publish({ pending: void 0 });
    }
  }
  input(tabId, action) {
    if (!this.canInput(tabId) || this.grant === void 0) return false;
    if (action.type === "move") {
      const now = Date.now();
      if (now - this.lastMoveAt < 50) return false;
      this.lastMoveAt = now;
      const last = this.queue.at(-1);
      if (last?.action.type === "move") this.queue.pop();
    }
    if (this.queue.length >= maxPendingInput) {
      this.suspend(tabId);
      this.publish({ problem: { kind: "input", detail: "" } });
      return false;
    }
    if (action.type === "key") {
      if (action.down) this.keys.add(action.key);
      else this.keys.delete(action.key);
    }
    if (action.type === "button") {
      if (action.down) this.buttons.add(action.button);
      else this.buttons.delete(action.button);
    }
    this.queue.push({ tabId, epoch: this.grant.epoch, action });
    if (!this.inputRunning) this.track(this.drainInput());
    return true;
  }
  async drainInput() {
    this.inputRunning = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!this.canInput(item.tabId) || this.grant?.epoch !== item.epoch) {
          this.suspend(item.tabId);
          break;
        }
        const request = new AbortController();
        const sequence = ++this.sequence;
        const generation = this.generation;
        this.requests.add(request);
        try {
          const status = await this.transport.input(item.epoch, item.action, request.signal, this.grant.token);
          if (generation === this.generation) this.accept(status, sequence);
        } catch (error) {
          if (!this.disposed && !request.signal.aborted && generation === this.generation && this.state.getSnapshot().status?.epoch === item.epoch) this.fail(error);
          break;
        } finally {
          this.requests.delete(request);
        }
      }
    } finally {
      this.inputRunning = false;
    }
  }
  releaseHeld(tabId) {
    if (this.grant?.tabId !== tabId) return;
    const keys = [...this.keys];
    const buttons = [...this.buttons];
    this.queue = [];
    this.keys.clear();
    this.buttons.clear();
    for (const key of keys) this.input(tabId, { type: "key", key, down: false });
    for (const button of buttons) this.input(tabId, { type: "button", button, down: false });
    if (!this.canInput(tabId)) this.suspend(tabId);
  }
  fail(error) {
    if (error instanceof DesktopRequestError && error.status !== void 0) this.accept(error.status, ++this.sequence);
    this.suspend();
    this.publish({ problem: {
      kind: error instanceof DesktopRequestError ? error.kind : "network",
      detail: error instanceof Error ? error.message : ""
    } });
  }
};

// src/client/http.ts
var base = "/api/agent-desktop";
var maxFrameBytes = 32 * 1024 * 1024;
var maxJsonBytes = 512 * 1024;
async function boundedBody(response, maxBytes) {
  const announced = Number(response.headers.get("content-length"));
  if (announced > maxBytes) {
    await response.body?.cancel();
    throw new DesktopRequestError("protocol", "Desktop response exceeds the byte limit");
  }
  if (response.body === null) throw new DesktopRequestError("protocol", "Empty desktop response");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (; ; ) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new DesktopRequestError("protocol", "Desktop response exceeds the byte limit");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}
function createDesktopTransport(sessionId, fetcher) {
  let frameSequence = 0;
  const request = async (path, options, signal, consume) => {
    const controller = new AbortController();
    const abort = () => {
      controller.abort(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(() => {
      controller.abort(new Error("Desktop request timed out"));
    }, options.keepalive ? 2500 : 8e3);
    try {
      const response = await fetcher(`${base}${path}`, {
        ...options,
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error"
      });
      return await consume(response);
    } catch (error) {
      if (error instanceof DesktopRequestError || signal.aborted) throw error;
      throw new DesktopRequestError("network", error instanceof Error ? error.message : "Desktop request failed");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  };
  const json = async (response) => {
    const bytes = await boundedBody(response, maxJsonBytes);
    let value;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      throw new DesktopRequestError("protocol", error instanceof Error ? error.message : "Invalid desktop JSON");
    }
    if (!response.ok) throw parseHttpError(value, sessionId, response.status);
    return value;
  };
  const post = (path, payload, signal, keepalive = false, token) => request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...token === void 0 ? {} : { "X-Desktop-Control": token } },
    body: JSON.stringify({ sessionId, ...payload }),
    keepalive
  }, signal, json);
  return {
    status: (signal, human) => {
      const query = new URLSearchParams({ sessionId });
      if (human !== void 0) {
        query.set("epoch", String(human.epoch));
        query.set("human", "true");
      }
      return request(`/status?${query}`, {
        headers: human === void 0 ? {} : { "X-Desktop-Control": human.token }
      }, signal, async (response) => parseStatus(await json(response), sessionId));
    },
    frame: (epoch, signal) => request(`/frame?${new URLSearchParams({
      sessionId,
      epoch: String(epoch),
      t: `${Date.now()}-${++frameSequence}`
    })}`, {}, signal, async (response) => {
      if (!response.ok) {
        await json(response);
        throw new DesktopRequestError("frame", "Frame request failed");
      }
      if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "image/png") {
        await response.body?.cancel();
        throw new DesktopRequestError("frame", "Desktop frame is not a PNG");
      }
      return new Blob([await boundedBody(response, maxFrameBytes)], { type: "image/png" });
    }),
    control: async (action, expectedEpoch, signal, keepalive, token) => parseControlResult(await post("/control", {
      action,
      ...expectedEpoch === void 0 ? {} : { expectedEpoch }
    }, signal, keepalive, token), sessionId),
    input: async (epoch, action, signal, token) => {
      const response = await post("/input", { epoch, action }, signal, false, token);
      if (typeof response !== "object" || response === null || !("ok" in response) || response.ok !== true || !("status" in response)) {
        throw new DesktopRequestError("protocol", "Invalid input acknowledgement");
      }
      return parseStatus(response.status, sessionId);
    }
  };
}

// src/client/locales.ts
var zh = {
  title: "\u667A\u80FD\u4F53\u684C\u9762",
  "guide.description": "\u76D1\u770B\u72EC\u7ACB\u539F\u751F\u684C\u9762\uFF0C\u6682\u505C\u6216\u4EBA\u5DE5\u63A5\u7BA1",
  "state.unknown": "\u6B63\u5728\u8BFB\u53D6\u72B6\u6001\u2026",
  "state.stopped": "\u5DF2\u505C\u6B62",
  "state.starting": "\u6B63\u5728\u542F\u52A8",
  "state.running": "\u8FD0\u884C\u4E2D",
  "state.stopping": "\u6B63\u5728\u505C\u6B62",
  "state.error": "\u684C\u9762\u6545\u969C",
  "state.paused": "\u5DF2\u6682\u505C\u8F93\u5165",
  "owner.label": "\u8F93\u5165\u6240\u6709\u6743",
  "owner.none": "\u65E0\u4EBA\uFF08\u6682\u505C\uFF09",
  "owner.agent": "\u667A\u80FD\u4F53",
  "owner.human": "\u4EBA\u5DE5",
  "mode.readonly": "\u53EA\u8BFB\u76D1\u770B",
  "mode.human": "\u672C\u9875\u4EBA\u5DE5\u63A5\u7BA1",
  "mode.waitFrame": "\u5DF2\u63A5\u7BA1\uFF0C\u7B49\u5F85\u65B0\u753B\u9762\u786E\u8BA4",
  "mode.otherHuman": "\u4EBA\u5DE5\u6240\u6709\u6743\u4E0D\u5C5E\u4E8E\u672C\u9875\uFF1B\u4ECD\u4E3A\u53EA\u8BFB",
  "control.start": "\u542F\u52A8\u684C\u9762",
  "control.pause": "\u6682\u505C\u8F93\u5165",
  "control.resume": "\u6062\u590D\u667A\u80FD\u4F53",
  "control.takeover": "\u4EBA\u5DE5\u63A5\u7BA1",
  "control.release": "\u91CA\u653E\u63A5\u7BA1",
  "control.stop": "\u505C\u6B62\u684C\u9762",
  "control.refresh": "\u5237\u65B0\u72B6\u6001",
  "control.pending": "\u6B63\u5728\u6267\u884C\uFF1A{action}\u2026",
  "control.description": "\u6682\u505C\u4EC5\u7981\u7528\u8F93\u5165\uFF0C\u4E0D\u7EC8\u6B62\u5E94\u7528\uFF1B\u91CA\u653E\u63A5\u7BA1\u540E\u4FDD\u6301\u6682\u505C\uFF0C\u9700\u8981\u624B\u52A8\u6062\u590D\u667A\u80FD\u4F53\u3002",
  "stop.title": "\u786E\u8BA4\u505C\u6B62\u6B64\u4F1A\u8BDD\u7684\u684C\u9762\uFF1F",
  "stop.warning": "\u505C\u6B62\u5C06\u5173\u95ED\u6B64\u72EC\u7ACB\u684C\u9762\u4E2D\u7684\u6240\u6709\u5E94\u7528\u3002\u672A\u4FDD\u5B58\u7684\u5185\u5BB9\u53EF\u80FD\u4E22\u5931\uFF1B\u8FD9\u4E0D\u662F\u5173\u95ED\u9884\u89C8\u3002",
  "stop.acknowledge": "\u6211\u5DF2\u4FDD\u5B58\u9700\u8981\u4FDD\u7559\u7684\u5185\u5BB9\uFF0C\u4E86\u89E3\u672A\u4FDD\u5B58\u5185\u5BB9\u53EF\u80FD\u4E22\u5931\u3002",
  "stop.confirm": "\u786E\u8BA4\u505C\u6B62\u5E76\u5173\u95ED\u5E94\u7528",
  "stop.cancel": "\u53D6\u6D88",
  "stop.changed": "\u684C\u9762\u72B6\u6001\u5DF2\u53D8\u5316\uFF0C\u8BF7\u53D6\u6D88\u540E\u91CD\u65B0\u786E\u8BA4\u3002",
  "preview.label": "\u72EC\u7ACB\u684C\u9762\u53EA\u8BFB\u9884\u89C8",
  "preview.interactive": "\u4EBA\u5DE5\u63A7\u5236\u7684\u72EC\u7ACB\u684C\u9762\uFF1B\u6309 Shift+Escape \u9000\u51FA\u63A5\u7BA1",
  "preview.empty": "\u542F\u52A8\u684C\u9762\u540E\u53EF\u5728\u8FD9\u91CC\u67E5\u770B\u753B\u9762\u3002\u9ED8\u8BA4\u4E0D\u4F1A\u63A5\u7BA1\u952E\u76D8\u6216\u9F20\u6807\u3002",
  "preview.waiting": "\u6B63\u5728\u7B49\u5F85\u684C\u9762\u753B\u9762\u2026",
  "preview.hidden": "\u9884\u89C8\u5DF2\u6302\u8D77\uFF1B\u540E\u53F0\u5E94\u7528\u4E0D\u4F1A\u56E0\u6B64\u505C\u6B62\u3002",
  "preview.error": "\u6682\u65F6\u65E0\u6CD5\u663E\u793A\u753B\u9762\u3002\u8BF7\u67E5\u770B\u72B6\u6001\uFF0C\u6062\u590D\u540E\u91CD\u65B0\u63A5\u7BA1\u3002",
  "preview.rate": "\u56FE\u50CF\u9884\u89C8\uFF0C\u4E0A\u9650 2 \u5E27/\u79D2",
  "preview.received": "\u6700\u8FD1\u753B\u9762 {time}",
  "preview.fixed": "\u56FA\u5B9A\u5206\u8FA8\u7387 {width} \xD7 {height}\uFF1B\u4FA7\u680F\u7F29\u653E\u4E0D\u6539\u53D8\u8FDC\u7AEF\u5206\u8FA8\u7387\u3002",
  "preview.hint": "\u5148\u63A5\u7BA1\uFF0C\u518D\u70B9\u51FB\u753B\u9762\u805A\u7126\u3002\u652F\u6301\u70B9\u51FB\u3001\u53CC\u51FB\u3001\u62D6\u52A8\u548C\u6EDA\u52A8\uFF1B\u7559\u767D\u533A\u57DF\u4E0D\u8F6C\u53D1\u70B9\u51FB\u3002",
  "input.hint": "\u952E\u76D8\u4EC5\u5728\u753B\u9762\u805A\u7126\u65F6\u8F6C\u53D1\u3002Shift+Esc \u9000\u51FA\u63A5\u7BA1\uFF1B\u4E2D\u6587\u548C\u8F93\u5165\u6CD5\u8BF7\u7528\u4E0B\u65B9\u6587\u672C\u6846\u3002\u6D4F\u89C8\u5668\u4FDD\u7559\u7684\u5FEB\u6377\u952E\u53EF\u80FD\u65E0\u6CD5\u8F6C\u53D1\u3002",
  "input.wait": "\u53EA\u6709\u672C\u9875\u63A5\u7BA1\u786E\u8BA4\u4E14\u65B0\u753B\u9762\u52A0\u8F7D\u5B8C\u6210\u540E\uFF0C\u624D\u5141\u8BB8\u53D1\u9001\u8F93\u5165\u3002",
  "input.confirming": "\u505C\u6B62\u786E\u8BA4\u671F\u95F4\u4E0D\u8F6C\u53D1\u753B\u9762\u8F93\u5165\u3002\u53D6\u6D88\u540E\u53EF\u7EE7\u7EED\u64CD\u4F5C\u3002",
  "input.loss": "\u79BB\u5F00\u6B64\u9875\u3001\u5207\u6362\u6807\u7B7E\u6216\u5931\u7126\u4F1A\u505C\u6B62\u672C\u9875\u8F93\u5165\u5E76\u5C3D\u529B\u91CA\u653E\u63A5\u7BA1\uFF1B\u65AD\u7EBF\u65F6\u7531 Host \u79DF\u7EA6\u8D85\u65F6\u515C\u5E95\u3002",
  "input.reset": "\u91CA\u653E\u5DF2\u6309\u4E0B\u7684\u952E\u548C\u6309\u94AE",
  "text.label": "\u4EBA\u5DE5\u6587\u672C\u8F93\u5165\uFF08\u652F\u6301\u4E2D\u6587 / IME\uFF09",
  "text.placeholder": "\u8F93\u5165\u5F85\u53D1\u9001\u7684\u6587\u5B57\uFF1B\u8F93\u5165\u6CD5\u5B8C\u6210\u540E\u70B9\u51FB\u53D1\u9001\u3002\u4E0D\u4F1A\u81EA\u52A8\u540C\u6B65\u526A\u8D34\u677F\u3002",
  "text.send": "\u53D1\u9001\u6587\u672C",
  "text.count": "{count} / 4000",
  "text.composing": "\u8F93\u5165\u6CD5\u7EC4\u5408\u4E2D\uFF0C\u5C1A\u672A\u53D1\u9001",
  "text.queued": "\u6587\u672C\u5DF2\u6392\u961F\uFF1B\u53D1\u751F\u9519\u8BEF\u4E0D\u4F1A\u81EA\u52A8\u91CD\u53D1\u3002\u8349\u7A3F\u4FDD\u7559\u4EE5\u4FBF\u6838\u5BF9\u3002",
  "text.invalid": "\u8BF7\u8F93\u5165 1\u20134000 \u4E2A\u5B57\u7B26\uFF0C\u4E0D\u80FD\u5305\u542B\u7A7A\u5B57\u7B26\u3002",
  "connection.offline": "DSH \u8FDE\u63A5\u672A\u5C31\u7EEA\uFF1B\u6240\u6709\u8F93\u5165\u5DF2\u7981\u7528\u3002",
  "error.network": "\u8FDE\u63A5\u5931\u8D25\uFF1B\u5DF2\u56DE\u5230\u53EA\u8BFB\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5\u540E\u91CD\u65B0\u63A5\u7BA1\u3002",
  "error.http": "Host \u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF1B\u6CA1\u6709\u81EA\u52A8\u91CD\u8BD5\u8F93\u5165\u3002",
  "error.protocol": "Host \u54CD\u5E94\u65E0\u6CD5\u5B89\u5168\u4F7F\u7528\uFF1B\u8F93\u5165\u5DF2\u7981\u7528\u3002",
  "error.frame": "\u753B\u9762\u65E0\u6CD5\u9A8C\u8BC1\u6216\u52A0\u8F7D\uFF1B\u8F93\u5165\u5DF2\u7981\u7528\u3002",
  "error.input": "\u8F93\u5165\u961F\u5217\u5DF2\u6EE1\uFF0C\u5DF2\u505C\u6B62\u8F6C\u53D1\u5E76\u91CA\u653E\u63A5\u7BA1\uFF1B\u8BF7\u91CD\u65B0\u63A5\u7BA1\u3002",
  "details.label": "\u4F1A\u8BDD\u4E0E\u540E\u7AEF\u8BE6\u60C5",
  "details.session": "DSH \u4F1A\u8BDD",
  "details.backend": "\u540E\u7AEF",
  "details.display": "\u72EC\u7ACB\u663E\u793A",
  "details.epoch": "\u6240\u6709\u6743\u7248\u672C",
  "details.viewer": "Host \u63D0\u4F9B\u4E86\u6269\u5C55\u67E5\u770B\u5668\uFF1B\u6B64\u7248\u672C\u4ECD\u4F7F\u7528\u53D7\u63A7\u56FE\u50CF\u9884\u89C8\uFF0C\u4E0D\u81EA\u52A8\u6253\u5F00\u3002",
  "apps.title": "\u5E94\u7528\uFF08{count}\uFF09",
  "apps.running": "\u8FD0\u884C\u4E2D",
  "apps.exited": "\u5DF2\u9000\u51FA",
  "safety.note": "\u5BBF\u4E3B\u539F\u751F\u72EC\u7ACB\u56FE\u5F62\u4F1A\u8BDD\uFF0C\u4E0D\u662F\u5B89\u5168\u6C99\u7BB1\u3002\u4E0D\u63A5\u5165\u526A\u8D34\u677F\u540C\u6B65\u3001\u97F3\u9891\u3001\u6444\u50CF\u5934\u6216\u5176\u4ED6\u8BBE\u5907\u3002\u5173\u95ED\u6B64\u6807\u7B7E\u4E0D\u4F1A\u505C\u6B62\u540E\u53F0\u5E94\u7528\u3002"
};

// src/client/index.ts
var id = "dsh-agent-desktop";
var kind = "agent-desktop";
var inject = ["slots", "locale", "sidebarRightTabs", "connection"];
function apply(ctx) {
  const namespace = "agentDesktop";
  const t = ctx.locale.bind(namespace);
  const controllers = /* @__PURE__ */ new Map();
  const connection = ctx.get("connection");
  const pageVisible = () => document.visibilityState !== "hidden";
  const updateConnection = () => {
    const generation = connection.generation.getSnapshot()?.id;
    for (const controller of controllers.values()) controller.setConnection(generation);
  };
  const visibility = () => {
    for (const controller of controllers.values()) controller.setPageVisible(pageVisible());
  };
  const blur = () => {
    for (const controller of controllers.values()) controller.suspend();
  };
  ctx.effect(() => ctx.locale.register(namespace, { zh, en: zh }), "agent-desktop.copy");
  ctx.effect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/api/agent-desktop/style.css";
    document.head.append(link);
    return () => {
      link.remove();
    };
  }, "agent-desktop.styles");
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id,
    kind,
    keepMounted: true,
    title: () => t("title"),
    guide: [{ id: "open", order: 45, title: () => t("title"), description: () => t("guide.description") }]
  }), "agent-desktop.tab-type");
  ctx.effect(() => {
    const unsubscribe = connection.generation.subscribe(updateConnection);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", blur);
    return async () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", blur);
      const disposing = [...controllers.values()].map((controller) => controller.dispose());
      controllers.clear();
      await Promise.all(disposing);
    };
  }, "agent-desktop.previews");
  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: id,
    locale: namespace,
    inject: (sessionId) => {
      let controller = controllers.get(sessionId);
      if (controller === void 0) {
        controller = new DesktopController(sessionId, createDesktopTransport(sessionId, window.fetch.bind(window)));
        controller.setConnection(connection.generation.getSnapshot()?.id);
        controller.setPageVisible(pageVisible());
        controllers.set(sessionId, controller);
      }
      return controller.injected;
    }
  }, DesktopBody)), "agent-desktop.body");
}
return module.exports;}});
