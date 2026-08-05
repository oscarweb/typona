import React, { useMemo, useState } from 'react'
import { FileIcon, FolderIcon, SearchIcon } from './Icons.jsx'

const VISIBLE_BY_DEFAULT = 10

function formatRelativeTime(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return 'Hace un momento'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Hace ${diffMin} min`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `Hace ${diffHour} h`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `Hace ${diffDay} d`

  if (diffDay < 30) return `Hace ${Math.floor(diffDay / 7)} sem`

  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30)
    return `Hace ${months} mes${months > 1 ? 'es' : ''}`
  }

  const years = Math.floor(diffDay / 365)
  return `Hace ${years} año${years > 1 ? 's' : ''}`
}

function matches(entry, query) {
  const name = entry.path.split(/[\\/]/).pop().toLowerCase()
  if (name.includes(query) || entry.path.toLowerCase().includes(query)) return true
  return (entry.titles ?? []).some((title) => title.toLowerCase().includes(query))
}

export default function RecentList({ recents, onOpen }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return recents.slice(0, VISIBLE_BY_DEFAULT)
    return recents.filter((entry) => matches(entry, trimmed))
  }, [recents, query])

  if (recents.length === 0) {
    return <div className="editor-placeholder">Abrí una carpeta y seleccioná un archivo .md para empezar</div>
  }

  return (
    <div className="recent-list">
      <h2>Recientes</h2>

      {recents.length > VISIBLE_BY_DEFAULT && (
        <div className="recent-search-wrap">
          <SearchIcon />
          <input
            type="text"
            className="recent-search"
            placeholder="Buscar por nombre, ruta o título…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
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
                <span className="recent-time">{formatRelativeTime(entry.openedAt)}</span>
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
