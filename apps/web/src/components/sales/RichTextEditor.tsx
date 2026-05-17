'use client'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'
import {
  Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3,
  Table as TableIcon, AlignLeft, AlignCenter, AlignRight, Link2,
  Plus, Minus, Undo2, Redo2,
} from 'lucide-react'

interface Props {
  value: string                    // HTML
  json?: any
  onChange: (html: string, json: any) => void
  placeholder?: string
  className?: string
}

export default function RichTextEditor({ value, json, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'rte-link' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'rte-table' } }),
      TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder: placeholder ?? 'Write the body of your document. Add a table or just text…' }),
    ],
    content: json ?? value ?? '',
    onUpdate({ editor }) {
      onChange(editor.getHTML(), editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'rte-content focus:outline-none min-h-[280px]',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value && value !== current) {
      editor.commands.setContent(json ?? value)
    }
  }, [json, value])

  if (!editor) return <div className="h-64 bg-layer-sm rounded animate-pulse"/>

  return (
    <div className={`border border-border rounded-xl overflow-hidden ${className ?? ''}`} style={{ background: 'var(--color-panel)' }}>
      <Toolbar editor={editor}/>
      <div className="px-4 py-3">
        <EditorContent editor={editor}/>
      </div>
      <RteStyles/>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({ onClick, active, disabled, children, title }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded text-muted hover:text-primary hover:bg-layer-sm transition-colors ${active ? 'bg-owner/15 text-owner' : ''}`}
    >
      {children}
    </button>
  )

  const insertLink = () => {
    const previous = editor.getAttributes('link').href
    const url = window.prompt('URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-2 border-b border-border" style={{ background: 'var(--color-surface)' }}>
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={14}/></Btn>
      <span className="w-px h-4 bg-border mx-1"/>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1"><Heading1 size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2"><Heading2 size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3"><Heading3 size={14}/></Btn>
      <span className="w-px h-4 bg-border mx-1"/>
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet"><List size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered"><ListOrdered size={14}/></Btn>
      <span className="w-px h-4 bg-border mx-1"/>
      <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()}   active={editor.isActive({ textAlign: 'left' })}   title="Left"><AlignLeft size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Center"><AlignCenter size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()}  active={editor.isActive({ textAlign: 'right' })}  title="Right"><AlignRight size={14}/></Btn>
      <span className="w-px h-4 bg-border mx-1"/>
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table"><TableIcon size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().addColumnAfter()} title="Add Column"><Plus size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().deleteColumn().run()}   disabled={!editor.can().deleteColumn()}   title="Delete Column"><Minus size={14}/></Btn>
      <span className="w-px h-4 bg-border mx-1"/>
      <Btn onClick={insertLink} active={editor.isActive('link')} title="Link"><Link2 size={14}/></Btn>
      <span className="w-px h-4 bg-border mx-1"/>
      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo2 size={14}/></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo2 size={14}/></Btn>
    </div>
  )
}

function RteStyles() {
  return (
    <style jsx global>{`
      .rte-content p { margin: 0 0 0.5rem; }
      .rte-content h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; }
      .rte-content h2 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0; }
      .rte-content h3 { font-size: 1.05rem; font-weight: 700; margin: 0.5rem 0; }
      .rte-content ul, .rte-content ol { padding-left: 1.4rem; margin: 0.4rem 0; }
      .rte-content a, .rte-link { color: var(--color-inputer); text-decoration: underline; }
      .rte-content table, .rte-table { border-collapse: collapse; margin: 0.6rem 0; width: 100%; table-layout: fixed; }
      .rte-content th, .rte-content td { border: 1px solid var(--color-border); padding: 6px 8px; vertical-align: top; }
      .rte-content th { background: var(--color-surface); font-weight: 600; }
      .rte-content .is-empty:first-child::before {
        content: attr(data-placeholder);
        color: var(--color-muted);
        float: left;
        height: 0;
        pointer-events: none;
      }
    `}</style>
  )
}
