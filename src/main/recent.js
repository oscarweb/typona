import { app, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_RECENTS = 50

function recentFilePath() {
  return path.join(app.getPath('userData'), 'recent.json')
}

async function readRecents() {
  try {
    const raw = await fs.readFile(recentFilePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeRecents(entries) {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(recentFilePath(), JSON.stringify(entries, null, 2), 'utf-8')
}

async function withoutMissing(entries) {
  const results = []
  for (const entry of entries) {
    try {
      const stats = await fs.stat(entry.path)
      const isDirectory = stats.isDirectory()
      if ((entry.type === 'dir') === isDirectory) results.push(entry)
    } catch {
      // el path ya no existe (se borró/movió) -> se descarta del historial
    }
  }
  return results
}

export function registerRecentHandlers() {
  ipcMain.handle('recent:get', async () => {
    const entries = await withoutMissing(await readRecents())
    return entries
  })

  ipcMain.handle('recent:add', async (_event, { path: targetPath, type }) => {
    const entries = await withoutMissing(await readRecents())
    const filtered = entries.filter((entry) => entry.path !== targetPath)
    filtered.unshift({ path: targetPath, type, openedAt: Date.now() })
    const trimmed = filtered.slice(0, MAX_RECENTS)
    await writeRecents(trimmed)
    return trimmed
  })
}
