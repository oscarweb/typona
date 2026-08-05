# Cómo instalar y abrir Typona (macOS)

Typona no está firmada con una cuenta de Apple Developer, así que macOS va a mostrar un aviso de seguridad la primera vez que abras cada versión nueva. **Esto es esperado**, no significa que la app tenga un problema — es el aviso estándar de Gatekeeper para cualquier app sin firma paga de Apple.

## Instalar

1. Descargá el `.dmg` desde la sección [Releases](https://github.com/oscarweb/typona/releases).
2. Abrí el `.dmg` (doble clic) — se monta un volumen con el ícono de Typona.
3. Arrastrá **Typona** a la carpeta **Aplicaciones**.
4. Podés expulsar el volumen montado y borrar el `.dmg` descargado.

## Abrir la app por primera vez

### Si el aviso dice "Apple no ha podido verificar que Typona no contenga software malicioso"

Este es el aviso normal:

1. En Finder → Aplicaciones, hacé **clic derecho (o Ctrl+clic) sobre Typona** → elegí **"Abrir"** del menú contextual (no uses doble clic esta primera vez).
2. Va a aparecer un cartel parecido, pero esta vez con un botón **"Abrir"** → hacé clic ahí.
3. Listo — de ahí en más el doble clic normal abre la app sin pedir nada más, hasta que instales otra versión.

### Si el aviso dice "Typona está dañado y no se puede abrir" o no aparece la opción "Abrir"

1. Andá a **Configuración del Sistema → Privacidad y Seguridad**.
2. Bajá hasta la sección **Seguridad** — debería aparecer un mensaje como *"Typona fue bloqueado para proteger tu Mac"* con un botón **"Abrir de todas formas"**.
3. Hacé clic ahí y confirmá con tu contraseña o Touch ID si lo pide.
4. Volvé a abrir Typona (doble clic) y confirmá en el último cartel que aparece.

## ¿Por qué pasa esto?

Firmar y notarizar una app en macOS requiere pagar la cuenta de Apple Developer (u$s99/año). Como Typona es un proyecto con pocos usuarios por ahora, se distribuye sin esa firma para evitar ese costo — este paso extra al abrir cada versión nueva es la consecuencia de esa decisión, no un problema de la app en sí.
