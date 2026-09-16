"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { PageHeader, SearchInput } from "@/components/ui/PageHeader";
import { useConfirm } from "@/components/ui/useConfirm";
import { filesApi } from "@/lib/resources";
import type { FileRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

  const totalSize = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);

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

  async function handleDownload(file: FileRecord) {
    try {
      const { url } = await filesApi.downloadUrl(file.id);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Failed to create a download link");
    }
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
    <div className="min-h-screen">
      <NavBar />
      {dialog}
      <main className="mx-auto max-w-5xl px-5 py-9">
        <PageHeader
          title="Datasets"
          description={
            files.length
              ? `${files.length} file${files.length === 1 ? "" : "s"} · ${formatSize(totalSize)} stored`
              : "Files available to your notebooks and jobs."
          }
        >
          <SearchInput value={query} onChange={setQuery} placeholder="Search files…" />
          <button onClick={() => inputRef.current?.click()} className="btn-accent">
            <UploadCloud className="h-4 w-4" />
            Upload
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </PageHeader>

        <div
          onDragEnter={(e) => handleDrag(e, 1)}
          onDragLeave={(e) => handleDrag(e, -1)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={cn(
            "glass mb-6 flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-10 text-center transition-all",
            dragActive
              ? "scale-[1.01] border-cyan-400/60 bg-cyan-400/10"
              : "hover:border-white/20"
          )}
        >
          <motion.div
            animate={dragActive ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/15 to-violet-500/15"
          >
            <UploadCloud
              className={cn("h-5 w-5 transition-colors", dragActive ? "text-cyan-200" : "text-slate-300")}
            />
          </motion.div>
          <p className="text-sm text-slate-300">
            {dragActive ? (
              "Drop to upload"
            ) : (
              <>
                Drag files here, or{" "}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="font-medium text-cyan-300 underline-offset-4 hover:underline"
                >
                  browse
                </button>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            Uploads stream straight to object storage, so large files are safe.
          </p>
        </div>

        <AnimatePresence initial={false}>
          {uploads.map((u) => (
            <motion.div
              key={u.key}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass mb-3 overflow-hidden rounded-xl px-4 py-3"
            >
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="truncate text-slate-200">{u.name}</span>
                <span className="tabular-nums text-muted">{u.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
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
            action={{ label: "Upload a file", onClick: () => inputRef.current?.click() }}
          />
        ) : filtered.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted">No files match “{query}”.</p>
        ) : (
          <ul className="glass divide-y divide-white/[0.07] overflow-hidden rounded-2xl">
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
                    className="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06]">
                        <Icon className="h-4 w-4 text-cyan-200" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {file.filename}
                        </p>
                        <p className="text-xs text-muted">
                          {formatSize(file.size)} · {new Date(file.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        onClick={() => handleDownload(file)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                        aria-label={`Download ${file.filename}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                        aria-label={`Delete ${file.filename}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
