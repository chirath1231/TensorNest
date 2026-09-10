"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListChecks, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { JobForm } from "@/components/jobs/JobForm";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { jobsApi } from "@/lib/resources";
import type { Job } from "@/lib/types";

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

function JobsContent() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const prevStatuses = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(() => {
    jobsApi.list().then((next) => {
      for (const job of next) {
        const prev = prevStatuses.current.get(job.id);
        if (prev && prev !== job.status && TERMINAL.has(job.status)) {
          if (job.status === "succeeded") toast.success(`"${job.name}" succeeded`);
          else if (job.status === "failed") toast.error(`"${job.name}" failed`);
          else toast.message(`"${job.name}" cancelled`);
        }
        prevStatuses.current.set(job.id, job.status);
      }
      setJobs(next);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const anyLive = jobs.some((j) => !TERMINAL.has(j.status));

  return (
    <div>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold">Background Jobs</h1>
            {anyLive && (
              <span className="flex items-center gap-1.5 rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-600">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-600" />
                </span>
                Live
              </span>
            )}
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "New Job"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="mb-6 overflow-hidden"
            >
              <JobForm
                onCreated={() => {
                  setShowForm(false);
                  toast.success("Job submitted");
                  refresh();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <SkeletonRows />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No jobs submitted yet"
            description="Submit a script to run it against a compute provider in the background."
            action={{ label: "New Job", onClick: () => setShowForm(true) }}
          />
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            <AnimatePresence initial={false}>
              {jobs.map((job) => (
                <motion.li
                  key={job.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="group relative flex cursor-pointer items-center justify-between overflow-hidden px-4 py-3.5 transition hover:bg-neutral-50"
                >
                  <span
                    className={`absolute left-0 top-0 h-full w-0.5 ${
                      job.status === "running"
                        ? "bg-cyan-500"
                        : job.status === "succeeded"
                          ? "bg-green-500"
                          : job.status === "failed"
                            ? "bg-red-500"
                            : "bg-neutral-200"
                    }`}
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-900">{job.name}</span>
                    <JobStatusBadge status={job.status} />
                  </div>
                  <div className="flex items-center gap-4">
                    {job.status === "running" &&
                      (job.progress > 0 ? (
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
                          <motion.div
                            className="h-full rounded-full bg-cyan-500"
                            animate={{ width: `${job.progress * 100}%` }}
                            transition={{ duration: 0.4 }}
                          />
                        </div>
                      ) : (
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
                          <motion.div
                            className="h-full w-1/3 rounded-full bg-cyan-400"
                            animate={{ x: ["-100%", "300%"] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </div>
                      ))}
                    <span className="text-xs text-neutral-500">
                      {new Date(job.created_at).toLocaleString()}
                    </span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
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
