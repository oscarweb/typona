import { app, BrowserWindow, Menu, ipcMain, nativeImage, protocol, net } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerFsHandlers } from './fs.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appIcon = nativeImage.createFromPath(path.join(app.getAppPath(), 'build', 'icon.png'))
if (appIcon.isEmpty()) console.error('No se pudo cargar build/icon.png')

// Esquema custom para resolver imágenes con ruta relativa al archivo .md abierto
// (un <img src="..."> relativo no tiene forma de saber contra qué carpeta resolverse).
protocol.registerSchemesAsPrivileged([
  { scheme: 'typona-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

function createWindow(folderToLoad) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Typona',
    backgroundColor: '#282c34',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  let allowClose = false

  win.on('close', (event) => {
    if (allowClose) return
    event.preventDefault()
    win.webContents.send('app:beforeClose')
  })

  const confirmCloseHandler = (event) => {
    if (BrowserWindow.fromWebContents(event.sender) === win) {
      allowClose = true
      win.close()
    }
  }
  ipcMain.on('app:confirmClose', confirmCloseHandler)
  win.on('closed', () => ipcMain.removeListener('app:confirmClose', confirmCloseHandler))

  if (folderToLoad) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('app:loadFolder', folderToLoad)
    })
  }

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

function buildMenu() {
  const send = (channel) => BrowserWindow.getFocusedWindow()?.webContents.send(channel)

  const template = [
    {
      label: 'Typona',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Abrir Carpeta…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('menu:openFolder')
        },
        {
          label: 'Abrir Archivo…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('menu:openFile')
        },
        { type: 'separator' },
        {
          label: 'Guardar',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('menu:save')
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.setIcon(appIcon)

  protocol.handle('typona-asset', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname)
    return net.fetch(pathToFileURL(filePath).href)
  })

  registerFsHandlers()
  buildMenu()
  createWindow()

  ipcMain.handle('window:openFolderInNewWindow', (_event, folderPath) => {
    createWindow(folderPath)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
