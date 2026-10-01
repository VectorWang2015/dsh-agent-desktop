/** JSON wire values shared by the Host broker and sidebar. */
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
  windows?: Array<{ id: number; title: string }>
  applications?: Array<{ id: string; command: string; pid?: number; running: boolean }>
}
/** Returned only to the authenticated UI that successfully acquired human control. */
export interface DesktopControlResult extends DesktopStatus { controlToken?: string }
export type DesktopAction =
  | { type: 'move'; x: number; y: number }
  | { type: 'click'; x: number; y: number; button?: 'left' | 'middle' | 'right'; count?: 1 | 2 }
  | { type: 'button'; button: 'left' | 'middle' | 'right'; down: boolean; x?: number; y?: number }
  | { type: 'scroll'; deltaY: number; deltaX?: number; x?: number; y?: number }
  | { type: 'key'; key: string; down: boolean }
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
export interface Frame {
  data: Buffer
  width: number
  height: number
  timestamp: string
  windows?: Array<{ id: number; title: string }>
}
export interface DesktopBackend {
  start(signal?: AbortSignal): Promise<{ display: string }>
  frame(signal?: AbortSignal): Promise<Frame>
  input(action: DesktopAction, signal?: AbortSignal): Promise<void>
  release(): Promise<void>
  launch(request: ApplicationRequest, signal?: AbortSignal): Promise<{ id: string; pid: number }>
  stop(): Promise<void>
  onExit?(handler: (error: Error) => void): void
}
