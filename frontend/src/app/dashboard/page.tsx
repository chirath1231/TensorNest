"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Loader2, NotebookPen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { PageHeader, SearchInput } from "@/components/ui/PageHeader";
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
    <div className="min-h-screen">
      <NavBar />
      {dialog}
      <main className="mx-auto max-w-6xl px-5 py-9">
        <PageHeader title="Notebooks" description="Interactive Python, session-bound by design.">
          <SearchInput value={query} onChange={setQuery} placeholder="Search notebooks…" />
          <button onClick={handleCreate} disabled={creating} className="btn-accent">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? "Creating…" : "New notebook"}
          </button>
        </PageHeader>

        {loading ? (
          <SkeletonCards />
        ) : notebooks.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="No notebooks yet"
            description="Create a notebook to start running code against your compute providers."
            action={{ label: "New notebook", onClick: handleCreate }}
          />
        ) : filtered.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted">No notebooks match “{query}”.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((nb, i) => (
                <motion.div
                  key={nb.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2) }}
                  whileHover={{ y: -3 }}
                  onClick={() => router.push(`/notebooks/${nb.id}`)}
                  className="glass glass-sheen group relative cursor-pointer rounded-2xl p-5 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/15 to-violet-500/15">
                      <FileText className="h-4 w-4 text-cyan-200" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(nb);
                      }}
                      className="rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Delete ${nb.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="truncate text-sm font-medium text-slate-100">{nb.title}</p>
                  <p className="mt-1 text-xs text-muted">
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
