"use client";

import type { RefObject } from "react";
import { TimelineAnimation } from "@/components/ui/timeline-animation";

/** Eyebrow / title / description, sharing the caller's timeline ref so the
 *  heading leads the stagger its section's content finishes. */
export function SectionHeading({
  timelineRef,
  eyebrow,
  title,
  description,
  align = "center",
}: {
  timelineRef: RefObject<HTMLElement | null>;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";

  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <TimelineAnimation
        as="p"
        animationNum={0}
        timelineRef={timelineRef}
        className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300/80"
      >
        {eyebrow}
      </TimelineAnimation>
      <TimelineAnimation
        as="h2"
        animationNum={1}
        timelineRef={timelineRef}
        className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl"
      >
        {title}
      </TimelineAnimation>
      {description && (
        <TimelineAnimation
          as="p"
          animationNum={2}
          timelineRef={timelineRef}
          className="mt-4 text-[15px] leading-relaxed text-muted"
        >
          {description}
        </TimelineAnimation>
      )}
    </div>
  );
}
