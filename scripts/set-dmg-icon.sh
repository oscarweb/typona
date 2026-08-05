#!/bin/bash
# Le pone el icono de build/icon.icns al archivo .dmg generado por electron-builder
# (dmg.icon de electron-builder solo afecta el icono del volumen montado, no el del archivo .dmg en sí).
set -e

ICON="build/icon.icns"
DMGS=(dist/*.dmg)
DMG="${DMGS[0]}"

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
