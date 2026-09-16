"use client";

import Link from "next/link";
import { ArrowLeft, Check, Code2, Download, Loader2, Play, Rocket, Type } from "lucide-react";
import type { KernelStatus } from "./useKernel";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  onTitleChange: (title: string) => void;
  onAddCode: () => void;
  onAddMarkdown: () => void;
  onRunAll: () => void;
  onRunAsJob: () => void;
  onExport: () => void;
  submittingJob: boolean;
  exporting: boolean;
  kernelStatus: KernelStatus;
  saveStatus: "saved" | "saving" | "unsaved";
}

const statusColor: Record<KernelStatus, string> = {
  disconnected: "bg-slate-500",
  connecting: "bg-amber-300",
  idle: "bg-emerald-400",
  busy: "bg-orange-400",
};

export function NotebookToolbar({
  title,
  onTitleChange,
  onAddCode,
  onAddMarkdown,
  onRunAll,
  onRunAsJob,
  onExport,
  submittingJob,
  exporting,
  kernelStatus,
  saveStatus,
}: Props) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[rgb(6_8_20_/_0.62)] px-5 py-3 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="Back to notebooks"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Notebook title"
          className="min-w-0 max-w-[16rem] rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-100 outline-none transition hover:border-white/10 hover:bg-white/5 focus:border-cyan-400/50 focus:bg-white/5"
        />
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
          {saveStatus === "saving" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : saveStatus === "saved" ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : null}
          <span className="hidden sm:inline">
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "unsaved"
                ? "Unsaved changes"
                : "Saved"}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button onClick={onAddCode} className="btn-ghost px-2.5 py-1.5 text-xs sm:text-sm">
          <Code2 className="h-3.5 w-3.5" />
          Code
        </button>
        <button onClick={onAddMarkdown} className="btn-ghost px-2.5 py-1.5 text-xs sm:text-sm">
          <Type className="h-3.5 w-3.5" />
          Markdown
        </button>
        <button
          onClick={onExport}
          disabled={exporting}
          title="Download as .ipynb"
          className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-50 sm:text-sm"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Export</span>
        </button>
        <button
          onClick={onRunAsJob}
          disabled={submittingJob}
          title="Run these cells as a detached job that survives closing the tab"
          className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-50 sm:text-sm"
        >
          {submittingJob ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Rocket className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Run as job</span>
        </button>
        <button onClick={onRunAll} className="btn-accent px-3 py-1.5 text-xs sm:text-sm">
          <Play className="h-3.5 w-3.5" />
          Run all
        </button>
        <div className="ml-1 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
          <span className="relative flex h-2 w-2">
            {kernelStatus === "busy" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            )}
            <span
              className={cn("relative inline-flex h-2 w-2 rounded-full", statusColor[kernelStatus])}
            />
          </span>
          <span className="text-xs capitalize text-muted">{kernelStatus}</span>
        </div>
      </div>
    </div>
  );
}
