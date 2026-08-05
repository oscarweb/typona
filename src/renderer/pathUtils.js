// Resuelve un path relativo (puede incluir "../") contra una carpeta base absoluta (POSIX).
export function joinRelative(baseDir, relativePath) {
  if (relativePath.startsWith('/')) return relativePath
  const stack = []
  for (const part of `${baseDir}/${relativePath}`.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return `/${stack.join('/')}`
}

// Convierte un path absoluto a una URL typona-asset:// (protocolo custom registrado
// en el proceso main que sirve archivos locales, ver src/main/index.js).
export function toAssetUrl(absolutePath) {
  const encoded = absolutePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  // host fijo ("local") para que el parser de URL no confunda el primer
  // segmento del path absoluto (p. ej. "Applications") con el host.
  return `typona-asset://local/${encoded}`
}
