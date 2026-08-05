import React from 'react'
import FileTree from './FileTree.jsx'
import OpenFiles from './OpenFiles.jsx'
import Outline from './Outline.jsx'

export default function Sidebar({
  tab,
  onTabChange,
  tree,
  looseFiles,
  activePath,
  isDirty,
  onOpenFile,
  onOpenFolder,
  onOpenFileDialog,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onRemoveLooseFile,
  headings,
  activeHeadingIndex,
  onSelectHeading
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab${tab === 'files' ? ' active' : ''}`}
          onClick={() => onTabChange('files')}
        >
          ARCHIVOS
        </button>
        <button
          className={`sidebar-tab${tab === 'outline' ? ' active' : ''}`}
          onClick={() => onTabChange('outline')}
        >
          OUTLINE
        </button>
      </div>

      <div className="open-buttons">
        <button className="open-folder-btn" onClick={onOpenFolder}>
          Abrir Carpeta…
        </button>
        <button className="open-folder-btn" onClick={onOpenFileDialog}>
          Abrir Archivo…
        </button>
      </div>

      <div className="sidebar-body">
        {tab === 'files' ? (
          <>
            <OpenFiles
              files={looseFiles}
              activePath={activePath}
              isDirty={isDirty}
              onOpenFile={onOpenFile}
              onRename={onRename}
              onDelete={onDelete}
              onRemove={onRemoveLooseFile}
            />
            <FileTree
              tree={tree}
              activePath={activePath}
              isDirty={isDirty}
              onOpenFile={onOpenFile}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          </>
        ) : (
          <Outline headings={headings} activeIndex={activeHeadingIndex} onSelect={onSelectHeading} />
        )}
      </div>
    </div>
  )
}
