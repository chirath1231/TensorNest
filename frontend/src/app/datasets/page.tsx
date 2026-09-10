"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { filesApi } from "@/lib/resources";
import type { FileRecord } from "@/lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DatasetsContent() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(() => {
    filesApi.list().then(setFiles);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await filesApi.upload(file);
      refresh();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    await filesApi.remove(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Datasets</h1>
          <label className="cursor-pointer rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            {uploading ? "Uploading…" : "Upload File"}
            <input type="file" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-neutral-500">No files uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{file.filename}</p>
                  <p className="text-xs text-neutral-500">
                    {formatSize(file.size)} · {new Date(file.created_at).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => handleDelete(file.id)} className="text-xs text-red-600 hover:underline">
                  Delete
                </button>
              </li>
            ))}
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
