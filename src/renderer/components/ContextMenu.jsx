import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null)
  const [position, setPosition] = useState({ left: x, top: y, visibility: 'hidden' })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const { offsetWidth, offsetHeight } = el
    const margin = 8
    const left = Math.min(x, window.innerWidth - offsetWidth - margin)
    const top = Math.min(y, window.innerHeight - offsetHeight - margin)
    setPosition({ left: Math.max(margin, left), top: Math.max(margin, top), visibility: 'visible' })
  }, [x, y])

  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose()
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div className="context-menu" style={position} ref={menuRef}>
      {items.map((item, index) =>
        item.separator ? (
          <div className="context-menu-separator" key={`sep-${index}`} />
        ) : (
          <button
            key={item.label}
            className={`context-menu-item${item.danger ? ' danger' : ''}`}
            onClick={() => {
              onClose()
              item.onClick()
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
