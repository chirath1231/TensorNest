"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { jobsApi } from "@/lib/resources";
import type { Job } from "@/lib/types";

function JobDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState("");
  const [checkpoints, setCheckpoints] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [jobData, logsData, checkpointsData] = await Promise.all([
      jobsApi.get(params.id),
      jobsApi.logs(params.id),
      jobsApi.checkpoints(params.id),
    ]);
    setJob(jobData);
    setLogs(logsData.logs);
    setCheckpoints(checkpointsData.checkpoints);
  }, [params.id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      setJob((current) => {
        if (current && (current.status === "succeeded" || current.status === "failed" || current.status === "cancelled")) {
          return current;
        }
        refresh();
        return current;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleCancel() {
    await jobsApi.cancel(params.id);
    refresh();
  }

  if (!job) {
    return <div className="flex h-screen items-center justify-center text-sm text-neutral-500">Loading…</div>;
  }

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <button onClick={() => router.push("/jobs")} className="mb-4 text-sm text-neutral-500 hover:text-neutral-900">
          ← Jobs
        </button>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{job.name}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          {(job.status === "queued" || job.status === "running") && (
            <button onClick={handleCancel} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600">
              Cancel
            </button>
          )}
        </div>

        {job.error_message && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{job.error_message}</p>
        )}

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
          <h2 className="mb-2 text-sm font-medium">Logs</h2>
          <pre className="max-h-96 overflow-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">
            {logs || "No logs yet."}
          </pre>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Checkpoints</h2>
          {checkpoints.length === 0 ? (
            <p className="text-sm text-neutral-500">No checkpoints written yet.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {checkpoints.map((c) => (
                <li key={c}>{c}</li>
              ))}
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
