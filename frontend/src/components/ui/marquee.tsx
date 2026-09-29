"use client";

// From ui-layouts.com/components/marquee. The published source is written for
// Tailwind v4, where `gap-(--gap)` reads a custom property directly; on v3
// that is spelled `gap-[var(--gap)]`. The `marquee` keyframes it relies on are
// defined in tailwind.config.ts.

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: ReactNode;
  vertical?: boolean;
  repeat?: number;
}

export function Marquee({
  className,
  reverse,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group flex gap-[var(--gap)] overflow-hidden p-2 [--duration:40s] [--gap:1rem]",
        vertical ? "flex-col" : "flex-row",
        className
      )}
    >
      {Array.from({ length: repeat }, (_, i) => (
        <div
          key={i}
          // Only the first copy is real content; the rest exist to make the
          // loop seamless and would otherwise be read out repeatedly.
          aria-hidden={i > 0}
          className={cn("flex shrink-0 justify-around gap-[var(--gap)]", {
            "animate-marquee flex-row": !vertical && !reverse,
            "animate-marquee-reverse flex-row": !vertical && reverse,
            "animate-marquee-vertical flex-col": vertical && !reverse,
            "animate-marquee-vertical-reverse flex-col": vertical && reverse,
            "group-hover:[animation-play-state:paused]": pauseOnHover,
          })}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
