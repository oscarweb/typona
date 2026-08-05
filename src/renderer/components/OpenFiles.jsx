import React, { useState } from 'react'
import ContextMenu from './ContextMenu.jsx'
import { FileIcon } from './Icons.jsx'

export default function OpenFiles({ files, activePath, isDirty, onOpenFile, onRename, onDelete, onRemove }) {
  const [menu, setMenu] = useState(null)

  if (!files || files.length === 0) return null

  const openMenuFor = (event, filePath) => {
    event.preventDefault()
    const node = { path: filePath, name: filePath.split(/[\\/]/).pop(), type: 'file' }
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: 'Quitar de la lista', onClick: () => onRemove(filePath) },
        { separator: true },
        { label: 'Renombrar…', onClick: () => onRename(node) },
        { label: 'Eliminar archivo', danger: true, onClick: () => onDelete(node) }
      ]
    })
  }

  return (
    <div className="open-files">
      <div className="sidebar-section-title">Archivos abiertos</div>
      {files.map((filePath) => {
        const isActive = filePath === activePath
        return (
          <div
            key={filePath}
            className={`tree-row${isActive ? ' active' : ''}`}
            onClick={() => onOpenFile(filePath)}
            onContextMenu={(event) => openMenuFor(event, filePath)}
            title={filePath}
          >
            <span className="icon"><FileIcon /></span>
            <span>{filePath.split(/[\\/]/).pop()}</span>
            {isActive && isDirty && <span className="dirty-marker">●</span>}
          </div>
        )
      })}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  )
}
