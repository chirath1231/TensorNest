"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Download, FileArchive, Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { jobsApi } from "@/lib/resources";
import type { Checkpoint, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

function JobDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState("");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [follow, setFollow] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const wasLive = useRef(false);
  const logRef = useRef<HTMLPreElement>(null);

  const refresh = useCallback(async () => {
    const [jobData, logsData, checkpointsData] = await Promise.all([
      jobsApi.get(params.id),
      jobsApi.logs(params.id),
      jobsApi.checkpoints(params.id),
    ]);
    setJob(jobData);
    setLogs(logsData.logs);
    setCheckpoints(checkpointsData.checkpoints);

    if (wasLive.current && TERMINAL.has(jobData.status)) {
      if (jobData.status === "succeeded") toast.success(`"${jobData.name}" succeeded`);
      else if (jobData.status === "failed") toast.error(`"${jobData.name}" failed`);
    }
    wasLive.current = !TERMINAL.has(jobData.status);
  }, [params.id]);

  async function downloadCheckpoint(name: string) {
    try {
      // The API returns a short-lived presigned URL so the file comes straight
      // from the bucket rather than being proxied through the backend.
      const { url } = await jobsApi.checkpointUrl(params.id, name);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get download link");
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      setJob((current) => {
        if (current && TERMINAL.has(current.status)) {
          return current;
        }
        refresh();
        return current;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (follow && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, follow]);

  async function handleCancel() {
    try {
      await jobsApi.cancel(params.id);
      toast.message("Job cancelled");
      refresh();
    } catch {
      toast.error("Failed to cancel job");
    } finally {
      setConfirmOpen(false);
    }
  }

  if (!job) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <ConfirmDialog
        open={confirmOpen}
        title="Cancel this job?"
        description="The running container will be stopped immediately."
        confirmLabel="Cancel job"
        danger
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
      />
      <main className="mx-auto max-w-4xl px-5 py-9">
        <button
          onClick={() => router.push("/jobs")}
          className="mb-5 flex items-center gap-1.5 text-sm text-muted transition hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Jobs
        </button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-50">
              {job.name}
            </h1>
            <JobStatusBadge status={job.status} />
          </div>
          {(job.status === "queued" || job.status === "running") && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20"
            >
              Cancel job
            </button>
          )}
        </div>

        {job.status === "running" && (
          <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10">
            {job.progress > 0 ? (
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                animate={{ width: `${job.progress * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            ) : (
              <motion.div
                className="h-full w-1/4 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                animate={{ x: ["-100%", "500%"] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>
        )}

        <AnimatePresence>
          {job.error_message && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 flex items-start gap-2 overflow-hidden rounded-xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-sm text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 whitespace-pre-wrap break-words">{job.error_message}</span>
            </motion.p>
          )}
        </AnimatePresence>

        <dl className="glass mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl sm:grid-cols-3">
          <Stat label="Provider" value={job.provider_type} mono />
          <Stat
            label="Started"
            value={job.started_at ? new Date(job.started_at).toLocaleString() : "—"}
          />
          <Stat
            label="Finished"
            value={job.finished_at ? new Date(job.finished_at).toLocaleString() : "—"}
          />
        </dl>

        <section className="mb-6">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <ScrollText className="h-4 w-4 text-slate-400" />
              Logs
            </h2>
            <button
              onClick={() => setFollow((v) => !v)}
              aria-pressed={follow}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition",
                follow
                  ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                  : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              {follow ? "Following" : "Follow output"}
            </button>
          </div>
          <pre
            ref={logRef}
            onWheel={() => setFollow(false)}
            className="glass max-h-96 overflow-auto rounded-2xl p-4 font-mono text-xs leading-relaxed text-slate-200"
          >
            {logs || <span className="text-muted">No logs yet.</span>}
          </pre>
        </section>

        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FileArchive className="h-4 w-4 text-slate-400" />
            Checkpoints
            {checkpoints.length > 0 && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-normal text-muted">
                {checkpoints.length}
              </span>
            )}
          </h2>
          {checkpoints.length === 0 ? (
            <p className="glass rounded-2xl px-4 py-6 text-center text-sm text-muted">
              No checkpoints written yet.
            </p>
          ) : (
            <ul className="glass divide-y divide-white/[0.07] overflow-hidden rounded-2xl">
              <AnimatePresence initial={false}>
                {checkpoints.map((c, i) => (
                  <motion.li
                    key={c.name}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.025, 0.2) }}
                    className="group flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/[0.04]"
                  >
                    <FileArchive className="h-4 w-4 shrink-0 text-cyan-200" />
                    <span className="truncate text-slate-200">{c.name}</span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
                      {formatBytes(c.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadCheckpoint(c.name)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                      aria-label={`Download ${c.name}`}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white/[0.02] px-4 py-3.5">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cn("mt-1 truncate text-sm text-slate-100", mono && "font-mono text-[13px]")}>
        {value}
      </dd>
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <AuthGuard>
      <JobDetailContent />
    </AuthGuard>
  );
}
