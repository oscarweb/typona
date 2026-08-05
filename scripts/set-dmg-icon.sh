#!/bin/bash
# Le pone el icono de build/icon.icns al archivo .dmg generado por electron-builder
# (dmg.icon de electron-builder solo afecta el icono del volumen montado, no el del archivo .dmg en sí).
set -e

ICON="build/icon.icns"

# Toma el .dmg modificado más recientemente, no el primero por orden alfabético
# (si queda algún .dmg viejo de una build anterior en dist/, "Typona-0.1.1..."
# ordena antes que "Typona-0.1.4..." alfabéticamente pero no es el que se acaba de generar).
DMG=""
newest_time=0
for f in dist/*.dmg; do
  [ -f "$f" ] || continue
  mtime=$(stat -f %m "$f")
  if [ "$mtime" -gt "$newest_time" ]; then
    newest_time=$mtime
    DMG="$f"
  fi
done

if [ ! -f "$DMG" ]; then
  echo "No se encontró ningún .dmg en dist/, se omite el seteo de ícono."
  exit 0
fi

if [ ! -f "$ICON" ]; then
  echo "No se encontró $ICON, se omite el seteo de ícono."
  exit 0
fi

TMP_ICON=$(mktemp -t typona-icon).icns
cp "$ICON" "$TMP_ICON"
sips -i "$TMP_ICON" > /dev/null

RSRC=$(mktemp -t typona-icon).rsrc
DeRez -only icns "$TMP_ICON" > "$RSRC"
Rez -append "$RSRC" -o "$DMG"
SetFile -a C "$DMG"

rm -f "$TMP_ICON" "$RSRC"
echo "Ícono aplicado a $DMG"
