"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, NotebookPen, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { useConfirm } from "@/components/ui/useConfirm";
import { notebooksApi } from "@/lib/resources";
import type { NotebookSummary } from "@/lib/types";

function DashboardContent() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    notebooksApi
      .list()
      .then(setNotebooks)
      .catch(() => toast.error("Failed to load notebooks"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => notebooks.filter((n) => n.title.toLowerCase().includes(query.toLowerCase())),
    [notebooks, query]
  );

  async function handleCreate() {
    setCreating(true);
    try {
      const notebook = await notebooksApi.create("Untitled Notebook");
      router.push(`/notebooks/${notebook.id}`);
    } catch {
      toast.error("Failed to create notebook");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(nb: NotebookSummary) {
    const ok = await confirm({
      title: `Delete "${nb.title}"?`,
      description: "This permanently removes the notebook and its cell history.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const prev = notebooks;
    setNotebooks((cur) => cur.filter((n) => n.id !== nb.id));
    try {
      await notebooksApi.remove(nb.id);
      toast.success(`Deleted "${nb.title}"`);
    } catch {
      setNotebooks(prev);
      toast.error("Failed to delete notebook");
    }
  }

  return (
    <div>
      <NavBar />
      {dialog}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold dark:text-[#e6c163]">Your Notebooks</h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#e6c163]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notebooks…"
                className="w-48 rounded-md border border-[#f2bc33] py-1.5 pl-8 pr-3 text-sm outline-none transition focus:w-64 focus:border-cyan-500 dark:bg-neutral-900 dark:text-[#e6c163] dark:placeholder:text-neutral-500"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Creating…" : "New Notebook"}
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonCards />
        ) : notebooks.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="No notebooks yet"
            description="Create a notebook to start running code against your compute providers."
            action={{ label: "New Notebook", onClick: handleCreate }}
          />
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#e6c163]">No notebooks match “{query}”.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((nb, i) => (
                <motion.div
                  key={nb.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                  onClick={() => router.push(`/notebooks/${nb.id}`)}
                  className="group cursor-pointer rounded-lg border border-[#f2bc33] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-neutral-900"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-[#e6c163] dark:bg-neutral-800 dark:text-[#e6c163]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(nb);
                      }}
                      className="rounded-md p-1.5 text-[#e6c163] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-[#e6c163] dark:hover:bg-red-950/40"
                      aria-label="Delete notebook"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="truncate text-sm font-medium text-[#e6c163] dark:text-[#e6c163]">{nb.title}</p>
                  <p className="mt-1 text-xs text-[#e6c163] dark:text-[#e6c163]">
                    Updated {new Date(nb.updated_at).toLocaleString()}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
