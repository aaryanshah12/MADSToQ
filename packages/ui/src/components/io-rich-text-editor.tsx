"use client";

import { useEffect, useRef } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  Underline,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ToolButton = { type: "btn"; cmd: string; icon: LucideIcon; title: string };
type ToolSep = { type: "sep" };
type Tool = ToolButton | ToolSep;

const TOOLS: Tool[] = [
  { type: "btn", cmd: "bold", icon: Bold, title: "Bold" },
  { type: "btn", cmd: "italic", icon: Italic, title: "Italic" },
  { type: "btn", cmd: "underline", icon: Underline, title: "Underline" },
  { type: "sep" },
  { type: "btn", cmd: "insertUnorderedList", icon: List, title: "Bullet list" },
  { type: "sep" },
  { type: "btn", cmd: "justifyLeft", icon: AlignLeft, title: "Align left" },
  { type: "btn", cmd: "justifyCenter", icon: AlignCenter, title: "Align center" },
  { type: "btn", cmd: "justifyRight", icon: AlignRight, title: "Align right" },
];

function textToHtml(text: string): string {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("* ")) return `<li>${line.slice(2)}</li>`;
      return `<p>${line || "<br>"}</p>`;
    })
    .join("")
    .replace(/(<li>.*<\/li>)+/g, (match) => `<ul>${match}</ul>`);
}

function htmlToText(html: string): string {
  return html;
}

export type IoRichTextEditorProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: number;
};

/** Lightweight rich text (execCommand) for IO quotations. */
export default function IoRichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 100,
}: IoRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = textToHtml(value);
    if (el.innerHTML !== html) {
      isInternalChange.current = true;
      el.innerHTML = html;
      isInternalChange.current = false;
    }
  }, [value]);

  function handleInput() {
    if (!editorRef.current || isInternalChange.current) return;
    onChange(htmlToText(editorRef.current.innerHTML));
  }

  function exec(cmd: string) {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
    handleInput();
  }

  function isActive(cmd: string) {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-border"
      style={{ background: "var(--color-surface)" }}
    >
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5"
        style={{ background: "var(--color-panel)" }}
      >
        {TOOLS.map((tool, i) => {
          if (tool.type === "sep") {
            return (
              <div
                key={`sep-${i}`}
                className="mx-1 h-4 w-px"
                style={{ background: "var(--color-border)" }}
              />
            );
          }
          const Icon = tool.icon;
          const active = isActive(tool.cmd);
          return (
            <button
              key={tool.cmd}
              type="button"
              title={tool.title}
              onMouseDown={(e) => {
                e.preventDefault();
                exec(tool.cmd);
              }}
              className={`rounded p-1.5 transition-all ${
                active
                  ? "bg-inputer/20 text-inputer"
                  : "text-muted hover:bg-layer hover:text-primary"
              }`}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight, outline: "none", padding: "10px 14px" }}
        className="text-sm leading-relaxed text-primary focus:ring-0 empty:before:text-muted empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
