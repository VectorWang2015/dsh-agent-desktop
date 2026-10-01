/** Official sidebar body: framework data hooks and local, element-scoped human input only. */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import clsx from 'clsx'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { ControlAction } from '../types.ts'
import type { DesktopInjected } from './DesktopController.ts'
import { remotePoint } from './coordinates.ts'
import { LocalKeys, remoteButton, remoteKey, validText, wheelDelta } from './input.ts'
import type {} from './locales.ts'
import css from './Desktop.module.css'

/** All framework members are derived from the slot and injection definitions. */
export type DesktopBodyProps = PropsRuntime<'sidebar.right.pane.tab'>
  & PropsLocale<'agentDesktop'> & InjectFace<DesktopInjected>

/** Render the session-owned controller without reaching Cordis or subscribing by hand. */
export function DesktopBody(props: DesktopBodyProps): ReactNode {
  const { useDesktopState, useTabInfo, mount, setVisible, control, input, refresh, frameLoaded,
    frameFailed, releaseHeld, suspend, t } = props
  const { tab } = useTabInfo()
  const state = useDesktopState(value => value)
  const status = state.status
  const viewport = useRef<HTMLDivElement>(null)
  const keys = useRef(new LocalKeys())
  const pointer = useRef<{ id: number; button: 'left' | 'middle' | 'right' }>()
  const composing = useRef(false)
  const [isComposing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [textNotice, setTextNotice] = useState<'queued' | 'invalid'>()
  const [stopEpoch, setStopEpoch] = useState<number>()
  const [acknowledged, setAcknowledged] = useState(false)
  const textId = useId()
  const hintId = useId()
  const stopId = useId()
  const ownHuman = state.humanTabId === tab.id
  const enabled = ownHuman && state.inputReady && tab.visible && stopEpoch === undefined
  const busy = state.pending !== undefined
  const running = status?.state === 'running'
  const controlsReady = tab.visible && state.connected && status !== undefined && !busy

  useLayoutEffect(() => mount(tab.id, tab.signal), [mount, tab.id, tab.signal])
  useEffect(() => { setVisible(tab.id, tab.visible) }, [setVisible, tab.id, tab.visible])
  useEffect(() => tab.actions.bindCommands({ refresh }), [tab.actions, refresh])
  useEffect(() => {
    if (!enabled) {
      keys.current.clear()
      pointer.current = undefined
      composing.current = false
      setComposing(false)
    }
  }, [enabled, status?.epoch])

  // React's delegated wheel listener may be passive; this one is attached only to the preview.
  useEffect(() => {
    const element = viewport.current
    if (element === null || !enabled || status === undefined) return
    const wheel = (event: WheelEvent): void => {
      const point = remotePoint(element.getBoundingClientRect(), status.width, status.height, event.clientX, event.clientY)
      if (point === undefined) return
      const deltaY = wheelDelta(event.deltaY, event.deltaMode, status.height)
      const deltaX = wheelDelta(event.deltaX, event.deltaMode, status.width)
      if (deltaX === 0 && deltaY === 0) return
      event.preventDefault()
      event.stopPropagation()
      input(tab.id, { type: 'scroll', ...point, deltaY, deltaX })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { element.removeEventListener('wheel', wheel) }
  }, [enabled, input, tab.id, status?.width, status?.height, status?.epoch])

  const pointFor = (event: ReactPointerEvent<HTMLDivElement>, clamp = false) => status === undefined ? undefined
    : remotePoint(event.currentTarget.getBoundingClientRect(), status.width, status.height, event.clientX, event.clientY, clamp)
  const releaseLocal = (): void => {
    keys.current.clear()
    pointer.current = undefined
    releaseHeld(tab.id)
  }
  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (ownHuman && event.key === 'Escape' && event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.stopPropagation()
      releaseLocal()
      suspend(tab.id)
      event.currentTarget.blur()
      return
    }
    if (!enabled || remoteKey(event.nativeEvent) === undefined) return
    event.preventDefault()
    event.stopPropagation()
    const action = keys.current.down(event.nativeEvent)
    if (action !== undefined && !input(tab.id, action)) keys.current.clear()
  }
  const keyUp = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const action = keys.current.up(event.nativeEvent)
    if (!enabled || action === undefined) return
    event.preventDefault()
    event.stopPropagation()
    input(tab.id, action)
  }
  const run = (action: ControlAction, epoch?: number): void => {
    keys.current.clear()
    pointer.current = undefined
    void control(tab.id, action, epoch)
  }
  const sendText = (): void => {
    if (!enabled || composing.current) return
    if (!validText(draft)) { setTextNotice('invalid'); return }
    if (input(tab.id, { type: 'text', text: draft })) setTextNotice('queued')
  }
  const displayState = status === undefined ? t('state.unknown')
    : running && status.owner === 'none' ? t('state.paused') : t(`state.${status.state}`)
  const mode = ownHuman ? t(state.inputReady ? 'mode.human' : 'mode.waitFrame')
    : status?.owner === 'human' ? t('mode.otherHuman') : t('mode.readonly')

  return (
    <section className={css.root} aria-label={t('title')} onBlur={(event) => {
      if (event.relatedTarget === null || !event.currentTarget.contains(event.relatedTarget)) {
        keys.current.clear()
        pointer.current = undefined
        suspend(tab.id)
      }
    }}>
      <header className={css.header}>
        <div className={css.statusLine}>
          <strong>{displayState}</strong>
          <span className={clsx(css.mode, ownHuman && css.human)}>{mode}</span>
        </div>
        <div className={css.muted}>{t('owner.label')}{'：'}{status === undefined ? '—' : t(`owner.${status.owner}`)}</div>
      </header>
      <div className={css.toolbar} aria-busy={busy}>
        <Button size="sm" variant="primary" disabled={!controlsReady || (status.state !== 'stopped' && status.state !== 'error')}
          onClick={() => { run('start') }}>{t('control.start')}</Button>
        <Button size="sm" variant="outline" disabled={!controlsReady || !running || status.owner === 'none'}
          onClick={() => { run('pause') }}>{t('control.pause')}</Button>
        <Button size="sm" variant="outline" disabled={!controlsReady || !running || status.owner !== 'none'}
          onClick={() => { run('resume') }}>{t('control.resume')}</Button>
        <Button size="sm" variant="outline" disabled={!controlsReady || !running || ownHuman}
          onClick={() => { run('takeover') }}>{t('control.takeover')}</Button>
        <Button size="sm" variant="outline" disabled={!controlsReady || !running || !ownHuman}
          onClick={() => { run('release') }}>{t('control.release')}</Button>
        <Button size="sm" variant="ghost" disabled={!controlsReady || status.state === 'stopped' || status.state === 'stopping'}
          className={css.danger} onClick={() => { releaseLocal(); if (status !== undefined) setStopEpoch(status.epoch); setAcknowledged(false) }}>{t('control.stop')}</Button>
        <Button size="sm" variant="ghost" disabled={!state.connected || busy} onClick={refresh}>{t('control.refresh')}</Button>
      </div>
      {state.pending !== undefined && <p className={css.notice} role="status">
        {t('control.pending', { action: t(`control.${state.pending}`) })}
      </p>}
      {!state.connected && <p className={css.warning} role="status">{t('connection.offline')}</p>}
      {state.problem !== undefined && <div className={css.warning} role="alert">
        <p>{t(`error.${state.problem.kind}`)}</p>
        {state.problem.detail && <p className={css.errorDetail}>{state.problem.detail}</p>}
      </div>}
      {status?.error && <p className={css.warning} role="alert">{status.error}</p>}
      {stopEpoch !== undefined && <section className={css.confirm} aria-labelledby={stopId}>
        <strong id={stopId}>{t('stop.title')}</strong>
        <p>{t('stop.warning')}</p>
        <label className={css.acknowledge}><input type="checkbox" checked={acknowledged}
          onChange={event => { setAcknowledged(event.currentTarget.checked) }} />{t('stop.acknowledge')}</label>
        {status?.epoch !== stopEpoch && <p role="status">{t('stop.changed')}</p>}
        <div className={css.toolbar}>
          <Button size="sm" variant="outline" onClick={() => { setStopEpoch(undefined); setAcknowledged(false) }}>{t('stop.cancel')}</Button>
          <Button size="sm" variant="primary" disabled={!acknowledged || !controlsReady || status.epoch !== stopEpoch}
            onClick={() => { run('stop', stopEpoch); setStopEpoch(undefined); setAcknowledged(false) }}>{t('stop.confirm')}</Button>
        </div>
      </section>}
      <div className={css.previewMeta}>
        <span>{t('preview.rate')}</span>
        {state.frame !== undefined && <span>{t('preview.received', {
          time: new Date(state.frame.receivedAt).toLocaleTimeString('zh-CN', { hour12: false }),
        })}</span>}
      </div>
      <div ref={viewport} className={clsx(css.preview, enabled && css.interactive)}
        role={enabled ? 'application' : 'img'} tabIndex={enabled ? 0 : -1}
        aria-label={t(enabled ? 'preview.interactive' : 'preview.label')} aria-describedby={hintId}
        onKeyDown={keyDown} onKeyUp={keyUp} onBlur={releaseLocal}
        onContextMenu={event => { if (enabled) event.preventDefault() }}
        onPointerDown={event => {
          if (!enabled || event.isPrimary === false || pointer.current !== undefined) return
          const button = remoteButton(event.button)
          const point = pointFor(event)
          if (button === undefined || point === undefined) return
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.focus({ preventScroll: true })
          if (input(tab.id, { type: 'button', button, down: true, ...point })) {
            pointer.current = { id: event.pointerId, button }
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }
        }}
        onPointerMove={event => {
          if (!enabled) return
          const held = pointer.current
          if (held !== undefined && held.id !== event.pointerId) return
          const point = pointFor(event, held !== undefined)
          if (point !== undefined) input(tab.id, { type: 'move', ...point })
        }}
        onPointerUp={event => {
          const held = pointer.current
          if (held === undefined || held.id !== event.pointerId) return
          const point = pointFor(event, true)
          pointer.current = undefined
          if (enabled) input(tab.id, { type: 'button', button: held.button, down: false, ...point })
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={releaseLocal}
        onLostPointerCapture={() => { if (pointer.current !== undefined) releaseLocal() }}>
        {state.frame !== undefined ? <img src={state.frame.url} alt={t('preview.label')} className={css.frame}
          draggable={false} onLoad={event => {
            frameLoaded(tab.id, event.currentTarget.src, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
          }} onError={event => { frameFailed(tab.id, event.currentTarget.src) }} />
          : <p className={css.placeholder}>{t(!state.watching ? 'preview.hidden' : state.problem !== undefined ? 'preview.error'
            : running ? 'preview.waiting' : 'preview.empty')}</p>}
      </div>
      <div className={css.instructions} id={hintId}>
        {status !== undefined && <p>{t('preview.fixed', { width: status.width, height: status.height })}</p>}
        <p>{t(stopEpoch !== undefined ? 'input.confirming' : enabled ? 'input.hint' : 'preview.hint')}</p>
        {ownHuman && !state.inputReady && <p>{t('input.wait')}</p>}
      </div>
      {ownHuman && <Button size="sm" variant="ghost" className={css.reset} onClick={releaseLocal}>{t('input.reset')}</Button>}
      <form className={css.textForm} onSubmit={event => { event.preventDefault(); sendText() }}>
        <label htmlFor={textId}>{t('text.label')}</label>
        <textarea id={textId} className={css.textInput} value={draft} disabled={!enabled} maxLength={4000} rows={3}
          placeholder={t('text.placeholder')} spellCheck={false} autoComplete="off" autoCapitalize="off"
          onChange={event => { setDraft(event.currentTarget.value); setTextNotice(undefined) }}
          onCompositionStart={() => { composing.current = true; setComposing(true) }}
          onCompositionEnd={() => { composing.current = false; setComposing(false) }}
          onKeyDown={event => {
            event.stopPropagation()
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !composing.current
              && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
              event.preventDefault()
              sendText()
            }
          }} onKeyUp={event => { event.stopPropagation() }} />
        <div className={css.textActions}>
          <span className={css.muted}>{isComposing ? t('text.composing') : t('text.count', { count: draft.length })}</span>
          <Button size="sm" variant="outline" type="submit" disabled={!enabled || isComposing || !validText(draft)}>{t('text.send')}</Button>
        </div>
        {textNotice !== undefined && <p className={css.muted} role="status">{t(`text.${textNotice}`)}</p>}
      </form>
      <details className={css.details}>
        <summary>{t('details.label')}</summary>
        <dl>
          <dt>{t('details.session')}</dt><dd>{props.sessionId}</dd>
          <dt>{t('details.backend')}</dt><dd>{status?.backend ?? '—'}</dd>
          <dt>{t('details.display')}</dt><dd>{status?.display ?? '—'}</dd>
          <dt>{t('details.epoch')}</dt><dd>{status?.epoch ?? '—'}</dd>
        </dl>
        {status?.viewerUrl !== undefined && <p>{t('details.viewer')}</p>}
        {status?.applications !== undefined && <div>
          <strong>{t('apps.title', { count: status.applications.length })}</strong>
          <ul>{status.applications.map(app => <li key={app.id}>
            <code>{app.command}</code>{' · '}{t(app.running ? 'apps.running' : 'apps.exited')}
          </li>)}</ul>
        </div>}
      </details>
      <footer className={css.footer}>
        <p>{t('control.description')}</p><p>{t('input.loss')}</p><p>{t('safety.note')}</p>
      </footer>
    </section>
  )
}
