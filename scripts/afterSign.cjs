// electron-builder no encuentra un certificado de Apple Developer (no lo pagamos),
// así que sin esto el .app queda sin firmar. En Apple Silicon, un binario descargado
// de internet (con el atributo de cuarentena) y sin firma NI SIQUIERA ad-hoc hace que
// macOS lo marque directamente como "dañado" en vez de mostrar el aviso normal de
// Gatekeeper. Firmarlo ad-hoc (identidad "-") alcanza para que muestre el aviso
// bypasseable de siempre ("clic derecho -> Abrir").
const { execFileSync } = require('node:child_process')

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
