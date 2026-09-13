export interface User {
  id: string;
  email: string;
  name: string;
}

export interface NotebookSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface NotebookCell {
  id: string;
  cell_type: "code" | "markdown";
  source: string;
  outputs: unknown[];
  execution_count: number | null;
}

export interface NotebookContent {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: NotebookCell[];
}

export interface Notebook extends NotebookSummary {
  content: NotebookContent;
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface Job {
  id: string;
  name: string;
  status: JobStatus;
  provider_type: string;
  progress: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export type ProviderType = "local_cpu" | "modal_gpu";

export interface Checkpoint {
  name: string;
  size: number;
  modified: string;
}

export interface FileRecord {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  created_at: string;
}
