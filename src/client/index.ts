/** External Cordis client plugin, registered on the official session-scoped right sidebar. */
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { DesktopBody } from './DesktopBody.tsx'
import { DesktopController } from './DesktopController.ts'
import { createDesktopTransport } from './http.ts'
import { zh } from './locales.ts'

const id = 'dsh-agent-desktop'
const kind = 'agent-desktop'

/** Cordis activation dependencies; module-table externals are independently owned by the build. */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'connection']

/** Register a Chinese tab and callback-only controller face, disposing preview resources but not Host apps. */
export function apply(ctx: Context): void {
  const namespace = 'agentDesktop'
  const t = ctx.locale.bind(namespace)
  const controllers = new Map<string, DesktopController>()
  // Connection's browser face intentionally has no Context property merge (Host uses another face).
  const connection = ctx.get('connection') as ConnectionHandle
  const pageVisible = (): boolean => document.visibilityState !== 'hidden'
  const updateConnection = (): void => {
    const generation = connection.generation.getSnapshot()?.id
    for (const controller of controllers.values()) controller.setConnection(generation)
  }
  const visibility = (): void => {
    for (const controller of controllers.values()) controller.setPageVisible(pageVisible())
  }
  const blur = (): void => { for (const controller of controllers.values()) controller.suspend() }

  ctx.effect(() => ctx.locale.register(namespace, { zh, en: zh }), 'agent-desktop.copy')
  ctx.effect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/api/agent-desktop/style.css'
    document.head.append(link)
    return () => { link.remove() }
  }, 'agent-desktop.styles')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id, kind, keepMounted: true, title: () => t('title'),
    guide: [{ id: 'open', order: 45, title: () => t('title'), description: () => t('guide.description') }],
  }), 'agent-desktop.tab-type')
  ctx.effect(() => {
    const unsubscribe = connection.generation.subscribe(updateConnection)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', blur)
    window.addEventListener('pagehide', blur)
    return async () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', blur)
      window.removeEventListener('pagehide', blur)
      const disposing = [...controllers.values()].map(controller => controller.dispose())
      controllers.clear()
      await Promise.all(disposing)
    }
  }, 'agent-desktop.previews')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: id, locale: namespace,
    inject: sessionId => {
      let controller = controllers.get(sessionId)
      if (controller === undefined) {
        controller = new DesktopController(sessionId, createDesktopTransport(sessionId, window.fetch.bind(window)))
        controller.setConnection(connection.generation.getSnapshot()?.id)
        controller.setPageVisible(pageVisible())
        controllers.set(sessionId, controller)
      }
      return controller.injected
    },
  }, DesktopBody)), 'agent-desktop.body')
}
