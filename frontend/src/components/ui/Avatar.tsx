"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-24 w-24 text-2xl",
} as const;

export function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name || "").trim();
  if (source) {
    const parts = source.split(/\s+/);
    const letters = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0][0];
    return letters.toUpperCase();
  }
  return (email || "?").slice(0, 1).toUpperCase();
}

/** Profile picture, falling back to initials on the accent gradient.
 *
 *  The URL is a presigned link with an expiry, so it can start returning 403
 *  during a long session. `failed` catches that and shows initials instead of
 *  a broken-image icon. */
export function Avatar({
  src,
  name,
  email,
  size = "sm",
  className,
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const base = cn(
    "shrink-0 overflow-hidden rounded-full ring-1 ring-white/15",
    sizes[size],
    className
  );

  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element -- presigned bucket
    // URLs are not a configured next/image remote host, and they rotate.
    return (
      <img
        src={src}
        alt={name || email || "Profile picture"}
        onError={() => setFailed(true)}
        className={cn(base, "object-cover")}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        base,
        "grid place-items-center bg-gradient-to-br from-cyan-400 to-violet-500 font-semibold text-slate-950"
      )}
    >
      {initialsOf(name, email)}
    </span>
  );
}
