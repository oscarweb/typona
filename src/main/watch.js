import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

// Los IDEs/agentes escriben en ráfagas; se agrupan los eventos y se avisa una sola vez.
const DEBOUNCE_MS = 300

// webContents.id -> { watcher, timer }. Un solo archivo vigilado por ventana (el activo).
const watchers = new Map()
const trackedSenders = new Set()

function stopWatching(senderId) {
  const entry = watchers.get(senderId)
  if (!entry) return
  clearTimeout(entry.timer)
  entry.watcher.close()
  watchers.delete(senderId)
}

export function registerWatchHandlers() {
  ipcMain.handle('watch:file', (event, filePath) => {
    const { sender } = event
    const senderId = sender.id
    stopWatching(senderId)
    if (!filePath) return false

    if (!trackedSenders.has(senderId)) {
      trackedSenders.add(senderId)
      sender.once('destroyed', () => {
        stopWatching(senderId)
        trackedSenders.delete(senderId)
      })
    }

    // Se vigila la carpeta y no el archivo: muchos editores guardan de forma "atómica"
    // (escriben un temporal y lo renombran encima), y un watcher sobre el archivo
    // original deja de recibir eventos después del primer reemplazo.
    const fileName = path.basename(filePath)
    let watcher
    try {
      watcher = fs.watch(path.dirname(filePath), (_eventType, changedName) => {
        if (changedName && changedName !== fileName) return
        const entry = watchers.get(senderId)
        if (!entry) return
        clearTimeout(entry.timer)
        entry.timer = setTimeout(() => {
          if (!sender.isDestroyed()) sender.send('file:changedOnDisk', filePath)
        }, DEBOUNCE_MS)
      })
    } catch {
      return false
    }

    watcher.on('error', () => stopWatching(senderId))
    watchers.set(senderId, { watcher, timer: null })
    return true
  })
}
