"use client";

import Link from "next/link";
import type { KernelStatus } from "./useKernel";

interface Props {
  title: string;
  onTitleChange: (title: string) => void;
  onAddCode: () => void;
  onAddMarkdown: () => void;
  onRunAll: () => void;
  kernelStatus: KernelStatus;
  saveStatus: "saved" | "saving" | "unsaved";
}

const statusColor: Record<KernelStatus, string> = {
  disconnected: "bg-neutral-300",
  connecting: "bg-yellow-400",
  idle: "bg-green-500",
  busy: "bg-orange-500",
};

export function NotebookToolbar({
  title,
  onTitleChange,
  onAddCode,
  onAddMarkdown,
  onRunAll,
  kernelStatus,
  saveStatus,
}: Props) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Notebooks
        </Link>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="border-none bg-transparent text-sm font-medium outline-none"
        />
        <span className="text-xs text-neutral-400">
          {saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved changes" : "Saved"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onAddCode} className="text-sm text-neutral-600 hover:text-neutral-900">
          + Code
        </button>
        <button onClick={onAddMarkdown} className="text-sm text-neutral-600 hover:text-neutral-900">
          + Markdown
        </button>
        <button onClick={onRunAll} className="text-sm text-neutral-600 hover:text-neutral-900">
          Run All
        </button>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusColor[kernelStatus]}`} />
          <span className="text-xs text-neutral-500">{kernelStatus}</span>
        </div>
      </div>
    </div>
  );
}
