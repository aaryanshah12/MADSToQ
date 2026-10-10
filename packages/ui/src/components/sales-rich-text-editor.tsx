"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Redo2,
  Table as TableIcon,
  Undo2,
} from "lucide-react";

export type SalesRichTextEditorProps = {
  value: string;
  json?: unknown;
  onChange: (html: string, json: unknown) => void;
  placeholder?: string;
  className?: string;
};

const RTE_CSS = `
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
`;

/** TipTap-based editor for sales documents (quotations, POs, invoices). */
export default function SalesRichTextEditor({
  value,
  json,
  onChange,
  placeholder,
  className,
}: SalesRichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "rte-link" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "rte-table" } }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder:
          placeholder ?? "Write the body of your document. Add a table or just text…",
      }),
    ],
    content: (json as object) ?? value ?? "",
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML(), ed.getJSON());
    },
    editorProps: {
      attributes: {
        class: "rte-content focus:outline-none min-h-[280px]",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent((json as object) ?? value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync external document only
  }, [json, value]);

  if (!editor) return <div className="h-64 animate-pulse rounded bg-layer-sm" />;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border ${className ?? ""}`}
      style={{ background: "var(--color-panel)" }}
    >
      <Toolbar editor={editor} />
      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
      <style dangerouslySetInnerHTML={{ __html: RTE_CSS }} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded p-1.5 text-muted transition-colors hover:bg-layer-sm hover:text-primary ${active ? "bg-owner/15 text-owner" : ""}`}
    >
      {children}
    </button>
  );

  const insertLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-2"
      style={{ background: "var(--color-surface)" }}
    >
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <Bold size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <Italic size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="H1"
      >
        <Heading1 size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="H2"
      >
        <Heading2 size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="H3"
      >
        <Heading3 size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet"
      >
        <List size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered"
      >
        <ListOrdered size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Left"
      >
        <AlignLeft size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Center"
      >
        <AlignCenter size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Right"
      >
        <AlignRight size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        title="Insert Table"
      >
        <TableIcon size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        disabled={!editor.can().addColumnAfter()}
        title="Add Column"
      >
        <Plus size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().deleteColumn().run()}
        disabled={!editor.can().deleteColumn()}
        title="Delete Column"
      >
        <Minus size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn onClick={insertLink} active={editor.isActive("link")} title="Link">
        <Link2 size={14} />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2 size={14} />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2 size={14} />
      </Btn>
    </div>
  );
}
