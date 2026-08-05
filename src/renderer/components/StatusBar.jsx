import React from 'react'

export default function StatusBar({ words, chars, isDirty }) {
  return (
    <div className="status-bar">
      <span>{words} palabras · {chars} caracteres</span>
      <span className={`status-dot${isDirty ? ' dirty' : ''}`}>
        {isDirty ? '● Sin guardar' : '✓ Guardado'}
      </span>
    </div>
  )
}
