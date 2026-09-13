import type { JobStatus } from "@/lib/types";

const colors: Record<JobStatus, string> = {
  queued: "bg-neutral-100 text-[#e6c163] dark:bg-neutral-800 dark:text-[#e6c163]",
  running: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400",
  succeeded: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  cancelled: "bg-neutral-100 text-[#e6c163] dark:bg-neutral-800 dark:text-[#e6c163]",
};

const dotColors: Record<JobStatus, string> = {
  queued: "bg-neutral-400",
  running: "bg-cyan-500",
  succeeded: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-neutral-400",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      <span className="relative flex h-1.5 w-1.5">
        {status === "running" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColors[status]}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColors[status]}`} />
      </span>
      {status}
    </span>
  );
}
