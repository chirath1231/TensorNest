"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  source: string;
  onChange: (source: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function MarkdownCell({ source, onChange, onDelete, onMoveUp, onMoveDown }: Props) {
  const [editing, setEditing] = useState(source.length === 0);

  return (
    <div className="group rounded-lg border border-neutral-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-neutral-400">Markdown</span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={() => setEditing((e) => !e)} className="text-xs text-neutral-600 hover:text-neutral-900">
            {editing ? "Preview" : "Edit"}
          </button>
          <button onClick={onMoveUp} className="text-xs text-neutral-600 hover:text-neutral-900">
            Up
          </button>
          <button onClick={onMoveDown} className="text-xs text-neutral-600 hover:text-neutral-900">
            Down
          </button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">
            Delete
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          value={source}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          className="w-full resize-y rounded-md border border-neutral-200 p-2 font-mono text-sm outline-none"
          rows={Math.max(3, source.split("\n").length)}
          autoFocus
        />
      ) : (
        <div onClick={() => setEditing(true)} className="prose prose-sm max-w-none cursor-text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{source || "*Empty markdown cell*"}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
