"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import { ArrowDown, ArrowUp, ChevronRight, Loader2, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import type { OutputMessage } from "@/lib/kernelClient";
import type { NotebookCell } from "@/lib/types";
import { OutputRenderer } from "./OutputRenderer";

interface Props {
  cell: NotebookCell;
  onChange: (source: string) => void;
  onRun: () => Promise<void>;
  onRunAndAdvance?: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function CodeCell({ cell, onChange, onRun, onRunAndAdvance, onDelete, onMoveUp, onMoveDown }: Props) {
  const [running, setRunning] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      await onRun();
    } finally {
      setRunning(false);
    }
  }

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRun();
    });
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      handleRun().then(() => onRunAndAdvance?.());
    });
  };

  const outputs = (cell.outputs as unknown as OutputMessage[]) || [];

  return (
    <div className={`group rounded-2xl border p-3.5 transition-colors ${running ? "border-cyan-400/50 bg-cyan-400/[0.04]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
          {running ? <Loader2 className="h-3 w-3 animate-spin text-cyan-300" /> : `[${cell.execution_count ?? " "}]`}
        </span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
          {outputs.length > 0 && (
            <button onClick={() => setCollapsed((c) => !c)} className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100" title="Toggle output">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-90"}`} />
            </button>
          )}
          <button onClick={handleRun} disabled={running} className="flex items-center gap-1 rounded p-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-cyan-200 disabled:opacity-50" title="Run (Ctrl+Enter)">
            <Play className="h-3 w-3" />
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
      <Editor
        height={Math.max(60, cell.source.split("\n").length * 20 + 20)}
        language="python"
        theme="vs-dark"
        value={cell.source}
        onChange={(value) => onChange(value ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          lineNumbers: "off",
          folding: false,
        }}
      />
      {!collapsed && <OutputRenderer outputs={outputs} />}
      {collapsed && outputs.length > 0 && (
        <p className="mt-2 text-xs text-muted">Output collapsed ({outputs.length} item{outputs.length > 1 ? "s" : ""})</p>
      )}
    </div>
  );
}
