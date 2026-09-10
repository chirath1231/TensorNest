"use client";

import Editor from "@monaco-editor/react";
import { useState } from "react";
import type { OutputMessage } from "@/lib/kernelClient";
import type { NotebookCell } from "@/lib/types";
import { OutputRenderer } from "./OutputRenderer";

interface Props {
  cell: NotebookCell;
  onChange: (source: string) => void;
  onRun: () => Promise<void>;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function CodeCell({ cell, onChange, onRun, onDelete, onMoveUp, onMoveDown }: Props) {
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      await onRun();
    } finally {
      setRunning(false);
    }
  }

  const outputs = (cell.outputs as unknown as OutputMessage[]) || [];

  return (
    <div className="group rounded-lg border border-neutral-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-neutral-400">
          [{running ? "*" : cell.execution_count ?? " "}]
        </span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={handleRun} disabled={running} className="text-xs text-neutral-600 hover:text-neutral-900">
            Run
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
      <Editor
        height={Math.max(60, cell.source.split("\n").length * 20 + 20)}
        language="python"
        theme="vs"
        value={cell.source}
        onChange={(value) => onChange(value ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          lineNumbers: "off",
          folding: false,
        }}
      />
      <OutputRenderer outputs={outputs} />
    </div>
  );
}
