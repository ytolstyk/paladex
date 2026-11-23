import { app, BrowserWindow, dialog, ipcMain, Menu, screen, session, type IpcMainInvokeEvent } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC, type ProfileInfo } from '../shared/ipc'
import { parsePlayState } from '../shared/schema'
import { migrateLegacyProfile, PROFILE_NAME, profileDir, type ProfileOptions } from './profile'
import { StateStore } from './store'
import { placeWindow, WindowStateStore, type WindowDefaults } from './windowState'

const WINDOW: WindowDefaults = { width: 1280, height: 760, minWidth: 960, minHeight: 560 }
/** How long to wait after the last move/resize before writing the window's frame to disk. */
const WINDOW_SAVE_DELAY_MS = 400
const WINDOW_BACKGROUND = '#1b130d' // matches --oak in tokens.css so there is no white flash
const isProdProfile = app.isPackaged || process.env['PALADEX_PROFILE'] === 'prod'
const isDevProfile = !isProdProfile

const profileOptions = (): ProfileOptions => ({
  appData: app.getPath('appData'),
  isProd: isProdProfile,
  override: process.env['PALADEX_USER_DATA']
})

// Order matters: the store path derives from userData, so the profile must be chosen before anything reads it.
// An unpackaged dev run must never touch real play state, hence the separate "(dev)" profile.
try {
  migrateLegacyProfile(profileOptions()) // carries play state across the rename; copies once, never deletes
} catch (err) {
  console.error('Could not copy play state from the pre-rename profile:', err)
}
app.setName(PROFILE_NAME)
app.setPath('userData', profileDir(profileOptions()))

const store = new StateStore(join(app.getPath('userData'), 'state'))
const windowStore = new WindowStateStore(join(app.getPath('userData'), 'window-state.json'))
let mainWindow: BrowserWindow | null = null

/** Vite dev-server URL when running unpackaged under `npm run dev`; null for built/packaged runs. */
function rendererUrl(): string | null {
  return app.isPackaged ? null : (process.env['ELECTRON_RENDERER_URL'] ?? null)
}

const BUILT_RENDERER_PATH = pathToFileURL(join(__dirname, '../renderer/index.html')).pathname

/** True only for the app's own page: exact origin (dev) or exact file (built), and only the top frame. */
function isAppPage(url: string): boolean {
  try {
    const target = new URL(url)
    const dev = rendererUrl()
    if (dev) return target.origin === new URL(dev).origin
    return target.protocol === 'file:' && target.pathname === BUILT_RENDERER_PATH
  } catch {
    return false
  }
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame
  return frame !== null && frame === mainWindow?.webContents.mainFrame && isAppPage(frame.url)
}

function registerIpc(): void {
  const guard = <A extends unknown[], R>(fn: (...args: A) => Promise<R> | R) =>
    (event: IpcMainInvokeEvent, ...args: A): Promise<R> | R => {
      if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender')
      return fn(...args)
    }

  ipcMain.handle(IPC.loadState, guard(() => store.load()))

  ipcMain.handle(
    IPC.saveState,
    guard(async (raw: unknown) => {
      const parsed = parsePlayState(raw)
      if (!parsed.ok) throw new Error(`Refusing to save invalid state: ${parsed.reason}`)
      await store.save(parsed.state)
    })
  )

  ipcMain.handle(
    IPC.exportState,
    guard(async () => {
      const raw = await store.readRaw()
      if (raw === null) return null
      const stamp = new Date().toISOString().slice(0, 10)
      const result = await dialog.showSaveDialog({
        title: 'Export play state',
        defaultPath: `paladex-${stamp}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, raw, 'utf8')
      return result.filePath
    })
  )

  ipcMain.handle(IPC.resetState, guard(() => store.reset()))

  ipcMain.handle(
    IPC.profileInfo,
    guard((): ProfileInfo => ({ isDev: isDevProfile, stateDir: store.directory }))
  )
}

/** Remember where the user leaves the window (size, position, maximized, full screen) and reopen it there. */
function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  let lastWritten = ''
  const capture = (): void => {
    if (win.isDestroyed()) return
    try {
      // getNormalBounds is the windowed frame even while maximized or full screen, so un-maximizing later restores it.
      const state = { ...win.getNormalBounds(), maximized: win.isMaximized(), fullScreen: win.isFullScreen() }
      const serialized = JSON.stringify(state)
      if (serialized === lastWritten) return // restoring maximized/full screen at launch fires events but changes nothing
      windowStore.save(state)
      lastWritten = serialized
    } catch (err) {
      console.error('Could not save the window position:', err) // a view preference: never worth interrupting play
    }
  }
  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(capture, WINDOW_SAVE_DELAY_MS)
  }
  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('maximize', schedule)
  win.on('unmaximize', schedule)
  win.on('enter-full-screen', schedule)
  win.on('leave-full-screen', schedule)
  win.on('close', () => {
    if (timer) clearTimeout(timer)
    capture()
  })
}

function createWindow(): void {
  const saved = windowStore.load()
  const displays = screen.getAllDisplays()
  const placement = placeWindow(
    saved,
    displays.map((d) => d.workArea),
    screen.getPrimaryDisplay().workArea,
    WINDOW
  )
  mainWindow = new BrowserWindow({
    ...placement,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    show: false,
    title: isDevProfile ? `${PROFILE_NAME} (dev)` : PROFILE_NAME,
    titleBarStyle: 'hiddenInset',
    backgroundColor: WINDOW_BACKGROUND,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  if (saved?.maximized) mainWindow.maximize()
  if (saved?.fullScreen) mainWindow.setFullScreen(true)
  trackWindowState(mainWindow)

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Lock navigation: the app is one local page. It opens no windows and launches nothing externally.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppPage(url)) event.preventDefault()
  })
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAppPage(url)) event.preventDefault()
  })

  const dev = rendererUrl()
  if (dev) void mainWindow.loadURL(dev)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  attachDevScreenshotHook(mainWindow)
}

/**
 * Dev-only verification aid: PALADEX_SHOT=<png path> [PALADEX_EVAL=<js file>] [PALADEX_SIZE=WxH] captures the window and quits.
 * Disabled in packaged builds.
 */
function attachDevScreenshotHook(win: BrowserWindow): void {
  const shot = process.env['PALADEX_SHOT']
  if (app.isPackaged || !shot) return
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  win.webContents.once('did-finish-load', async () => {
    await wait(1500)
    // PALADEX_SIZE=960x640 checks a narrow or short window (the media queries follow the real viewport).
    const size = /^(\d{3,4})x(\d{3,4})$/.exec(process.env['PALADEX_SIZE'] ?? '')
    if (size) {
      win.setMinimumSize(1, 1)
      win.setSize(Number(size[1]), Number(size[2]))
      await wait(400)
    }
    const evalFile = process.env['PALADEX_EVAL']
    if (evalFile) {
      await win.webContents.executeJavaScript(readFileSync(evalFile, 'utf8'))
      await wait(600)
    }
    const image = await win.webContents.capturePage()
    writeFileSync(shot, image.toPNG())
    app.quit()
  })
}

function buildMenu(): void {
  // The Edit menu deliberately has no Undo/Redo: a native Cmd+Z accelerator would swallow the keystroke before
  // the app's own undo (hooks/useShortcuts.ts) sees it.
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: 'Edit',
      submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', enabled: isDevProfile },
        { role: 'toggleDevTools', enabled: isDevProfile },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Packaged builds get the icon from the app bundle; an unpackaged dev run would otherwise show Electron's.
    const devIcon = join(app.getAppPath(), 'build/icon.png')
    if (process.platform === 'darwin' && !app.isPackaged && existsSync(devIcon)) app.dock?.setIcon(devIcon)
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
    registerIpc()
    buildMenu()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Flush queued state writes before the process exits so the last taps are never lost.
  let flushed = false
  app.on('before-quit', (event) => {
    if (flushed) return
    event.preventDefault()
    store
      .flush()
      .catch((err: unknown) => console.error('Could not flush state before quit:', err))
      .finally(() => {
        flushed = true
        app.quit()
      })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
