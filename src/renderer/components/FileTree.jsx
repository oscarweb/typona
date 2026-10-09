import React, { useEffect, useRef, useState } from 'react'
import ContextMenu from './ContextMenu.jsx'
import { FileIcon, FolderIcon, ChevronIcon } from './Icons.jsx'
import { dirname } from '../pathUtils.js'

function TreeNode({ node, activePath, isDirty, onOpenFile, onContextMenu, collapsed, onToggleCollapse, depth = 0 }) {
  if (node.type === 'file') {
    const isActive = node.path === activePath
    return (
      <div
        className={`tree-row${isActive ? ' active' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onOpenFile(node.path)}
        onContextMenu={(event) => onContextMenu(event, node)}
        title={node.path}
      >
        <span className="icon chevron-spacer" />
        <span className="icon"><FileIcon /></span>
        <span>{node.name}</span>
        {isActive && isDirty && <span className="dirty-marker">●</span>}
      </div>
    )
  }

  const isCollapsed = collapsed.has(node.path)

  return (
    <div className="tree-node">
      <div
        className="tree-row"
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onToggleCollapse(node.path)}
        onContextMenu={(event) => onContextMenu(event, node)}
      >
        <span className={`icon chevron${isCollapsed ? ' collapsed' : ''}`}><ChevronIcon /></span>
        <span className="icon"><FolderIcon /></span>
        <span>{node.name}</span>
      </div>
      {!isCollapsed && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              activePath={activePath}
              isDirty={isDirty}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree({ tree, activePath, isDirty, onOpenFile, onCreateFile, onCreateFolder, onRename, onDelete }) {
  const [menu, setMenu] = useState(null)
  const [collapsed, setCollapsed] = useState(() => new Set())
  const rootRef = useRef(null)

  // Al cambiar el archivo activo (por ejemplo, uno recién creado) se expanden las
  // carpetas que lo contienen y la fila queda visible.
  useEffect(() => {
    if (!activePath) return
    setCollapsed((prev) => {
      const ancestors = [...prev].filter((dir) => activePath.startsWith(`${dir}/`))
      if (ancestors.length === 0) return prev
      const next = new Set(prev)
      ancestors.forEach((dir) => next.delete(dir))
      return next
    })
  }, [activePath])

  useEffect(() => {
    rootRef.current?.querySelector('.tree-row.active')?.scrollIntoView({ block: 'nearest' })
  }, [activePath, tree])

  if (!tree) {
    return <div className="sidebar-empty">Abrí una carpeta para ver tus archivos .md</div>
  }

  const closeMenu = () => setMenu(null)

  const toggleCollapse = (path) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const openMenuFor = (event, node) => {
    event.preventDefault()
    event.stopPropagation()
    const isFolder = node.type === 'dir'
    const items = []
    if (isFolder) {
      items.push({ label: 'Nuevo archivo…', onClick: () => onCreateFile(node.path) })
      items.push({ label: 'Nueva carpeta…', onClick: () => onCreateFolder(node.path) })
      items.push({ separator: true })
    } else {
      items.push({ label: 'Nuevo archivo en esta carpeta…', onClick: () => onCreateFile(dirname(node.path)) })
      items.push({ separator: true })
    }
    if (node !== tree) {
      items.push({ label: 'Renombrar…', onClick: () => onRename(node) })
      items.push({ label: 'Mover a la Papelera', onClick: () => onDelete(node) })
    }
    if (items.length === 0) return
    setMenu({ x: event.clientX, y: event.clientY, items })
  }

  const openRootMenu = (event) => {
    if (event.target !== event.currentTarget) return
    openMenuFor(event, tree)
  }

  return (
    <div className="tree-root" ref={rootRef} onContextMenu={openRootMenu}>
      {tree.children.length === 0 ? (
        <div className="sidebar-empty">No se encontraron archivos .md en esta carpeta</div>
      ) : (
        tree.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            activePath={activePath}
            isDirty={isDirty}
            onOpenFile={onOpenFile}
            onContextMenu={openMenuFor}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
          />
        ))
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
    </div>
  )
}
