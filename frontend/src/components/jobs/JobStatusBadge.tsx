import type { JobStatus } from "@/lib/types";

/** Status colours carry meaning, so they are the one place the accent ramp is
 *  set aside: amber for waiting, cyan for live, emerald for done, rose for
 *  failed, slate for cancelled. */
const styles: Record<JobStatus, string> = {
  queued: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  running: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  succeeded: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  cancelled: "border-white/12 bg-white/5 text-slate-300",
};

const dots: Record<JobStatus, string> = {
  queued: "bg-amber-300",
  running: "bg-cyan-300",
  succeeded: "bg-emerald-300",
  failed: "bg-rose-300",
  cancelled: "bg-slate-400",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles[status]}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {status === "running" && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dots[status]}`}
          />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dots[status]}`} />
      </span>
      {status}
    </span>
  );
}
