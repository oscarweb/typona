import React from 'react'

export default function ConfirmDialog({ message, danger, confirmLabel = 'Confirmar', onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal-box">
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button
            type="button"
            className={danger ? 'danger' : ''}
            autoFocus
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
