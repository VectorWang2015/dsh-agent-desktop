/** JSON wire values shared by the Host broker and sidebar. */
export interface DesktopRegion { x: number; y: number; width: number; height: number }
export interface DesktopSize { width: number; height: number }
export interface WindowInfo {
  id: number
  title: string
  pid: number | null
  mapped: boolean
  focusable: boolean | null
  focused: boolean
  active: boolean
  modal: boolean
  transientFor: number | null
  supportsDelete: boolean
  geometry: DesktopRegion
}
/** Tracks the exact launch process, not an assumed whole GUI application family. */
export interface ApplicationInfo {
  id: string
  command: string
  pid?: number
  running: boolean
  exitCode?: number | null
  observedAt?: string
  windowIds?: number[]
}
export interface InputState {
  heldKeys: string[]
  heldButtons: string[]
  lastAutoReleaseAt?: string
}
export interface DesktopInventory {
  applications: ApplicationInfo[]
  windows: WindowInfo[]
  focusedWindowId: number | null
  activeWindowId: number | null
  observedAt: string
  input: InputState
}
export interface DesktopStatus {
  sessionId: string
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
  owner: 'none' | 'agent' | 'human'
  epoch: number
  backend: string
  width: number
  height: number
  startedAt?: string
  lastFrameAt?: string
  lastActionAt?: string
  error?: string
  display?: string
  viewerUrl?: string
  windows?: Array<Pick<WindowInfo, 'id' | 'title'> & Partial<WindowInfo>>
  applications?: ApplicationInfo[]
  focusedWindowId?: number | null
  activeWindowId?: number | null
  observedAt?: string
  inspectionError?: string
  input?: InputState
}
/** Returned only to the authenticated UI that successfully acquired human control. */
export interface DesktopControlResult extends DesktopStatus { controlToken?: string }
export type DesktopAction =
  | { type: 'move'; x: number; y: number }
  | { type: 'click'; x: number; y: number; button?: 'left' | 'middle' | 'right'; count?: 1 | 2 }
  | { type: 'button'; button: 'left' | 'middle' | 'right'; down: boolean; x?: number; y?: number }
  | { type: 'scroll'; deltaY: number; deltaX?: number; x?: number; y?: number }
  | { type: 'key'; key: string; down: boolean }
  | { type: 'press'; key: string; modifiers?: Array<'Control' | 'Alt' | 'Shift' | 'Meta'> }
  | { type: 'release' }
  | { type: 'text'; text: string }
export type ControlAction = 'start' | 'pause' | 'takeover' | 'release' | 'resume' | 'stop'
export interface ApplicationRequest {
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
}
export interface NativePaths {
  python: string
  xvfb: string
  windowManager?: string
  windowManagerArgs?: string[]
  dataDirs?: string
  terminal?: string
  libraryPath?: string
  binaryPath?: string
  selkies?: string
}
export interface FrameOptions {
  /** The UI may cache; model observations request fresh by default. */
  fresh?: boolean
  region?: DesktopRegion
  cursor?: boolean
}
export interface Frame {
  data: Buffer
  width: number
  height: number
  timestamp: string
  frameId?: string
  region?: DesktopRegion
  cached?: boolean
  inventory?: DesktopInventory
  windows?: Array<Pick<WindowInfo, 'id' | 'title'> & Partial<WindowInfo>>
}
export interface PixelProbe {
  frameId: string
  capturedAt: string
  coordinateSpace: 'desktop'
  cursorOverlay: false
  samples: Array<{ x: number; y: number; rgba: [number, number, number, number] }>
}
export interface WindowOperation {
  requested: boolean
  windowId: number
  confirmed?: boolean
  focusedWindowId?: number | null
  reason?: string
}
export interface DesktopBackend {
  start(signal?: AbortSignal): Promise<{ display: string }>
  frame(signal?: AbortSignal, options?: FrameOptions): Promise<Frame>
  input(action: DesktopAction, signal?: AbortSignal, actor?: 'agent' | 'human'): Promise<void>
  release(): Promise<void>
  launch(request: ApplicationRequest, signal?: AbortSignal): Promise<{ id: string; pid: number }>
  inspect?(signal?: AbortSignal): Promise<DesktopInventory>
  probe?(points: Array<{ x: number; y: number }>, signal?: AbortSignal): Promise<PixelProbe>
  focus?(windowId: number, signal?: AbortSignal): Promise<WindowOperation>
  closeWindow?(windowId: number, signal?: AbortSignal): Promise<WindowOperation>
  stop(): Promise<void>
  onExit?(handler: (error: Error) => void): void
}
