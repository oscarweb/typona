import React, { useLayoutEffect, useRef, useState } from 'react'
import { ClockIcon, EyeIcon, PencilIcon } from './Icons.jsx'

const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n) => String(n).padStart(2, '0')

// Formato compacto: "14:32" (hoy), "ayer 09:10", "9 oct 14:32", "5 mar 2025" (otro año, sin hora).
// Se arma a mano porque toLocaleString('es-AR') usa 12 h ("02:32 p. m.") y "9 de oct de 2025".
function formatModifiedAt(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)

  if (diffDays === 0) return time
  if (diffDays === 1) return `ayer ${time}`

  const day = `${date.getDate()} ${date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}`
  if (date.getFullYear() === now.getFullYear()) return `${day} ${time}`
  return `${day} ${date.getFullYear()}`
}

function formatFullDate(timestamp) {
  return new Date(timestamp).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'medium', hourCycle: 'h23' })
}

// Devuelve la ruta más larga que entra en el ancho disponible, recortando siempre
// en un límite de carpeta: "/a/b/c/d.md" -> "…/b/c/d.md" -> "…/c/d.md" -> "…/d.md".
function shortenPath(fullPath, fits) {
  if (fits(fullPath)) return fullPath
  const parts = fullPath.split('/').filter(Boolean)
  for (let start = 1; start < parts.length; start++) {
    const candidate = `…/${parts.slice(start).join('/')}`
    if (fits(candidate)) return candidate
  }
  return `…/${parts[parts.length - 1]}`
}

function FilePath({ path }) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(path)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const context = document.createElement('canvas').getContext('2d')

    const update = () => {
      const style = getComputedStyle(el)
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const available = el.clientWidth
      setDisplay(shortenPath(path, (text) => context.measureText(text).width <= available))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [path])

  return (
    <span ref={ref} className="status-path" title={path}>
      {display}
    </span>
  )
}

export default function StatusBar({ filePath, modifiedAt, isDirty, isEditing, onToggleMode, notice }) {
  return (
    <div className="status-bar">
      <span className="status-left">
        {modifiedAt != null && (
          <>
            <span className="status-modified" title={`Última modificación: ${formatFullDate(modifiedAt)}`}>
              <ClockIcon />
              {formatModifiedAt(modifiedAt)}
            </span>
            <span className="status-separator">·</span>
          </>
        )}
        {filePath && <FilePath path={filePath} />}
      </span>
      <span className="status-right">
        {notice && <span className="status-notice">{notice}</span>}
        <button
          type="button"
          className={`status-mode${isEditing ? ' editing' : ''}`}
          onClick={onToggleMode}
          title={
            isEditing
              ? 'Click, ⌘E o Escape para volver a modo lectura'
              : 'Click, ⌘E o doble click en el texto para editar'
          }
        >
          {isEditing ? <PencilIcon /> : <EyeIcon />}
          Modo: {isEditing ? 'Edición' : 'Lectura'}
        </button>
        <span className={`status-dot${isDirty ? ' dirty' : ''}`}>
          {isDirty ? '● Sin guardar' : '✓ Guardado'}
        </span>
      </span>
    </div>
  )
}
