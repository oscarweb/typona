import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

const MD_EXT = new Set(['.md', '.markdown'])

async function buildTree(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })

  const children = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      const sub = await buildTree(fullPath)
      if (sub.children.length > 0 || sub.isEmptyDir) {
        children.push(sub)
      }
    } else if (MD_EXT.has(path.extname(entry.name).toLowerCase())) {
      children.push({ name: entry.name, path: fullPath, type: 'file', children: [] })
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return {
    name: path.basename(dirPath),
    path: dirPath,
    type: 'dir',
    children,
    isEmptyDir: entries.length === 0
  }
}

function wrap(fn, actionLabel) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      throw new Error(`${actionLabel}: ${err.message}`)
    }
  }
}

export function registerFsHandlers() {
  ipcMain.handle(
    'dialog:openFolder',
    wrap(async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }, 'No se pudo abrir el diálogo de carpeta')
  )

  ipcMain.handle(
    'dialog:openFile',
    wrap(async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
      })
      if (result.canceled) return []
      return result.filePaths
    }, 'No se pudo abrir el diálogo de archivo')
  )

  ipcMain.handle(
    'fs:statPath',
    wrap(async (_event, targetPath) => {
      const stats = await fs.stat(targetPath)
      return { isDirectory: stats.isDirectory() }
    }, 'No se pudo leer la ruta')
  )

  ipcMain.handle(
    'fs:readTree',
    wrap((_event, folderPath) => buildTree(folderPath), 'No se pudo leer la carpeta')
  )

  ipcMain.handle(
    'fs:readFile',
    wrap((_event, filePath) => fs.readFile(filePath, 'utf-8'), 'No se pudo leer el archivo')
  )

  ipcMain.handle(
    'fs:writeFile',
    wrap(async (_event, filePath, content) => {
      await fs.writeFile(filePath, content, 'utf-8')
      return true
    }, 'No se pudo guardar el archivo')
  )

  ipcMain.handle(
    'fs:createFile',
    wrap(async (_event, dirPath, name) => {
      const fileName = MD_EXT.has(path.extname(name).toLowerCase()) ? name : `${name}.md`
      const filePath = path.join(dirPath, fileName)
      await fs.writeFile(filePath, '', { flag: 'wx' })
      return filePath
    }, 'No se pudo crear el archivo')
  )

  ipcMain.handle(
    'fs:createFolder',
    wrap(async (_event, dirPath, name) => {
      const folderPath = path.join(dirPath, name)
      await fs.mkdir(folderPath)
      return folderPath
    }, 'No se pudo crear la carpeta')
  )

  ipcMain.handle(
    'fs:rename',
    wrap(async (_event, oldPath, newName) => {
      const newPath = path.join(path.dirname(oldPath), newName)
      await fs.rename(oldPath, newPath)
      return newPath
    }, 'No se pudo renombrar')
  )

  ipcMain.handle(
    'fs:delete',
    wrap(async (_event, targetPath, isDirectory) => {
      await fs.rm(targetPath, { recursive: isDirectory, force: false })
      return true
    }, 'No se pudo eliminar')
  )

  ipcMain.handle(
    'shell:openLink',
    wrap(async (_event, href, basePath) => {
      if (/^([a-z][a-z0-9+.-]*):/i.test(href) && !/^[a-z]:[\\/]/i.test(href)) {
        const error = await shell.openExternal(href)
        if (error) throw new Error(error)
        return true
      }
      const target = path.isAbsolute(href)
        ? href
        : path.resolve(path.dirname(basePath ?? '.'), href)
      const error = await shell.openPath(target)
      if (error) throw new Error(error)
      return true
    }, 'No se pudo abrir el enlace')
  )
}
