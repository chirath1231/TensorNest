"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ListChecks, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { JobForm } from "@/components/jobs/JobForm";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { jobsApi } from "@/lib/resources";
import type { Job } from "@/lib/types";

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

const RAIL: Record<string, string> = {
  running: "bg-cyan-400",
  succeeded: "bg-emerald-400",
  failed: "bg-rose-400",
  queued: "bg-amber-400",
  cancelled: "bg-slate-500",
};

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
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-4xl px-5 py-9">
        <PageHeader
          title="Jobs"
          description="Detached runs. They keep going after you close the tab."
        >
          {anyLive && (
            <span className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
              </span>
              Live
            </span>
          )}
          <button onClick={() => setShowForm((v) => !v)} className="btn-accent">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "New job"}
          </button>
        </PageHeader>

        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
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
            action={{ label: "New job", onClick: () => setShowForm(true) }}
          />
        ) : (
          <ul className="glass divide-y divide-white/[0.07] overflow-hidden rounded-2xl">
            <AnimatePresence initial={false}>
              {jobs.map((job) => (
                <motion.li
                  key={job.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="group relative flex cursor-pointer items-center justify-between gap-3 overflow-hidden px-4 py-4 transition hover:bg-white/[0.05]"
                >
                  <span
                    className={`absolute left-0 top-0 h-full w-[3px] ${RAIL[job.status] ?? "bg-slate-600"}`}
                  />
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="truncate text-sm font-medium text-slate-100">{job.name}</span>
                    <JobStatusBadge status={job.status} />
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {job.status === "running" && (
                      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block">
                        {job.progress > 0 ? (
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                            animate={{ width: `${job.progress * 100}%` }}
                            transition={{ duration: 0.4 }}
                          />
                        ) : (
                          <motion.div
                            className="h-full w-1/3 rounded-full bg-cyan-400"
                            animate={{ x: ["-100%", "300%"] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                          />
                        )}
                      </div>
                    )}
                    <span className="hidden text-xs text-muted sm:inline">
                      {new Date(job.created_at).toLocaleString()}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
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
