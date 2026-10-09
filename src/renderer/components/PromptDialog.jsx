import React, { useState } from 'react'
import useEscapeKey from './useEscapeKey.js'

export default function PromptDialog({ title, defaultValue = '', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue)
  useEscapeKey(onCancel)

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
        <label>
          <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button type="submit">Aceptar</button>
        </div>
      </form>
    </div>
  )
}
