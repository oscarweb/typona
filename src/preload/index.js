import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('typona', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (defaultDir) => ipcRenderer.invoke('dialog:saveFile', defaultDir ?? null),
  suggestFileName: (dirPath) => ipcRenderer.invoke('fs:suggestFileName', dirPath),
  openFolderInNewWindow: (folderPath) => ipcRenderer.invoke('window:openFolderInNewWindow', folderPath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  statPath: (targetPath) => ipcRenderer.invoke('fs:statPath', targetPath),
  getRecents: () => ipcRenderer.invoke('recent:get'),
  addRecent: (entry) => ipcRenderer.invoke('recent:add', entry),
  readTree: (folderPath) => ipcRenderer.invoke('fs:readTree', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  createFile: (dirPath, name, options) => ipcRenderer.invoke('fs:createFile', dirPath, name, options ?? {}),
  createFolder: (dirPath, name) => ipcRenderer.invoke('fs:createFolder', dirPath, name),
  rename: (oldPath, newName) => ipcRenderer.invoke('fs:rename', oldPath, newName),
  trashEntry: (targetPath) => ipcRenderer.invoke('fs:trash', targetPath),
  countEntries: (dirPath) => ipcRenderer.invoke('fs:countEntries', dirPath),
  deleteEntry: (targetPath, isDirectory) => ipcRenderer.invoke('fs:delete', targetPath, isDirectory),
  openLink: (href, basePath) => ipcRenderer.invoke('shell:openLink', href, basePath),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  watchFile: (filePath) => ipcRenderer.invoke('watch:file', filePath ?? null),

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
  onMenuNewFile: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('menu:newFile', listener)
    return () => ipcRenderer.removeListener('menu:newFile', listener)
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
  onFileChangedOnDisk: (callback) => {
    const listener = (_event, filePath) => callback(filePath)
    ipcRenderer.on('file:changedOnDisk', listener)
    return () => ipcRenderer.removeListener('file:changedOnDisk', listener)
  },
  onBeforeClose: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:beforeClose', listener)
    return () => ipcRenderer.removeListener('app:beforeClose', listener)
  },
  confirmClose: () => ipcRenderer.send('app:confirmClose')
})
