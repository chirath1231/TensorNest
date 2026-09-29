"use client";

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { CodeCell } from "@/components/notebook/CodeCell";
import { MarkdownCell } from "@/components/notebook/MarkdownCell";
import { NotebookToolbar } from "@/components/notebook/NotebookToolbar";
import { SortableCell } from "@/components/notebook/SortableCell";
import { useKernel } from "@/components/notebook/useKernel";
import type { OutputMessage } from "@/lib/kernelClient";
import { jobsApi, notebooksApi } from "@/lib/resources";
import type { Notebook, NotebookCell } from "@/lib/types";

function newCell(cellType: "code" | "markdown"): NotebookCell {
  return {
    id: crypto.randomUUID(),
    cell_type: cellType,
    source: "",
    outputs: [],
    execution_count: null,
  };
}

function NotebookEditorContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const notebookId = params.id;

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [title, setTitle] = useState("");
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [submittingJob, setSubmittingJob] = useState(false);
  const [exporting, setExporting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { status: kernelStatus, runCode } = useKernel(notebookId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    notebooksApi
      .get(notebookId)
      .then((nb) => {
        setNotebook(nb);
        setTitle(nb.title);
        setCells(nb.content.cells.length > 0 ? nb.content.cells : [newCell("code")]);
      })
      .catch(() => toast.error("Failed to load notebook"));
  }, [notebookId]);

  const scheduleSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      setCells((currentCells) => {
        setTitle((currentTitle) => {
          notebooksApi
            .update(notebookId, {
              title: currentTitle,
              content: { ...notebook?.content, cells: currentCells },
            })
            .then(() => setSaveStatus("saved"))
            .catch(() => {
              setSaveStatus("unsaved");
              toast.error("Failed to save notebook");
            });
          return currentTitle;
        });
        return currentCells;
      });
    }, 1000);
  }, [notebookId, notebook?.content]);

  /** Persist immediately instead of waiting out the debounce.
   *
   *  Exporting or submitting a job reads the notebook on the server, so a save
   *  still sitting in the 1s timer would silently produce a stale artifact. */
  async function flushSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaveStatus("saving");
    try {
      await notebooksApi.update(notebookId, {
        title,
        content: { ...notebook?.content, cells },
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
      throw new Error("Could not save the notebook before running it.");
    }
  }

  function updateCell(id: string, partial: Partial<NotebookCell>) {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)));
    scheduleSave();
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave();
  }

  function addCell(cellType: "code" | "markdown") {
    setCells((prev) => [...prev, newCell(cellType)]);
    scheduleSave();
  }

  function deleteCell(id: string) {
    setCells((prev) => prev.filter((c) => c.id !== id));
    scheduleSave();
  }

  function moveCell(id: string, direction: -1 | 1) {
    setCells((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    scheduleSave();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCells((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    scheduleSave();
  }

  function advanceFrom(id: string) {
    setCells((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      if (index === -1) return prev;
      if (index === prev.length - 1) {
        scheduleSave();
        return [...prev, newCell("code")];
      }
      return prev;
    });
  }

  async function runCell(cell: NotebookCell) {
    if (cell.cell_type !== "code") return;
    const outputs: OutputMessage[] = [];
    updateCell(cell.id, { outputs: [] });
    try {
      await runCode(
        cell.source,
        (output) => {
          outputs.push(output);
          updateCell(cell.id, { outputs: [...outputs] });
        },
        (count) => updateCell(cell.id, { execution_count: count })
      );
    } catch (err) {
      // Prefer the server's explanation (e.g. "Kernel image is not built")
      // over a generic connection message — it usually says what to fix.
      const message = err instanceof Error ? err.message : "Failed to reach kernel";
      outputs.push({
        type: "error",
        ename: "ConnectionError",
        evalue: message,
        traceback: [],
      });
      updateCell(cell.id, { outputs: [...outputs] });
      toast.error(message);
    }
  }

  async function runAll() {
    for (const cell of cells) {
      if (cell.cell_type === "code") {
        await runCell(cell);
      }
    }
    toast.success("Run All complete");
  }

  async function runAsJob() {
    // Markdown is dropped and code cells are joined in order, which is exactly
    // what "Run all" executes — so the job runs the notebook as read.
    const script = cells
      .filter((c) => c.cell_type === "code")
      .map((c) => c.source.trimEnd())
      .filter(Boolean)
      .join("\n\n");

    if (!script) {
      toast.error("Nothing to run — this notebook has no code yet.");
      return;
    }

    setSubmittingJob(true);
    try {
      await flushSave();
      const job = await jobsApi.create({
        name: title || "Untitled Notebook",
        script_source: script,
        notebook_id: notebookId,
      });
      toast.success("Job submitted — it keeps running if you close this tab.", {
        action: { label: "View", onClick: () => router.push(`/jobs/${job.id}`) },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit the job");
    } finally {
      setSubmittingJob(false);
    }
  }

  async function exportNotebook() {
    setExporting(true);
    try {
      await flushSave();
      const { url, filename } = await notebooksApi.export(notebookId);
      // The presigned URL already carries Content-Disposition: attachment, so
      // opening it downloads rather than navigating away.
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success(`Exported ${filename}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export this notebook");
    } finally {
      setExporting(false);
    }
  }

  if (!notebook) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted">Loading…</div>;
  }

  return (
    <div>
      <NotebookToolbar
        title={title}
        onTitleChange={handleTitleChange}
        onAddCode={() => addCell("code")}
        onAddMarkdown={() => addCell("markdown")}
        onRunAll={runAll}
        onRunAsJob={runAsJob}
        onExport={exportNotebook}
        submittingJob={submittingJob}
        exporting={exporting}
        kernelStatus={kernelStatus}
        saveStatus={saveStatus}
      />
      <main className="mx-auto max-w-4xl space-y-3 py-6 pl-9 pr-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cells.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cells.map((cell) => (
              <SortableCell key={cell.id} id={cell.id}>
                {cell.cell_type === "code" ? (
                  <CodeCell
                    cell={cell}
                    onChange={(source) => updateCell(cell.id, { source })}
                    onRun={() => runCell(cell)}
                    onRunAndAdvance={() => advanceFrom(cell.id)}
                    onDelete={() => deleteCell(cell.id)}
                    onMoveUp={() => moveCell(cell.id, -1)}
                    onMoveDown={() => moveCell(cell.id, 1)}
                  />
                ) : (
                  <MarkdownCell
                    source={cell.source}
                    onChange={(source) => updateCell(cell.id, { source })}
                    onAdvance={() => advanceFrom(cell.id)}
                    onDelete={() => deleteCell(cell.id)}
                    onMoveUp={() => moveCell(cell.id, -1)}
                    onMoveDown={() => moveCell(cell.id, 1)}
                  />
                )}
              </SortableCell>
            ))}
          </SortableContext>
        </DndContext>
      </main>
    </div>
  );
}

export default function NotebookEditorPage() {
  return (
    <AuthGuard>
      <NotebookEditorContent />
    </AuthGuard>
  );
}
