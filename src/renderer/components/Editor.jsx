import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Editor as MilkdownCoreEditor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core'
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
import ContextMenu from './ContextMenu.jsx'
import LinkDialog from './LinkDialog.jsx'
import { joinRelative, toAssetUrl } from '../pathUtils.js'

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

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

const EditorInner = forwardRef(function EditorInner({ fileKey, baseDir, initialContent, onMarkdownChange, onLinkClick }, ref) {
  const containerRef = useRef(null)
  const markdownRef = useRef(initialContent)
  const [menu, setMenu] = useState(null)
  const [linkDialog, setLinkDialog] = useState(null)
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
      }
    }),
    []
  )

  useEditor(
    (root) => {
      markdownRef.current = initialContent
      return MilkdownCoreEditor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root)
          ctx.set(defaultValueCtx, initialContent)
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            markdownRef.current = markdown
            onMarkdownChange?.(markdown)
          })
        })
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(history)
    },
    [fileKey]
  )

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

  const handleClick = (event) => {
    if (!(event.metaKey || event.ctrlKey)) return
    const anchor = event.target.closest('a[href]')
    if (!anchor) return
    event.preventDefault()
    onLinkClick?.(anchor.getAttribute('href'))
  }

  const handleMouseOver = (event) => {
    const anchor = event.target.closest?.('a[href]')
    if (anchor && !anchor.title) {
      anchor.title = '⌘/Ctrl + clic para abrir'
    }
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
    const editor = getInstance()
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
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onContextMenu={handleContextMenu}
    >
      <Milkdown />
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
