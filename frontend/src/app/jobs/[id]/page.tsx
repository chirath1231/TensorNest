"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { jobsApi } from "@/lib/resources";
import type { Job } from "@/lib/types";

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

function JobDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState("");
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
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
      <div className="flex h-screen items-center justify-center text-sm text-neutral-500">Loading…</div>
    );
  }

  return (
    <div>
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
      <main className="mx-auto max-w-4xl px-6 py-8">
        <button
          onClick={() => router.push("/jobs")}
          className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Jobs
        </button>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{job.name}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          {(job.status === "queued" || job.status === "running") && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
            >
              Cancel
            </button>
          )}
        </div>

        {job.status === "running" && (
          <div className="mb-6 h-1 overflow-hidden rounded-full bg-neutral-100">
            {job.progress > 0 ? (
              <motion.div
                className="h-full rounded-full bg-blue-500"
                animate={{ width: `${job.progress * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            ) : (
              <motion.div
                className="h-full w-1/4 rounded-full bg-blue-400"
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
              className="mb-4 overflow-hidden rounded-md bg-red-50 p-3 text-sm text-red-700"
            >
              {job.error_message}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mb-6 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-neutral-500">Provider</p>
            <p>{job.provider_type}</p>
          </div>
          <div>
            <p className="text-neutral-500">Started</p>
            <p>{job.started_at ? new Date(job.started_at).toLocaleString() : "—"}</p>
          </div>
          <div>
            <p className="text-neutral-500">Finished</p>
            <p>{job.finished_at ? new Date(job.finished_at).toLocaleString() : "—"}</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Logs</h2>
            <button
              onClick={() => setFollow((v) => !v)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                follow ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              <ChevronDown className="h-3 w-3" />
              {follow ? "Following" : "Follow output"}
            </button>
          </div>
          <pre
            ref={logRef}
            onWheel={() => setFollow(false)}
            className="max-h-96 overflow-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100 transition-colors duration-500"
          >
            {logs || "No logs yet."}
          </pre>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Checkpoints</h2>
          {checkpoints.length === 0 ? (
            <p className="text-sm text-neutral-500">No checkpoints written yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
              <AnimatePresence initial={false}>
                {checkpoints.map((c, i) => (
                  <motion.li
                    key={c}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <FileArchive className="h-3.5 w-3.5 text-neutral-400" />
                    {c}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </main>
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
