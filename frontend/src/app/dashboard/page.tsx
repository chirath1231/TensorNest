"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { notebooksApi } from "@/lib/resources";
import type { NotebookSummary } from "@/lib/types";

function DashboardContent() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    notebooksApi
      .list()
      .then(setNotebooks)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const notebook = await notebooksApi.create("Untitled Notebook");
      router.push(`/notebooks/${notebook.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    await notebooksApi.remove(id);
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your Notebooks</h1>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "New Notebook"}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : notebooks.length === 0 ? (
          <p className="text-sm text-neutral-500">No notebooks yet. Create one to get started.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {notebooks.map((nb) => (
              <li key={nb.id} className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => router.push(`/notebooks/${nb.id}`)}
                  className="text-left text-sm font-medium text-neutral-900 hover:underline"
                >
                  {nb.title}
                </button>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-neutral-500">
                    Updated {new Date(nb.updated_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleDelete(nb.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
