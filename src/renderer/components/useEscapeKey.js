import { useEffect } from 'react'

// Cierra un modal con Escape (mismo comportamiento que el click fuera del modal).
export default function useEscapeKey(onEscape) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onEscape])
}
