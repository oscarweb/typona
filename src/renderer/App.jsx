import React, { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import MilkdownEditor from './components/Editor.jsx'
import StatusBar from './components/StatusBar.jsx'
import PromptDialog from './components/PromptDialog.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import RecentList from './components/RecentList.jsx'
import { dirname, joinRelative, tailPath } from './pathUtils.js'

function parseHeadings(markdown) {
  const headings = []
  let inFence = false

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (/^```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim() })
    }
  }

  return headings
}

const MAX_RECENT_TITLES = 30
const READ_MODE_HINT = 'Modo lectura: doble click o ⌘E para editar'

function extractTitles(markdown) {
  return parseHeadings(markdown)
    .map((heading) => heading.text)
    .slice(0, MAX_RECENT_TITLES)
}

function resolveRelativePath(basePath, href) {
  const baseDir = basePath.slice(0, basePath.lastIndexOf('/'))
  return joinRelative(baseDir, href)
}

export default function App() {
  const [tree, setTree] = useState(null)
  const [folderPath, setFolderPath] = useState(null)
  const [looseFiles, setLooseFiles] = useState([])
  const [activePath, setActivePath] = useState(null)
  const [activeContent, setActiveContent] = useState('')
  const [sidebarTab, setSidebarTab] = useState('files')
  const [headings, setHeadings] = useState([])
  const [isDirty, setIsDirty] = useState(false)
  const [modifiedAt, setModifiedAt] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [activeHeadingIndex, setActiveHeadingIndex] = useState(-1)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [recents, setRecents] = useState([])
  const [updateInfo, setUpdateInfo] = useState(null)
  const [externalChange, setExternalChange] = useState(null)
  const [statusNotice, setStatusNotice] = useState(null)
  // archivo recién creado: el editor pone el cursor al final apenas lo monta
  const [autoFocusPath, setAutoFocusPath] = useState(null)
  // Modo lectura (por defecto al abrir) / edición. Ver docs/features/editor/modo-lectura.md
  const [isEditing, setIsEditing] = useState(false)

  const editorRef = useRef(null)
  const editorScrollRef = useRef(null)
  const activePathRef = useRef(null)
  const isDirtyRef = useRef(false)
  const isEditingRef = useRef(false)
  const draftsRef = useRef(new Map())
  // path -> último contenido que sabemos que está en disco (al abrir, recargar o guardar).
  // Sirve para distinguir cambios hechos por otro programa de los guardados propios.
  const diskSnapshotsRef = useRef(new Map())
  const statusNoticeTimerRef = useRef(null)

  useEffect(() => {
    activePathRef.current = activePath
  }, [activePath])

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    isEditingRef.current = isEditing
    // la ayuda de "cómo editar" ya no aplica una vez en edición
    if (isEditing) setStatusNotice((notice) => (notice === READ_MODE_HINT ? null : notice))
  }, [isEditing])

  useEffect(() => {
    window.typona.getRecents().then(setRecents).catch(() => {})
  }, [])

  useEffect(() => {
    window.typona
      .checkForUpdate()
      .then((result) => {
        if (result?.hasUpdate) setUpdateInfo(result)
      })
      .catch(() => {})
  }, [])

  const showStatusNotice = useCallback((text) => {
    clearTimeout(statusNoticeTimerRef.current)
    setStatusNotice(text)
    statusNoticeTimerRef.current = setTimeout(() => setStatusNotice(null), 3000)
  }, [])

  const toggleEditMode = useCallback(() => {
    if (!activePathRef.current) return
    setIsEditing((prev) => !prev)
  }, [])

  // En modo lectura tipear no hace nada: se avisa cómo pasar a edición.
  useEffect(() => {
    const handler = (event) => {
      if (!activePathRef.current || isEditingRef.current) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return
      if (event.target.closest?.('input, textarea, .modal-overlay')) return
      showStatusNotice(READ_MODE_HINT)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showStatusNotice])

  // Fecha de última modificación en disco del archivo activo (barra de estado).
  const refreshModifiedAt = useCallback(async (path) => {
    let mtimeMs = null
    try {
      const stats = await window.typona.statPath(path)
      mtimeMs = stats.mtimeMs
    } catch {
      // el archivo ya no existe en disco
    }
    if (activePathRef.current === path) setModifiedAt(mtimeMs)
  }, [])

  const writeActiveFile = useCallback(async (path, markdown) => {
    const snapshots = diskSnapshotsRef.current
    const previousSnapshot = snapshots.get(path)
    // Se actualiza antes de escribir: el watcher puede avisar del propio guardado
    // antes de que termine el await, y tiene que reconocerlo como "ya conocido".
    snapshots.set(path, markdown)
    try {
      await window.typona.saveFile(path, markdown)
      draftsRef.current.delete(path)
      if (activePathRef.current === path) {
        setIsDirty(false)
        setExternalChange(null)
        refreshModifiedAt(path)
      }
    } catch (err) {
      if (previousSnapshot === undefined) snapshots.delete(path)
      else snapshots.set(path, previousSnapshot)
      setErrorMessage(`No se pudo guardar el archivo: ${err.message}`)
    }
  }, [refreshModifiedAt])

  const handleSave = useCallback(async () => {
    const path = activePathRef.current
    const editor = editorRef.current
    if (!path || !editor) return
    const markdown = editor.getMarkdown()
    const snapshot = diskSnapshotsRef.current.get(path)
    let diskContent = null
    try {
      diskContent = await window.typona.readFile(path)
    } catch {
      // el archivo ya no existe en disco: guardar lo vuelve a crear
    }
    if (diskContent !== null && snapshot !== undefined && diskContent !== snapshot) {
      setDialog({
        type: 'confirm',
        message: 'Otro programa modificó este archivo desde que lo abriste. ¿Sobrescribirlo con tu versión?',
        danger: true,
        confirmLabel: 'Sobrescribir',
        onConfirm: () => writeActiveFile(path, markdown)
      })
      return
    }
    await writeActiveFile(path, markdown)
  }, [writeActiveFile])

  const openFile = useCallback(async (path) => {
    const prevPath = activePathRef.current
    if (prevPath === path) return
    const editor = editorRef.current
    if (prevPath && editor && isDirtyRef.current) {
      draftsRef.current.set(prevPath, editor.getMarkdown())
    }
    try {
      const hasDraft = draftsRef.current.has(path)
      let diskContent = null
      try {
        diskContent = await window.typona.readFile(path)
      } catch (err) {
        if (!hasDraft) throw err
      }
      const content = hasDraft ? draftsRef.current.get(path) : diskContent
      const snapshots = diskSnapshotsRef.current
      let nextExternalChange = null
      if (!hasDraft) {
        snapshots.set(path, diskContent)
      } else if (diskContent === null) {
        nextExternalChange = { type: 'deleted', path }
      } else if (!snapshots.has(path)) {
        snapshots.set(path, diskContent)
      } else if (diskContent !== snapshots.get(path)) {
        nextExternalChange = { type: 'conflict', path, diskContent }
      }
      setActivePath(path)
      setActiveContent(content)
      setHeadings(parseHeadings(content))
      setIsDirty(hasDraft)
      setIsEditing(false)
      setExternalChange(nextExternalChange)
    } catch (err) {
      setErrorMessage(`No se pudo abrir el archivo: ${err.message}`)
    }
  }, [])

  const applyDiskContent = useCallback((path, content) => {
    const scroller = editorScrollRef.current
    const scrollTop = scroller?.scrollTop ?? 0
    editorRef.current?.replaceContent(content)
    if (scroller) scroller.scrollTop = scrollTop
    diskSnapshotsRef.current.set(path, content)
    draftsRef.current.delete(path)
    setActiveContent(content)
    setHeadings(parseHeadings(content))
    setIsDirty(false)
    setExternalChange(null)
  }, [])

  const handleExternalChange = useCallback(
    async (changedPath) => {
      if (changedPath !== activePathRef.current) return
      const readDisk = () => window.typona.readFile(changedPath).catch(() => null)
      let diskContent = await readDisk()
      if (diskContent === null) {
        // algunos programas borran y vuelven a escribir el archivo; se espera un poco
        // antes de darlo por eliminado
        await new Promise((resolve) => setTimeout(resolve, 500))
        diskContent = await readDisk()
      }
      if (changedPath !== activePathRef.current) return

      if (diskContent === null) {
        setExternalChange({ type: 'deleted', path: changedPath })
        setIsDirty(true)
        setModifiedAt(null)
        return
      }
      refreshModifiedAt(changedPath)
      if (diskContent === diskSnapshotsRef.current.get(changedPath)) {
        // guardado propio, o el archivo reapareció igual a como lo conocíamos
        setExternalChange((prev) => (prev?.type === 'deleted' ? null : prev))
        return
      }
      if (!isDirtyRef.current) {
        applyDiskContent(changedPath, diskContent)
        showStatusNotice('↻ Actualizado desde disco')
        return
      }
      setExternalChange({ type: 'conflict', path: changedPath, diskContent })
    },
    [applyDiskContent, showStatusNotice, refreshModifiedAt]
  )

  const reloadFromDisk = useCallback(() => {
    if (externalChange?.type !== 'conflict') return
    applyDiskContent(externalChange.path, externalChange.diskContent)
    showStatusNotice('↻ Actualizado desde disco')
  }, [externalChange, applyDiskContent, showStatusNotice])

  const keepLocalChanges = useCallback(() => {
    if (externalChange?.type !== 'conflict') return
    // se toma la versión de disco como "conocida": guardar ya no vuelve a advertir,
    // salvo que el archivo cambie otra vez
    diskSnapshotsRef.current.set(externalChange.path, externalChange.diskContent)
    setExternalChange(null)
  }, [externalChange])

  const handleLinkClick = useCallback(
    async (href) => {
      try {
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
          await window.typona.openLink(href)
          return
        }
        if (href.startsWith('#')) {
          editorRef.current?.scrollToAnchor(decodeURIComponent(href.slice(1)))
          return
        }
        const hashIndex = href.indexOf('#')
        const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex)
        const hashPart = hashIndex === -1 ? '' : href.slice(hashIndex + 1)
        const currentPath = activePathRef.current

        if (pathPart && currentPath && /\.(md|markdown)$/i.test(pathPart)) {
          const resolvedPath = resolveRelativePath(currentPath, pathPart)
          const exists = await window.typona
            .readFile(resolvedPath)
            .then(() => true)
            .catch(() => false)
          if (exists) {
            await openFile(resolvedPath)
            if (hashPart) {
              setTimeout(() => editorRef.current?.scrollToAnchor(decodeURIComponent(hashPart)), 200)
            }
            return
          }
        }
        await window.typona.openLink(href, currentPath)
      } catch (err) {
        setErrorMessage(err.message)
      }
    },
    [openFile]
  )

  const loadFolder = useCallback(async (nextFolderPath) => {
    try {
      const nextTree = await window.typona.readTree(nextFolderPath)
      draftsRef.current.clear()
      setFolderPath(nextFolderPath)
      setTree(nextTree)
      const updatedRecents = await window.typona.addRecent({ path: nextFolderPath, type: 'dir' })
      setRecents(updatedRecents)
    } catch (err) {
      setErrorMessage(`No se pudo abrir la carpeta: ${err.message}`)
    }
  }, [])

  const openFolderPath = useCallback(
    async (nextFolderPath) => {
      try {
        const hasExistingContent = tree !== null || looseFiles.length > 0
        if (hasExistingContent) {
          await window.typona.openFolderInNewWindow(nextFolderPath)
          return
        }
        await loadFolder(nextFolderPath)
      } catch (err) {
        setErrorMessage(`No se pudo abrir la carpeta: ${err.message}`)
      }
    },
    [tree, looseFiles, loadFolder]
  )

  const openFolder = useCallback(async () => {
    try {
      const nextFolderPath = await window.typona.openFolder()
      if (!nextFolderPath) return
      await openFolderPath(nextFolderPath)
    } catch (err) {
      setErrorMessage(`No se pudo abrir la carpeta: ${err.message}`)
    }
  }, [openFolderPath])

  const addLooseFiles = useCallback(
    async (paths) => {
      if (!paths || paths.length === 0) return
      try {
        setLooseFiles((prev) => {
          const merged = [...prev]
          for (const path of paths) {
            if (!merged.includes(path)) merged.push(path)
          }
          return merged
        })
        await openFile(paths[0])
        let updatedRecents
        for (const path of paths) {
          let titles = []
          try {
            titles = extractTitles(await window.typona.readFile(path))
          } catch {
            // no se pudo leer el archivo para sacar sus títulos; no bloquea el registro en recientes
          }
          updatedRecents = await window.typona.addRecent({ path, type: 'file', titles })
        }
        if (updatedRecents) setRecents(updatedRecents)
      } catch (err) {
        setErrorMessage(`No se pudo abrir el archivo: ${err.message}`)
      }
    },
    [openFile]
  )

  const openFilesDialog = useCallback(async () => {
    try {
      const paths = await window.typona.openFile()
      await addLooseFiles(paths)
    } catch (err) {
      setErrorMessage(`No se pudo abrir el archivo: ${err.message}`)
    }
  }, [addLooseFiles])

  const openRecent = useCallback(
    async (entry) => {
      if (entry.type === 'dir') {
        await openFolderPath(entry.path)
      } else {
        await addLooseFiles([entry.path])
      }
    },
    [openFolderPath, addLooseFiles]
  )

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
    setIsDraggingOver(true)
  }, [])

  const handleDragLeave = useCallback((event) => {
    if (event.target === event.currentTarget) setIsDraggingOver(false)
  }, [])

  const handleDrop = useCallback(
    async (event) => {
      event.preventDefault()
      setIsDraggingOver(false)

      const droppedPaths = Array.from(event.dataTransfer.files)
        .map((file) => window.typona.getPathForFile(file))
        .filter(Boolean)
      if (droppedPaths.length === 0) return

      const mdFiles = []
      const folders = []
      for (const droppedPath of droppedPaths) {
        try {
          const { isDirectory } = await window.typona.statPath(droppedPath)
          if (isDirectory) folders.push(droppedPath)
          else if (/\.(md|markdown)$/i.test(droppedPath)) mdFiles.push(droppedPath)
        } catch (err) {
          setErrorMessage(`No se pudo leer "${droppedPath}": ${err.message}`)
        }
      }

      await addLooseFiles(mdFiles)

      const [firstFolder, ...restFolders] = folders
      if (firstFolder) await openFolderPath(firstFolder)
      for (const folderPath of restFolders) {
        try {
          await window.typona.openFolderInNewWindow(folderPath)
        } catch (err) {
          setErrorMessage(`No se pudo abrir la carpeta: ${err.message}`)
        }
      }
    },
    [addLooseFiles, openFolderPath]
  )

  const refreshTree = useCallback(async (rootPath) => {
    const path = rootPath ?? folderPath
    if (!path) return
    try {
      const nextTree = await window.typona.readTree(path)
      setTree(nextTree)
    } catch (err) {
      setErrorMessage(`No se pudo actualizar el árbol de archivos: ${err.message}`)
    }
  }, [folderPath])

  const closeActiveIfUnder = useCallback((targetPath, isDirectory) => {
    for (const draftPath of draftsRef.current.keys()) {
      const draftMatches = isDirectory
        ? draftPath === targetPath || draftPath.startsWith(`${targetPath}/`)
        : draftPath === targetPath
      if (draftMatches) draftsRef.current.delete(draftPath)
    }
    for (const snapshotPath of [...diskSnapshotsRef.current.keys()]) {
      const snapshotMatches = isDirectory
        ? snapshotPath === targetPath || snapshotPath.startsWith(`${targetPath}/`)
        : snapshotPath === targetPath
      if (snapshotMatches) diskSnapshotsRef.current.delete(snapshotPath)
    }
    const path = activePathRef.current
    if (!path) return
    const matches = isDirectory ? path === targetPath || path.startsWith(`${targetPath}/`) : path === targetPath
    if (matches) {
      setActivePath(null)
      setActiveContent('')
      setHeadings([])
      setIsDirty(false)
      setExternalChange(null)
    }
  }, [])

  const handleRemoveLooseFile = useCallback(
    (path) => {
      setLooseFiles((prev) => prev.filter((p) => p !== path))
      if (activePathRef.current === path) {
        closeActiveIfUnder(path, false)
      }
    },
    [closeActiveIfUnder]
  )

  // Abre un archivo recién creado: como archivo suelto (se suma a "Archivos abiertos" y a
  // Recientes) o como parte del árbol de la carpeta abierta.
  const openCreatedFile = useCallback(
    async (filePath, { asLooseFile }) => {
      setAutoFocusPath(filePath)
      await refreshTree()
      if (asLooseFile) await addLooseFiles([filePath])
      else await openFile(filePath)
    },
    [refreshTree, addLooseFiles, openFile]
  )

  // Pide solo el nombre: la carpeta destino ya está definida.
  const promptNewFile = useCallback(
    async (dirPath, { asLooseFile }) => {
      let suggestedName = 'sin-titulo.md'
      try {
        suggestedName = await window.typona.suggestFileName(dirPath)
      } catch {
        // si no se puede leer la carpeta, se sugiere el nombre por defecto
      }
      setDialog({
        type: 'prompt',
        title: 'Nuevo archivo',
        detail: `En ${tailPath(dirPath)}`,
        defaultValue: suggestedName,
        onConfirm: async (name) => {
          try {
            const filePath = await window.typona.createFile(dirPath, name)
            await openCreatedFile(filePath, { asLooseFile })
          } catch (err) {
            setErrorMessage(err.message)
          }
        }
      })
    },
    [openCreatedFile]
  )

  // Click derecho en una carpeta (o archivo) del árbol.
  const handleCreateFile = useCallback((dirPath) => promptNewFile(dirPath, { asLooseFile: false }), [promptNewFile])

  // Click derecho en un archivo de "Archivos abiertos": crea un hermano en su misma carpeta.
  const handleCreateSibling = useCallback(
    (filePath) => promptNewFile(dirname(filePath), { asLooseFile: true }),
    [promptNewFile]
  )

  // Menú "Nuevo archivo…" / Cmd+N / botón de la sidebar.
  const newFile = useCallback(async () => {
    const activePath = activePathRef.current
    const activeDir = activePath ? dirname(activePath) : null

    if (tree !== null && folderPath) {
      // con carpeta abierta: dentro de la carpeta del archivo activo, o en la raíz
      const insideFolder = activeDir && (activeDir === folderPath || activeDir.startsWith(`${folderPath}/`))
      await promptNewFile(insideFolder ? activeDir : folderPath, { asLooseFile: false })
      return
    }

    try {
      const filePath = await window.typona.saveFileDialog(activeDir)
      if (!filePath) return
      // si se eligió reemplazar un archivo que estaba abierto, se cierra antes (ya se confirmó)
      closeActiveIfUnder(filePath, false)
      const createdPath = await window.typona.createFile(dirname(filePath), filePath.split('/').pop(), {
        replace: true
      })
      await openCreatedFile(createdPath, { asLooseFile: true })
    } catch (err) {
      setErrorMessage(`No se pudo crear el archivo: ${err.message}`)
    }
  }, [tree, folderPath, promptNewFile, closeActiveIfUnder, openCreatedFile])

  const handleCreateFolder = useCallback(
    (dirPath) => {
      setDialog({
        type: 'prompt',
        title: 'Nombre de la carpeta',
        defaultValue: '',
        onConfirm: async (name) => {
          try {
            await window.typona.createFolder(dirPath, name)
            await refreshTree()
          } catch (err) {
            setErrorMessage(err.message)
          }
        }
      })
    },
    [refreshTree]
  )

  const handleRename = useCallback(
    (node) => {
      setDialog({
        type: 'prompt',
        title: 'Nuevo nombre',
        defaultValue: node.name,
        onConfirm: async (newName) => {
          if (newName === node.name) return
          try {
            const newPath = await window.typona.rename(node.path, newName)
            setLooseFiles((prev) => prev.map((p) => (p === node.path ? newPath : p)))
            for (const draftPath of [...draftsRef.current.keys()]) {
              if (draftPath === node.path) {
                draftsRef.current.set(newPath, draftsRef.current.get(draftPath))
                draftsRef.current.delete(draftPath)
              } else if (node.type === 'dir' && draftPath.startsWith(`${node.path}/`)) {
                draftsRef.current.set(draftPath.replace(node.path, newPath), draftsRef.current.get(draftPath))
                draftsRef.current.delete(draftPath)
              }
            }
            const snapshots = diskSnapshotsRef.current
            for (const snapshotPath of [...snapshots.keys()]) {
              if (snapshotPath === node.path) {
                snapshots.set(newPath, snapshots.get(snapshotPath))
                snapshots.delete(snapshotPath)
              } else if (node.type === 'dir' && snapshotPath.startsWith(`${node.path}/`)) {
                snapshots.set(snapshotPath.replace(node.path, newPath), snapshots.get(snapshotPath))
                snapshots.delete(snapshotPath)
              }
            }
            setExternalChange(null)
            if (activePathRef.current === node.path) {
              setActivePath(newPath)
            } else if (node.type === 'dir' && activePathRef.current?.startsWith(`${node.path}/`)) {
              setActivePath(activePathRef.current.replace(node.path, newPath))
            }
            await refreshTree()
          } catch (err) {
            setErrorMessage(err.message)
          }
        }
      })
    },
    [refreshTree]
  )

  const handleRemoved = useCallback(
    async (node) => {
      const isDirectory = node.type === 'dir'
      const isUnder = (p) => p === node.path || (isDirectory && p.startsWith(`${node.path}/`))
      setLooseFiles((prev) => prev.filter((p) => !isUnder(p)))
      closeActiveIfUnder(node.path, isDirectory)
      await refreshTree()
    },
    [refreshTree, closeActiveIfUnder]
  )

  const confirmPermanentDelete = useCallback(
    (node) => {
      setDialog({
        type: 'confirm',
        message: `No se pudo mover "${node.name}" a la Papelera. ¿Eliminarlo permanentemente?`,
        details: ['Esta acción no se puede deshacer.'],
        danger: true,
        confirmLabel: 'Eliminar permanentemente',
        cancelIsDefault: true,
        onConfirm: async () => {
          try {
            await window.typona.deleteEntry(node.path, node.type === 'dir')
            await handleRemoved(node)
          } catch (err) {
            setErrorMessage(err.message)
          }
        }
      })
    },
    [handleRemoved]
  )

  const handleDelete = useCallback(
    async (node) => {
      const isDirectory = node.type === 'dir'
      const isUnder = (p) => p === node.path || (isDirectory && p.startsWith(`${node.path}/`))
      const details = []

      if (isDirectory) {
        try {
          const { files, notInTree } = await window.typona.countEntries(node.path)
          if (files === 0) {
            details.push('La carpeta está vacía.')
          } else {
            const hiddenNote = notInTree > 0 ? ` (${notInTree} no se ven en el árbol: ocultos o que no son markdown)` : ''
            details.push(`Contiene ${files} archivo${files === 1 ? '' : 's'}${hiddenNote}.`)
          }
        } catch {
          // si no se puede contar, se confirma igual sin ese detalle
        }
      }

      const activePath = activePathRef.current
      const hasUnsavedChanges =
        (isDirtyRef.current && activePath && isUnder(activePath)) || [...draftsRef.current.keys()].some(isUnder)
      if (hasUnsavedChanges) details.push('Hay cambios sin guardar que se van a perder.')

      details.push('Vas a poder recuperarlo desde la Papelera.')

      setDialog({
        type: 'confirm',
        message: `¿Mover ${isDirectory ? 'la carpeta' : 'el archivo'} "${node.name}" a la Papelera?`,
        details,
        confirmLabel: 'Mover a la Papelera',
        cancelIsDefault: true,
        onConfirm: async () => {
          try {
            await window.typona.trashEntry(node.path)
          } catch {
            confirmPermanentDelete(node)
            return
          }
          await handleRemoved(node)
        }
      })
    },
    [handleRemoved, confirmPermanentDelete]
  )

  useEffect(() => {
    const offNewFile = window.typona.onMenuNewFile(newFile)
    const offOpen = window.typona.onMenuOpenFolder(openFolder)
    const offOpenFile = window.typona.onMenuOpenFile(openFilesDialog)
    const offSave = window.typona.onMenuSave(handleSave)
    const offToggleEditMode = window.typona.onMenuToggleEditMode(toggleEditMode)
    return () => {
      offToggleEditMode()
      offNewFile()
      offOpen()
      offOpenFile()
      offSave()
    }
  }, [newFile, openFolder, openFilesDialog, handleSave, toggleEditMode])

  useEffect(() => {
    return window.typona.onLoadFolder(loadFolder)
  }, [loadFolder])

  useEffect(() => {
    window.typona.watchFile(activePath).catch(() => {})
  }, [activePath])

  useEffect(() => {
    if (activePath) refreshModifiedAt(activePath)
    else setModifiedAt(null)
  }, [activePath, refreshModifiedAt])

  useEffect(() => {
    return window.typona.onFileChangedOnDisk(handleExternalChange)
  }, [handleExternalChange])

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  useEffect(() => {
    return window.typona.onBeforeClose(() => {
      const hasUnsavedChanges = isDirtyRef.current || draftsRef.current.size > 0
      if (!hasUnsavedChanges) {
        window.typona.confirmClose()
        return
      }
      setDialog({
        type: 'confirm',
        message: 'Hay cambios sin guardar. ¿Cerrar Typona de todos modos?',
        danger: true,
        onConfirm: () => window.typona.confirmClose()
      })
    })
  }, [])

  const handleMarkdownChange = useCallback((markdown) => {
    setHeadings(parseHeadings(markdown))
    setIsDirty(true)
  }, [])

  useEffect(() => {
    if (!activePath) {
      document.title = 'Typona'
      return
    }
    const fileName = activePath.split(/[\\/]/).pop()
    document.title = `${isDirty ? '● ' : ''}${fileName} — Typona`
  }, [activePath, isDirty])

  const handleSelectHeading = useCallback((index) => {
    editorRef.current?.scrollToHeadingIndex(index)
  }, [])

  useEffect(() => {
    const container = editorScrollRef.current
    if (!container || headings.length === 0) {
      setActiveHeadingIndex(-1)
      return
    }

    const handleScroll = () => {
      const headingEls = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const containerTop = container.getBoundingClientRect().top
      let current = -1
      headingEls.forEach((el, index) => {
        if (el.getBoundingClientRect().top - containerTop <= 32) current = index
      })
      setActiveHeadingIndex(current)
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [headings, activePath])

  return (
    <div
      className={`app${isDraggingOver ? ' app--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="drop-overlay">
          <span>Soltá para abrir</span>
        </div>
      )}
      <Sidebar
        tab={sidebarTab}
        onTabChange={setSidebarTab}
        tree={tree}
        looseFiles={looseFiles}
        activePath={activePath}
        isDirty={isDirty}
        onOpenFile={openFile}
        onOpenFolder={openFolder}
        onOpenFileDialog={openFilesDialog}
        onNewFile={newFile}
        onCreateSibling={handleCreateSibling}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onRename={handleRename}
        onDelete={handleDelete}
        onRemoveLooseFile={handleRemoveLooseFile}
        headings={headings}
        activeHeadingIndex={activeHeadingIndex}
        onSelectHeading={handleSelectHeading}
      />

      <div className="editor-pane">
        {updateInfo && (
          <div className="update-banner">
            <span>
              Hay una versión nueva disponible (v{updateInfo.latestVersion}) —{' '}
              <button className="update-banner-link" onClick={() => window.typona.openLink(updateInfo.url)}>
                Ver Release
              </button>
            </span>
            <button onClick={() => setUpdateInfo(null)}>✕</button>
          </div>
        )}
        {errorMessage && (
          <div className="error-banner">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)}>✕</button>
          </div>
        )}
        {externalChange?.type === 'conflict' && (
          <div className="external-banner">
            <span>Otro programa modificó este archivo y vos tenés cambios sin guardar.</span>
            <span className="external-banner-actions">
              <button onClick={reloadFromDisk}>Recargar (descartar mis cambios)</button>
              <button onClick={keepLocalChanges}>Mantener mis cambios</button>
            </span>
          </div>
        )}
        {externalChange?.type === 'deleted' && (
          <div className="external-banner">
            <span>Este archivo fue eliminado o movido fuera de Typona. Guardá (⌘S) para volver a crearlo.</span>
            <button onClick={() => setExternalChange(null)}>✕</button>
          </div>
        )}
        {activePath ? (
          <>
            <div className="editor-scroll" ref={editorScrollRef}>
              <MilkdownEditor
                ref={editorRef}
                fileKey={activePath}
                baseDir={activePath.slice(0, activePath.lastIndexOf('/'))}
                initialContent={activeContent}
                editable={isEditing}
                autoFocus={autoFocusPath === activePath}
                onAutoFocused={() => {
                  setAutoFocusPath(null)
                  setIsEditing(true)
                }}
                onRequestEdit={() => setIsEditing(true)}
                onRequestRead={() => setIsEditing(false)}
                onMarkdownChange={handleMarkdownChange}
                onLinkClick={handleLinkClick}
              />
            </div>
            <StatusBar
              filePath={activePath}
              modifiedAt={modifiedAt}
              isDirty={isDirty}
              isEditing={isEditing}
              onToggleMode={toggleEditMode}
              notice={statusNotice}
            />
          </>
        ) : tree === null && looseFiles.length === 0 ? (
          <RecentList recents={recents} onOpen={openRecent} />
        ) : (
          <div className="editor-placeholder">Abrí una carpeta y seleccioná un archivo .md para empezar</div>
        )}
      </div>

      {dialog?.type === 'prompt' && (
        <PromptDialog
          title={dialog.title}
          detail={dialog.detail}
          defaultValue={dialog.defaultValue}
          onConfirm={(value) => {
            setDialog(null)
            dialog.onConfirm(value)
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'confirm' && (
        <ConfirmDialog
          message={dialog.message}
          details={dialog.details}
          danger={dialog.danger}
          confirmLabel={dialog.confirmLabel}
          cancelIsDefault={dialog.cancelIsDefault}
          onConfirm={() => {
            setDialog(null)
            dialog.onConfirm()
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}
