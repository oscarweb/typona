import React, { useMemo, useState } from 'react'
import { FileIcon, FolderIcon } from './Icons.jsx'

const VISIBLE_BY_DEFAULT = 10

export default function RecentList({ recents, onOpen }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return recents.slice(0, VISIBLE_BY_DEFAULT)
    return recents.filter((entry) => entry.path.toLowerCase().includes(trimmed))
  }, [recents, query])

  if (recents.length === 0) {
    return <div className="editor-placeholder">Abrí una carpeta y seleccioná un archivo .md para empezar</div>
  }

  return (
    <div className="recent-list">
      <h2>Recientes</h2>

      {recents.length > VISIBLE_BY_DEFAULT && (
        <input
          type="text"
          className="recent-search"
          placeholder="Buscar en recientes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}

      <ul>
        {filtered.map((entry) => {
          const name = entry.path.split(/[\\/]/).pop()
          const Icon = entry.type === 'dir' ? FolderIcon : FileIcon
          return (
            <li key={entry.path}>
              <button className="recent-item" onClick={() => onOpen(entry)}>
                <Icon />
                <span className="recent-name">{name}</span>
                <span className="recent-path">{entry.path}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {!query && recents.length > VISIBLE_BY_DEFAULT && (
        <p className="recent-hint">
          Mostrando los {VISIBLE_BY_DEFAULT} más recientes de {recents.length} — buscá para ver el resto.
        </p>
      )}
    </div>
  )
}
