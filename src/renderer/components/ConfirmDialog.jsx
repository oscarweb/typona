import React from 'react'
import useEscapeKey from './useEscapeKey.js'

export default function ConfirmDialog({
  message,
  details = [],
  danger,
  confirmLabel = 'Confirmar',
  cancelIsDefault = false,
  onConfirm,
  onCancel
}) {
  useEscapeKey(onCancel)

  const confirmClass = danger ? 'danger' : cancelIsDefault ? '' : 'primary'

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal-box">
        <p className="modal-message">{message}</p>
        {details.map((detail) => (
          <p className="modal-detail" key={detail}>{detail}</p>
        ))}
        <div className="modal-actions">
          <button type="button" className={cancelIsDefault ? 'primary' : ''} autoFocus={cancelIsDefault} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={confirmClass} autoFocus={!cancelIsDefault} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
