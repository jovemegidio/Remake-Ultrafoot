const { app, BrowserWindow, protocol, net, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const OUT_DIR = path.join(__dirname, '..', 'out')
const IS_DEV = process.env.NODE_ENV === 'development'

// Register custom protocol to serve static Next.js export
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      corsEnabled: true,
    },
  },
])

function resolveFile(urlPath) {
  // Clean up path
  let filePath = urlPath === '/' ? '/index.html' : urlPath

  // Try exact file
  let fullPath = path.join(OUT_DIR, filePath)
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) return fullPath

  // Try with .html extension (trailingSlash generates route/index.html)
  const withHtml = fullPath.replace(/\/$/, '') + '.html'
  if (fs.existsSync(withHtml)) return withHtml

  // Try route/index.html (trailingSlash: true)
  const withIndex = path.join(fullPath, 'index.html')
  if (fs.existsSync(withIndex)) return withIndex

  // Fallback to root index.html (client-side routing handles it)
  return path.join(OUT_DIR, 'index.html')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    frame: true,
    icon: path.join(__dirname, '..', 'public', 'icon-light-32x32.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  })

  win.once('ready-to-show', () => win.show())

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (IS_DEV) {
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools()
  } else {
    win.loadURL('app://./index.html')
  }
}

app.whenReady().then(() => {
  // Register app:// protocol to serve static files
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const filePath = resolveFile(pathname)
    return net.fetch('file://' + filePath)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
