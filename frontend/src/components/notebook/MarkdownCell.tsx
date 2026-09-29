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
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition-colors hover:border-white/20">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">Markdown</span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={() => setEditing((e) => !e)} className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100" title={editing ? "Preview" : "Edit"}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveUp} className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100" title="Move up">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100" title="Move down">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="rounded p-1 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300" title="Delete">
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
          className="glass-input resize-y font-mono text-sm"
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
