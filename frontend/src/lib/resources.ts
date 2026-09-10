import { apiFetch } from "./api";
import type { FileRecord, Job, Notebook, NotebookSummary } from "./types";

export const notebooksApi = {
  list: () => apiFetch<NotebookSummary[]>("/notebooks"),
  get: (id: string) => apiFetch<Notebook>(`/notebooks/${id}`),
  create: (title: string) =>
    apiFetch<Notebook>("/notebooks", { method: "POST", body: JSON.stringify({ title }) }),
  update: (id: string, payload: { title?: string; content?: unknown }) =>
    apiFetch<Notebook>(`/notebooks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiFetch<void>(`/notebooks/${id}`, { method: "DELETE" }),
  startKernel: (id: string) =>
    apiFetch<{ session_id: string; status: string; ws_path: string }>(`/notebooks/${id}/kernel`, {
      method: "POST",
    }),
  stopKernel: (id: string) => apiFetch<void>(`/notebooks/${id}/kernel`, { method: "DELETE" }),
};

export const jobsApi = {
  list: () => apiFetch<Job[]>("/jobs"),
  get: (id: string) => apiFetch<Job>(`/jobs/${id}`),
  create: (payload: { name: string; script_source: string; notebook_id?: string | null }) =>
    apiFetch<Job>("/jobs", { method: "POST", body: JSON.stringify(payload) }),
  logs: (id: string) => apiFetch<{ logs: string }>(`/jobs/${id}/logs`),
  checkpoints: (id: string) => apiFetch<{ checkpoints: string[] }>(`/jobs/${id}/checkpoints`),
  cancel: (id: string) => apiFetch<Job>(`/jobs/${id}/cancel`, { method: "POST" }),
};

export const filesApi = {
  list: () => apiFetch<FileRecord[]>("/files"),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<FileRecord>("/files", { method: "POST", body: formData });
  },
  remove: (id: string) => apiFetch<void>(`/files/${id}`, { method: "DELETE" }),
};
