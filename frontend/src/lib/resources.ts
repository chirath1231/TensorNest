import { apiFetch, API_BASE_URL, ApiError } from "./api";
import { getAccessToken } from "./auth";
import type { Checkpoint, FileRecord, Job, Notebook, NotebookSummary, ProviderType } from "./types";

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
  create: (payload: {
    name: string;
    script_source: string;
    notebook_id?: string | null;
    provider_type?: ProviderType;
  }) => apiFetch<Job>("/jobs", { method: "POST", body: JSON.stringify(payload) }),
  logs: (id: string) => apiFetch<{ logs: string }>(`/jobs/${id}/logs`),
  checkpoints: (id: string) => apiFetch<{ checkpoints: Checkpoint[] }>(`/jobs/${id}/checkpoints`),
  checkpointUrl: (id: string, name: string) =>
    apiFetch<{ url: string; filename: string }>(
      `/jobs/${id}/checkpoints/${encodeURIComponent(name)}/download`
    ),
  cancel: (id: string) => apiFetch<Job>(`/jobs/${id}/cancel`, { method: "POST" }),
};

export const filesApi = {
  list: () => apiFetch<FileRecord[]>("/files"),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<FileRecord>("/files", { method: "POST", body: formData });
  },
  uploadWithProgress: (file: File, onProgress: (percent: number) => void) => {
    return new Promise<FileRecord>((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}/files`);
      const token = getAccessToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          let detail = xhr.statusText;
          try {
            detail = JSON.parse(xhr.responseText).detail || detail;
          } catch {
            // ignore non-JSON error bodies
          }
          reject(new ApiError(xhr.status, detail));
        }
      };
      xhr.onerror = () => reject(new ApiError(0, "Network error"));
      xhr.send(formData);
    });
  },
  remove: (id: string) => apiFetch<void>(`/files/${id}`, { method: "DELETE" }),
};
