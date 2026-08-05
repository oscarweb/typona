import React, { useState } from 'react'

export default function LinkDialog({ withText, onConfirm, onCancel }) {
  const [text, setText] = useState('')
  const [href, setHref] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (!href.trim()) return
    onConfirm({ text: text.trim(), href: href.trim() })
  }

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <form className="modal-box" onSubmit={submit}>
        <h3>Enlace</h3>
        {withText && (
          <label>
            Texto
            <input autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="Texto visible" />
          </label>
        )}
        <label>
          URL
          <input
            autoFocus={!withText}
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button type="submit">{withText ? 'Insertar' : 'Aplicar'}</button>
        </div>
      </form>
    </div>
  )
}
