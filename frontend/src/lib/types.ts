export interface User {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  /** Short-lived signed URL, re-issued on every read. Null when unset. */
  avatar_url: string | null;
  created_at: string;
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
  allow_network: boolean;
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

export type DatasetStatus = "ready" | "importing" | "failed";

export interface FileRecord {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  status: DatasetStatus;
  error_message: string | null;
  /** "upload" for a file someone picked, otherwise the catalogue it came from. */
  source: string;
  source_url: string | null;
  data_license: string | null;
  created_at: string;
}

export interface DatasetFile {
  path: string;
  size: number | null;
}

export interface DiscoverResult {
  source: string;
  ref: string;
  title: string;
  description: string;
  url: string;
  license: string | null;
  downloads: number | null;
  likes: number | null;
  files: DatasetFile[];
}

export interface DiscoverSource {
  name: string;
  label: string;
  available: boolean;
}

export type NotificationEvent = "job_started" | "job_succeeded" | "job_failed";

export interface AppNotification {
  id: string;
  event: NotificationEvent;
  title: string;
  body: string;
  job_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  items: AppNotification[];
  unread_count: number;
  email_enabled: boolean;
}
