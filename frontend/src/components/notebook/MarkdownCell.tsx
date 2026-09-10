"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { KeyboardEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  source: string;
  onChange: (source: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAdvance?: () => void;
}

export function MarkdownCell({ source, onChange, onDelete, onMoveUp, onMoveDown, onAdvance }: Props) {
  const [editing, setEditing] = useState(source.length === 0);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      setEditing(false);
      onAdvance?.();
    }
  }

  return (
    <div className="group rounded-lg border border-[#f2bc33] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-[#e6c163]">Markdown</span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={() => setEditing((e) => !e)} className="text-[#e6c163] hover:text-[#e6c163] dark:hover:text-[#e6c163]" title={editing ? "Preview" : "Edit"}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveUp} className="text-[#e6c163] hover:text-[#e6c163] dark:hover:text-[#e6c163]" title="Move up">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} className="text-[#e6c163] hover:text-[#e6c163] dark:hover:text-[#e6c163]" title="Move down">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="text-red-400 hover:text-red-600" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          value={source}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={handleKeyDown}
          className="w-full resize-y rounded-md border border-[#f2bc33] p-2 font-mono text-sm outline-none transition focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100"
          rows={Math.max(3, source.split("\n").length)}
          autoFocus
        />
      ) : (
        <div onClick={() => setEditing(true)} className="prose prose-sm max-w-none cursor-text dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{source || "*Empty markdown cell*"}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
