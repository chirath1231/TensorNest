"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { JobForm } from "@/components/jobs/JobForm";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { jobsApi } from "@/lib/resources";
import type { Job } from "@/lib/types";

function JobsContent() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(() => {
    jobsApi.list().then(setJobs);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Background Jobs</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            {showForm ? "Cancel" : "New Job"}
          </button>
        </div>

        {showForm && (
          <div className="mb-6">
            <JobForm
              onCreated={() => {
                setShowForm(false);
                refresh();
              }}
            />
          </div>
        )}

        {jobs.length === 0 ? (
          <p className="text-sm text-neutral-500">No jobs submitted yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {jobs.map((job) => (
              <li
                key={job.id}
                onClick={() => router.push(`/jobs/${job.id}`)}
                className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-neutral-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{job.name}</span>
                  <JobStatusBadge status={job.status} />
                </div>
                <span className="text-xs text-neutral-500">{new Date(job.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default function JobsPage() {
  return (
    <AuthGuard>
      <JobsContent />
    </AuthGuard>
  );
}
