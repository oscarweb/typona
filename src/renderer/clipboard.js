// Copia texto plano exacto (por ejemplo, el contenido de un bloque de código).
// Se usa el evento copy: el listener en captura sobre window corre antes que el de
// ProseMirror, define el contenido y corta la propagación.
export function copyPlainText(text) {
  const onCopy = (event) => {
    event.clipboardData.setData('text/plain', text)
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  window.addEventListener('copy', onCopy, { capture: true, once: true })
  try {
    if (document.execCommand('copy')) return
  } finally {
    window.removeEventListener('copy', onCopy, { capture: true })
  }
  navigator.clipboard?.writeText(text).catch(() => {})
}
