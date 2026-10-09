import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Editor as MilkdownCoreEditor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core'
import {
  commonmark,
  wrapInHeadingCommand,
  turnIntoTextCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  createCodeBlockCommand,
  insertHrCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand
} from '@milkdown/preset-commonmark'
import { gfm, insertTableCommand, toggleStrikethroughCommand } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { history } from '@milkdown/plugin-history'
import { Milkdown, useEditor, useInstance, MilkdownProvider } from '@milkdown/react'
import { TextSelection } from '@milkdown/prose/state'
import { replaceAll } from '@milkdown/utils'
import ContextMenu from './ContextMenu.jsx'
import { CopyIcon, CheckIcon } from './Icons.jsx'
import { copyPlainText } from '../clipboard.js'
import LinkDialog from './LinkDialog.jsx'
import { joinRelative, toAssetUrl } from '../pathUtils.js'

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const TRIPLE_CLICK_WAIT_MS = 300

function resolveImageSrc(baseDir, rawSrc) {
  if (!rawSrc || HAS_SCHEME.test(rawSrc)) return rawSrc
  if (!baseDir) return rawSrc
  return toAssetUrl(joinRelative(baseDir, rawSrc))
}

function runCommand(command, payload) {
  command.run(payload)
}

function insertLinkWithText(editor, text, href) {
  if (!editor || !text) return
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { from } = view.state.selection
    const linkMark = view.state.schema.marks.link.create({ href })
    const tr = view.state.tr.insertText(text, from).addMark(from, from + text.length, linkMark)
    view.dispatch(tr)
    view.focus()
  })
}

function getBlockMenuItems(openLinkDialog) {
  return [
    { label: 'Título 1', onClick: () => runCommand(wrapInHeadingCommand, 1) },
    { label: 'Título 2', onClick: () => runCommand(wrapInHeadingCommand, 2) },
    { label: 'Título 3', onClick: () => runCommand(wrapInHeadingCommand, 3) },
    { label: 'Párrafo (texto normal)', onClick: () => runCommand(turnIntoTextCommand) },
    { separator: true },
    { label: 'Lista con viñetas', onClick: () => runCommand(wrapInBulletListCommand) },
    { label: 'Lista numerada', onClick: () => runCommand(wrapInOrderedListCommand) },
    { label: 'Cita', onClick: () => runCommand(wrapInBlockquoteCommand) },
    { label: 'Bloque de código', onClick: () => runCommand(createCodeBlockCommand) },
    { separator: true },
    { label: 'Línea horizontal', onClick: () => runCommand(insertHrCommand) },
    { label: 'Tabla', onClick: () => runCommand(insertTableCommand, { row: 3, col: 3 }) },
    { label: 'Enlace…', onClick: () => openLinkDialog({ withText: true }) }
  ]
}

// Selección del DOM (lo que el usuario marcó o clickeó en modo lectura) traducida a una
// selección de ProseMirror, para conservarla al pasar a modo edición.
function selectionFromDom(view) {
  const domSelection = window.getSelection()
  if (!domSelection || domSelection.rangeCount === 0) return null
  if (!view.dom.contains(domSelection.anchorNode) || !view.dom.contains(domSelection.focusNode)) return null
  try {
    const anchor = view.posAtDOM(domSelection.anchorNode, domSelection.anchorOffset)
    const head = view.posAtDOM(domSelection.focusNode, domSelection.focusOffset)
    const { doc } = view.state
    return TextSelection.between(doc.resolve(anchor), doc.resolve(head))
  } catch {
    return null
  }
}

function selectAllContent(view) {
  const range = document.createRange()
  range.selectNodeContents(view.dom)
  const domSelection = window.getSelection()
  domSelection.removeAllRanges()
  domSelection.addRange(range)
}

function getSelectionMenuItems(openLinkDialog) {
  return [
    { label: 'Negrita', onClick: () => runCommand(toggleStrongCommand) },
    { label: 'Cursiva', onClick: () => runCommand(toggleEmphasisCommand) },
    { label: 'Tachado', onClick: () => runCommand(toggleStrikethroughCommand) },
    { label: 'Código en línea', onClick: () => runCommand(toggleInlineCodeCommand) },
    { separator: true },
    { label: 'Enlace…', onClick: () => openLinkDialog({ withText: false }) }
  ]
}

const EditorInner = forwardRef(function EditorInner(
  {
    fileKey,
    baseDir,
    initialContent,
    editable,
    autoFocus,
    onAutoFocused,
    onRequestEdit,
    onRequestRead,
    onMarkdownChange,
    onLinkClick
  },
  ref
) {
  const containerRef = useRef(null)
  const markdownRef = useRef(initialContent)
  // Se leen al montar el editor (que es asíncrono), así que van en refs y no en el closure.
  const autoFocusRef = useRef(autoFocus)
  autoFocusRef.current = autoFocus
  const onAutoFocusedRef = useRef(onAutoFocused)
  onAutoFocusedRef.current = onAutoFocused
  // ProseMirror consulta editable() cada vez que se actualiza la vista.
  const editableRef = useRef(editable)
  editableRef.current = editable
  // Posición donde poner el cursor al pasar a edición (doble click / menú contextual).
  const pendingEditPosRef = useRef(null)
  // Dónde se apretó el mouse: si se soltó lejos, fue un arrastre (selección), no un click.
  const mouseDownPointRef = useRef(null)
  // El doble click espera un instante antes de pasar a edición: si llega un tercer click es un
  // triple click (seleccionar el párrafo) y se cancela.
  const pendingEditTimerRef = useRef(null)
  const [menu, setMenu] = useState(null)
  const [linkDialog, setLinkDialog] = useState(null)
  // Botón flotante "Copiar" sobre una selección hecha con el mouse (solo modo lectura).
  const [selectionCopy, setSelectionCopy] = useState(null)
  // Botón de copiar del bloque de código que está bajo el mouse (los dos modos).
  const [codeCopy, setCodeCopy] = useState(null)
  const [, getInstance] = useInstance()

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () => markdownRef.current,
      scrollToHeadingIndex: (index) => {
        const el = containerRef.current
        if (!el) return
        const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6')
        headings[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      },
      scrollToAnchor: (anchorId) => {
        const el = containerRef.current
        if (!el || !anchorId) return
        el.querySelector(`#${CSS.escape(anchorId)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      },
      // Reemplaza el documento sin recrear el editor. Con flush se crea un estado nuevo:
      // no pasa por el listener (no marca cambios sin guardar) y el historial de deshacer
      // arranca de cero, como si el archivo se hubiera abierto de nuevo.
      replaceContent: (markdown) => {
        const editor = getInstance()
        if (!editor) return
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          const { from } = view.state.selection
          replaceAll(markdown, true)(ctx)
          const { state } = view
          const pos = Math.min(from, state.doc.content.size)
          view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos))))
        })
        markdownRef.current = markdown
      }
    }),
    [getInstance]
  )

  useEditor(
    (root) => {
      markdownRef.current = initialContent
      return MilkdownCoreEditor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root)
          ctx.set(defaultValueCtx, initialContent)
          ctx.update(editorViewOptionsCtx, (prev) => ({ ...prev, editable: () => editableRef.current }))
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            markdownRef.current = markdown
            onMarkdownChange?.(markdown)
          })
          // Archivo recién creado: cursor al final (después del título) listo para escribir.
          // onAutoFocused pasa la app a modo edición, y el efecto de `editable` enfoca.
          ctx.get(listenerCtx).mounted((mountedCtx) => {
            if (!autoFocusRef.current) return
            const view = mountedCtx.get(editorViewCtx)
            pendingEditPosRef.current = view.state.doc.content.size
            onAutoFocusedRef.current?.()
          })
        })
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(history)
    },
    [fileKey]
  )

  // Cambio de modo: la vista vuelve a leer editable() (contenteditable). Al entrar en edición
  // el cursor va a la posición pedida o a lo que el usuario había seleccionado en lectura.
  useEffect(() => {
    const editor = getInstance()
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.setProps({})
      if (!editable) {
        view.dom.blur()
        return
      }
      const pendingPos = pendingEditPosRef.current
      pendingEditPosRef.current = null
      const { doc } = view.state
      const selection =
        pendingPos != null
          ? TextSelection.near(doc.resolve(Math.min(pendingPos, doc.content.size)))
          : selectionFromDom(view)
      if (selection) view.dispatch(view.state.tr.setSelection(selection))
      view.focus()
    })
  }, [editable, getInstance])

  useEffect(() => {
    if (editable) setSelectionCopy(null)
  }, [editable])

  // Al cambiar de archivo no quedan botones flotando sobre el documento nuevo.
  useEffect(() => {
    setSelectionCopy(null)
    setCodeCopy(null)
  }, [fileKey])

  // El botón "Copiar" se va si se scrollea, si la selección desaparece o con Escape (en lectura el
  // documento no tiene el foco, así que Escape se escucha en window).
  const hasSelectionCopy = selectionCopy !== null
  useEffect(() => {
    if (!hasSelectionCopy) return
    const hide = () => setSelectionCopy(null)
    const onSelectionChange = () => {
      if (window.getSelection()?.isCollapsed) hide()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') hide()
    }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [hasSelectionCopy])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const fixImages = () => {
      container.querySelectorAll('img[src]').forEach((img) => {
        if (img.dataset.typonaResolved) return
        const resolved = resolveImageSrc(baseDir, img.getAttribute('src'))
        if (resolved && resolved !== img.getAttribute('src')) img.setAttribute('src', resolved)
        img.dataset.typonaResolved = '1'
      })
    }

    fixImages()
    const observer = new MutationObserver(fixImages)
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [fileKey, baseDir])

  // Links: en lectura alcanza un click (salvo que se esté terminando de seleccionar texto);
  // en edición hace falta Cmd/Ctrl, porque el click simple posiciona el cursor.
  const handleClick = (event) => {
    const anchor = event.target.closest('a[href]')
    if (!anchor) return
    // Siempre: el navegador nunca debe seguir el link por su cuenta. En modo lectura el texto
    // no es editable y un <a> vuelve a ser un link real (abriría el .md crudo en la ventana).
    event.preventDefault()
    const withModifier = event.metaKey || event.ctrlKey
    if (editable && !withModifier) return
    // terminar una selección arrastrando sobre un link no lo abre
    const start = mouseDownPointRef.current
    const wasDrag = start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4
    if (!editable && !withModifier && wasDrag) return
    onLinkClick?.(anchor.getAttribute('href'))
  }

  const handleMouseDown = (event) => {
    if (event.detail >= 3) clearTimeout(pendingEditTimerRef.current)
    mouseDownPointRef.current = { x: event.clientX, y: event.clientY }
    setSelectionCopy(null)
  }

  // Al soltar el mouse en lectura, si quedó texto seleccionado, aparece "Copiar" arriba de la
  // selección (o abajo si no hay lugar). Con ⌘A no aparece: no es una selección con el mouse.
  const handleMouseUp = (event) => {
    // solo selecciones con el botón izquierdo, y no al soltar sobre el propio botón "Copiar"
    if (editable || event.button !== 0 || event.target.closest('.selection-copy')) return
    // solo si esta interacción seleccionó texto: arrastrar o triple click. Un click simple (por
    // ejemplo en un link) con una selección vieja todavía marcada no muestra el botón.
    const start = mouseDownPointRef.current
    const dragged = start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4
    if (!dragged && event.detail < 3) return
    setTimeout(() => {
      const domSelection = window.getSelection()
      const docDom = containerRef.current?.querySelector('.ProseMirror')
      if (!domSelection || domSelection.isCollapsed || !docDom?.contains(domSelection.anchorNode)) return
      const rect = domSelection.getRangeAt(0).getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      const below = rect.top < 48
      setSelectionCopy({ x: rect.left + rect.width / 2, y: below ? rect.bottom + 8 : rect.top - 8, below, copied: false })
    }, 0)
  }

  const copySelection = () => {
    // ProseMirror arma el contenido (HTML del documento sin estilos del tema + texto plano)
    document.execCommand('copy')
    setSelectionCopy((current) => current && { ...current, copied: true })
    setTimeout(() => setSelectionCopy(null), 1000)
  }

  // Botón de copiar sobre el bloque de código bajo el mouse; posición relativa al contenedor.
  const trackCodeBlock = (event) => {
    if (event.target.closest?.('.code-copy')) return
    const pre = event.target.closest?.('pre')
    const container = containerRef.current
    if (!pre || !container?.contains(pre)) {
      if (codeCopy) setCodeCopy(null)
      return
    }
    if (codeCopy?.pre === pre) return
    const preRect = pre.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    setCodeCopy({
      pre,
      top: preRect.top - containerRect.top + 6,
      right: containerRect.right - preRect.right + 6,
      copied: false
    })
  }

  const copyCodeBlock = () => {
    if (!codeCopy) return
    const { pre } = codeCopy
    copyPlainText(pre.querySelector('code')?.textContent ?? pre.textContent)
    setCodeCopy((current) => current && { ...current, copied: true })
    setTimeout(() => setCodeCopy((current) => current && current.pre === pre && { ...current, copied: false }), 1500)
  }

  // Click con la rueda del mouse: por defecto abriría el link en una ventana nueva.
  const handleAuxClick = (event) => {
    if (event.target.closest('a[href]')) event.preventDefault()
  }

  // Tooltip con el atajo según el modo. Si el link ya tiene un title propio (del markdown),
  // se respeta; data-typona-hint marca los que puso la app.
  const handleMouseOver = (event) => {
    trackCodeBlock(event)
    const anchor = event.target.closest?.('a[href]')
    if (!anchor || (anchor.title && !anchor.dataset.typonaHint)) return
    anchor.title = editable ? '⌘/Ctrl + clic para abrir' : 'Clic para abrir'
    anchor.dataset.typonaHint = '1'
  }

  const handleDoubleClick = (event) => {
    if (editable) return
    let pos = null
    getInstance()?.action((ctx) => {
      pos = ctx.get(editorViewCtx).posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null
    })
    clearTimeout(pendingEditTimerRef.current)
    pendingEditTimerRef.current = setTimeout(() => {
      pendingEditPosRef.current = pos
      onRequestEdit?.()
    }, TRIPLE_CLICK_WAIT_MS)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && editable && !menu && !linkDialog) onRequestRead?.()
  }

  const openLinkDialog = ({ withText }) => setLinkDialog({ withText })

  const confirmLinkDialog = ({ text, href }) => {
    const editor = getInstance()
    if (linkDialog?.withText) {
      insertLinkWithText(editor, text, href)
    } else {
      runCommand(toggleLinkCommand, { href })
    }
    setLinkDialog(null)
  }

  const handleContextMenu = (event) => {
    event.preventDefault()
    setSelectionCopy(null)
    const editor = getInstance()

    if (!editable) {
      let view = null
      let clickPos = null
      editor?.action((ctx) => {
        view = ctx.get(editorViewCtx)
        clickPos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null
      })
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          { label: 'Copiar', onClick: () => document.execCommand('copy') },
          { label: 'Seleccionar todo', onClick: () => view && selectAllContent(view) },
          { separator: true },
          {
            label: 'Pasar a modo edición',
            onClick: () => {
              pendingEditPosRef.current = clickPos
              onRequestEdit?.()
            }
          }
        ]
      })
      return
    }

    let showSelectionMenu = false
    if (editor) {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { from, to } = view.state.selection
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        const clickPos = coords?.pos
        const withinSelection = clickPos != null && from !== to && clickPos >= from && clickPos <= to
        if (withinSelection) {
          showSelectionMenu = true
        } else if (clickPos != null) {
          const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(clickPos)))
          view.dispatch(tr)
        }
        view.focus()
      })
    }
    const items = showSelectionMenu ? getSelectionMenuItems(openLinkDialog) : getBlockMenuItems(openLinkDialog)
    setMenu({ x: event.clientX, y: event.clientY, items })
  }

  return (
    <div
      className="editor-content"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setCodeCopy(null)}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseOver={handleMouseOver}
      onContextMenu={handleContextMenu}
    >
      <Milkdown />
      {selectionCopy && (
        <button
          type="button"
          className={`selection-copy${selectionCopy.below ? ' below' : ''}${selectionCopy.copied ? ' copied' : ''}`}
          style={{ left: selectionCopy.x, top: selectionCopy.y }}
          onMouseDown={(event) => {
            // no perder la selección ni disparar el mousedown del contenedor
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={copySelection}
        >
          {selectionCopy.copied ? <CheckIcon /> : <CopyIcon />}
          {selectionCopy.copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
      {codeCopy && (
        <button
          type="button"
          className={`code-copy${codeCopy.copied ? ' copied' : ''}`}
          style={{ top: codeCopy.top, right: codeCopy.right }}
          title="Copiar código"
          onMouseDown={(event) => {
            // en edición, no mover el cursor dentro del bloque
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={copyCodeBlock}
        >
          {codeCopy.copied ? <CheckIcon /> : <CopyIcon />}
          {codeCopy.copied && 'Copiado'}
        </button>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {linkDialog && (
        <LinkDialog
          withText={linkDialog.withText}
          onConfirm={confirmLinkDialog}
          onCancel={() => setLinkDialog(null)}
        />
      )}
    </div>
  )
})

const MilkdownEditor = forwardRef(function MilkdownEditor(props, ref) {
  return (
    <MilkdownProvider>
      <EditorInner ref={ref} {...props} />
    </MilkdownProvider>
  )
})

export default MilkdownEditor
