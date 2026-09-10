"use client";

import Link from "next/link";
import { ArrowLeft, Check, Code2, Loader2, Play, Type } from "lucide-react";
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
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-900">
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="rounded-md border-none bg-transparent px-1 text-sm font-medium outline-none transition hover:bg-neutral-100 focus:bg-neutral-100"
        />
        <span className="flex items-center gap-1 text-xs text-neutral-400">
          {saveStatus === "saving" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : saveStatus === "saved" ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : null}
          {saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved changes" : "Saved"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onAddCode}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Code2 className="h-3.5 w-3.5" />
          Code
        </button>
        <button
          onClick={onAddMarkdown}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Type className="h-3.5 w-3.5" />
          Markdown
        </button>
        <button
          onClick={onRunAll}
          className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-2.5 py-1.5 text-sm text-white transition hover:bg-cyan-700"
        >
          <Play className="h-3.5 w-3.5" />
          Run All
        </button>
        <div className="ml-2 flex items-center gap-2 rounded-full bg-neutral-100 px-2.5 py-1">
          <span className="relative flex h-2 w-2">
            {kernelStatus === "busy" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColor[kernelStatus]}`} />
          </span>
          <span className="text-xs text-neutral-500">{kernelStatus}</span>
        </div>
      </div>
    </div>
  );
}
