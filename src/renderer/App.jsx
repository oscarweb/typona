import React, { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import MilkdownEditor from './components/Editor.jsx'
import StatusBar from './components/StatusBar.jsx'
import PromptDialog from './components/PromptDialog.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import RecentList from './components/RecentList.jsx'
import { joinRelative } from './pathUtils.js'

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

function computeWordStats(markdown) {
  const trimmed = markdown.trim()
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
  return { words, chars: markdown.length }
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
  const [wordStats, setWordStats] = useState({ words: 0, chars: 0 })
  const [errorMessage, setErrorMessage] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [activeHeadingIndex, setActiveHeadingIndex] = useState(-1)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [recents, setRecents] = useState([])
  const [updateInfo, setUpdateInfo] = useState(null)

  const editorRef = useRef(null)
  const editorScrollRef = useRef(null)
  const activePathRef = useRef(null)
  const isDirtyRef = useRef(false)
  const draftsRef = useRef(new Map())

  useEffect(() => {
    activePathRef.current = activePath
  }, [activePath])

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

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

  const handleSave = useCallback(async () => {
    const path = activePathRef.current
    const editor = editorRef.current
    if (!path || !editor) return
    try {
      const markdown = editor.getMarkdown()
      await window.typona.saveFile(path, markdown)
      draftsRef.current.delete(path)
      setIsDirty(false)
    } catch (err) {
      setErrorMessage(`No se pudo guardar el archivo: ${err.message}`)
    }
  }, [])

  const openFile = useCallback(async (path) => {
    const prevPath = activePathRef.current
    if (prevPath === path) return
    const editor = editorRef.current
    if (prevPath && editor && isDirtyRef.current) {
      draftsRef.current.set(prevPath, editor.getMarkdown())
    }
    try {
      const hasDraft = draftsRef.current.has(path)
      const content = hasDraft ? draftsRef.current.get(path) : await window.typona.readFile(path)
      setActivePath(path)
      setActiveContent(content)
      setHeadings(parseHeadings(content))
      setWordStats(computeWordStats(content))
      setIsDirty(hasDraft)
    } catch (err) {
      setErrorMessage(`No se pudo abrir el archivo: ${err.message}`)
    }
  }, [])

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
          updatedRecents = await window.typona.addRecent({ path, type: 'file' })
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
    const path = activePathRef.current
    if (!path) return
    const matches = isDirectory ? path === targetPath || path.startsWith(`${targetPath}/`) : path === targetPath
    if (matches) {
      setActivePath(null)
      setActiveContent('')
      setHeadings([])
      setIsDirty(false)
      setWordStats({ words: 0, chars: 0 })
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

  const handleCreateFile = useCallback(
    (dirPath) => {
      setDialog({
        type: 'prompt',
        title: 'Nombre del archivo',
        defaultValue: 'nuevo-archivo.md',
        onConfirm: async (name) => {
          try {
            await window.typona.createFile(dirPath, name)
            await refreshTree()
          } catch (err) {
            setErrorMessage(err.message)
          }
        }
      })
    },
    [refreshTree]
  )

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

  const handleDelete = useCallback(
    (node) => {
      const label = node.type === 'dir' ? 'carpeta' : 'archivo'
      setDialog({
        type: 'confirm',
        message: `¿Eliminar la ${label} "${node.name}"? Esta acción no se puede deshacer.`,
        danger: true,
        onConfirm: async () => {
          try {
            await window.typona.deleteEntry(node.path, node.type === 'dir')
            setLooseFiles((prev) => prev.filter((p) => p !== node.path))
            closeActiveIfUnder(node.path, node.type === 'dir')
            await refreshTree()
          } catch (err) {
            setErrorMessage(err.message)
          }
        }
      })
    },
    [refreshTree, closeActiveIfUnder]
  )

  useEffect(() => {
    const offOpen = window.typona.onMenuOpenFolder(openFolder)
    const offOpenFile = window.typona.onMenuOpenFile(openFilesDialog)
    const offSave = window.typona.onMenuSave(handleSave)
    return () => {
      offOpen()
      offOpenFile()
      offSave()
    }
  }, [openFolder, openFilesDialog, handleSave])

  useEffect(() => {
    return window.typona.onLoadFolder(loadFolder)
  }, [loadFolder])

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
    setWordStats(computeWordStats(markdown))
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
        {activePath ? (
          <>
            <div className="editor-scroll" ref={editorScrollRef}>
              <MilkdownEditor
                ref={editorRef}
                fileKey={activePath}
                baseDir={activePath.slice(0, activePath.lastIndexOf('/'))}
                initialContent={activeContent}
                onMarkdownChange={handleMarkdownChange}
                onLinkClick={handleLinkClick}
              />
            </div>
            <StatusBar words={wordStats.words} chars={wordStats.chars} isDirty={isDirty} />
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
          danger={dialog.danger}
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
