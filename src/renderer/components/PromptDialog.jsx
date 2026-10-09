import React, { useEffect, useRef, useState } from 'react'
import useEscapeKey from './useEscapeKey.js'

export default function PromptDialog({ title, detail, defaultValue = '', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef(null)
  useEscapeKey(onCancel)

  // Como en Finder: se selecciona el nombre sin la extensión, así tipear lo reemplaza
  // y ".md" queda intacto.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const dotIndex = defaultValue.lastIndexOf('.')
    input.setSelectionRange(0, dotIndex > 0 ? dotIndex : defaultValue.length)
  }, [defaultValue])

  const submit = (event) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <form className="modal-box" onSubmit={submit}>
        <h3>{title}</h3>
        {detail && <p className="modal-detail" title={detail}>{detail}</p>}
        <label>
          <input ref={inputRef} autoFocus value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button type="submit">Aceptar</button>
        </div>
      </form>
    </div>
  )
}
