import { cn } from "@/lib/utils";

/** The mark: three stacked tensor planes converging on a node. Inline SVG
 *  rather than a file so it inherits currentColor and the gradient stays
 *  crisp at any size. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("h-full w-full", className)}>
      <defs>
        <linearGradient id="tn-mark" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="rgb(34,211,238)" />
          <stop offset="0.55" stopColor="rgb(167,139,250)" />
          <stop offset="1" stopColor="rgb(244,114,182)" />
        </linearGradient>
      </defs>
      <path
        d="M16 3.5 28 10l-12 6.5L4 10l12-6.5Z"
        stroke="url(#tn-mark)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4 16.2 16 22.7l12-6.5"
        stroke="url(#tn-mark)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity="0.65"
      />
      <path
        d="M4 22.2 16 28.7l12-6.5"
        stroke="url(#tn-mark)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity="0.35"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="h-7 w-7 shrink-0">
        <LogoMark />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-100">
        Tensor<span className="text-gradient">Nest</span>
      </span>
    </span>
  );
}
