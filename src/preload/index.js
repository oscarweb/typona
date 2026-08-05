import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('typona', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFolderInNewWindow: (folderPath) => ipcRenderer.invoke('window:openFolderInNewWindow', folderPath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  statPath: (targetPath) => ipcRenderer.invoke('fs:statPath', targetPath),
  readTree: (folderPath) => ipcRenderer.invoke('fs:readTree', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  createFile: (dirPath, name) => ipcRenderer.invoke('fs:createFile', dirPath, name),
  createFolder: (dirPath, name) => ipcRenderer.invoke('fs:createFolder', dirPath, name),
  rename: (oldPath, newName) => ipcRenderer.invoke('fs:rename', oldPath, newName),
  deleteEntry: (targetPath, isDirectory) => ipcRenderer.invoke('fs:delete', targetPath, isDirectory),
  openLink: (href, basePath) => ipcRenderer.invoke('shell:openLink', href, basePath),

  onMenuOpenFolder: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('menu:openFolder', listener)
    return () => ipcRenderer.removeListener('menu:openFolder', listener)
  },
  onMenuOpenFile: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('menu:openFile', listener)
    return () => ipcRenderer.removeListener('menu:openFile', listener)
  },
  onMenuSave: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('menu:save', listener)
    return () => ipcRenderer.removeListener('menu:save', listener)
  },
  onLoadFolder: (callback) => {
    const listener = (_event, folderPath) => callback(folderPath)
    ipcRenderer.on('app:loadFolder', listener)
    return () => ipcRenderer.removeListener('app:loadFolder', listener)
  },
  onBeforeClose: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:beforeClose', listener)
    return () => ipcRenderer.removeListener('app:beforeClose', listener)
  },
  confirmClose: () => ipcRenderer.send('app:confirmClose')
})
