"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Database, FileSpreadsheet, FileText, Image as ImageIcon, Search, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/useConfirm";
import { filesApi } from "@/lib/resources";
import type { FileRecord } from "@/lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["csv", "tsv", "parquet"].includes(ext)) return FileSpreadsheet;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return ImageIcon;
  if (["json", "txt", "md", "yaml", "yml"].includes(ext)) return FileText;
  return Database;
}

interface PendingUpload {
  key: string;
  name: string;
  progress: number;
}

function DatasetsContent() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const refresh = useCallback(() => {
    filesApi
      .list()
      .then(setFiles)
      .catch(() => toast.error("Failed to load datasets"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
    () => files.filter((f) => f.filename.toLowerCase().includes(query.toLowerCase())),
    [files, query]
  );

  async function uploadOne(file: File) {
    const key = `${file.name}-${Date.now()}`;
    setUploads((prev) => [...prev, { key, name: file.name, progress: 0 }]);
    try {
      await filesApi.uploadWithProgress(file, (percent) => {
        setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, progress: percent } : u)));
      });
      toast.success(`Uploaded ${file.name}`);
      refresh();
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setUploads((prev) => prev.filter((u) => u.key !== key));
    }
  }

  async function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of list) await uploadOne(file);
  }

  function handleDrag(e: DragEvent, delta: number) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += delta;
    setDragActive(dragCounter.current > 0);
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    const list = Array.from(e.dataTransfer.files);
    for (const file of list) await uploadOne(file);
  }

  async function handleDelete(file: FileRecord) {
    const ok = await confirm({
      title: `Delete "${file.filename}"?`,
      description: "This permanently removes the file from storage.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const prev = files;
    setFiles((cur) => cur.filter((f) => f.id !== file.id));
    try {
      await filesApi.remove(file.id);
      toast.success(`Deleted ${file.filename}`);
    } catch {
      setFiles(prev);
      toast.error("Failed to delete file");
    }
  }

  return (
    <div>
      <NavBar />
      {dialog}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Datasets</h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files…"
                className="w-48 rounded-md border border-neutral-300 py-1.5 pl-8 pr-3 text-sm outline-none transition focus:w-64 focus:border-neutral-900"
              />
            </div>
            <label className="cursor-pointer rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800">
              Upload File
              <input ref={inputRef} type="file" multiple onChange={handleFileInput} className="hidden" />
            </label>
          </div>
        </div>

        <div
          onDragEnter={(e) => handleDrag(e, 1)}
          onDragLeave={(e) => handleDrag(e, -1)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`mb-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragActive ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
          }`}
        >
          <UploadCloud className={`mb-2 h-6 w-6 ${dragActive ? "text-neutral-900" : "text-neutral-400"}`} />
          <p className="text-sm text-neutral-600">
            Drag and drop files here, or{" "}
            <button onClick={() => inputRef.current?.click()} className="font-medium text-neutral-900 underline">
              browse
            </button>
          </p>
        </div>

        <AnimatePresence initial={false}>
          {uploads.map((u) => (
            <motion.div
              key={u.key}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden rounded-md border border-neutral-200 px-3 py-2"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate text-neutral-700">{u.name}</span>
                <span className="text-neutral-400">{u.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <motion.div
                  className="h-full rounded-full bg-neutral-900"
                  animate={{ width: `${u.progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading ? (
          <SkeletonRows />
        ) : files.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No files uploaded yet"
            description="Upload a dataset to make it available to notebooks and jobs."
          />
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">No files match “{query}”.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            <AnimatePresence initial={false}>
              {filtered.map((file) => {
                const Icon = fileIcon(file.filename);
                return (
                  <motion.li
                    key={file.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="group flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{file.filename}</p>
                        <p className="text-xs text-neutral-500">
                          {formatSize(file.size)} · {new Date(file.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(file)}
                      className="rounded-md p-1.5 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      aria-label="Delete file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </main>
    </div>
  );
}

export default function DatasetsPage() {
  return (
    <AuthGuard>
      <DatasetsContent />
    </AuthGuard>
  );
}
