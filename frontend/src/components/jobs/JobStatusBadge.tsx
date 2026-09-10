import type { JobStatus } from "@/lib/types";

const colors: Record<JobStatus, string> = {
  queued: "bg-neutral-100 text-neutral-600",
  running: "bg-cyan-100 text-cyan-700",
  succeeded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-neutral-100 text-neutral-500",
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
