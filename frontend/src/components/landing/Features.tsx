"use client";

import { useRef } from "react";
import {
  Boxes,
  Cloud,
  Database,
  HeartPulse,
  NotebookPen,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { Spotlight, SpotLightItem } from "@/components/ui/spotlight";
import { TimelineAnimation } from "@/components/ui/timeline-animation";
import { SectionHeading } from "./SectionHeading";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: Unplug,
    title: "Detached by construction",
    body: "Once a job is submitted the backend keeps only a handle — a container id or a Modal sandbox id. The run is not attached to any process of ours, and nothing about it depends on your browser staying open.",
  },
  {
    icon: Boxes,
    title: "One script, any backend",
    body: "Every compute backend implements the same ComputeProvider interface. Prove a script out on local Docker CPU for free, then submit the identical file to a remote GPU by changing one dropdown.",
  },
  {
    icon: Database,
    title: "Everything in object storage",
    body: "A remote GPU cannot read your disk, so datasets, exported notebooks, logs and checkpoints all live in an S3-compatible bucket keyed per job. Downloads come back as short-lived presigned URLs.",
  },
  {
    icon: HeartPulse,
    title: "Tracking can die, results cannot",
    body: "A reconciler sweeps every minute and once at startup, asking each provider what actually happened to jobs still marked running. A worker restart reattaches to the existing run instead of starting a second one.",
  },
  {
    icon: NotebookPen,
    title: "Notebooks for the interactive half",
    body: "Python with PyTorch, NumPy, pandas, scikit-learn and matplotlib in a per-notebook kernel container. Session-bound on purpose — when the work needs to outlive the session, submit it as a job.",
  },
  {
    icon: Cloud,
    title: "Datasets straight off the web",
    body: "Search Hugging Face or paste a link to any CSV, Parquet or JSON file, and it streams into your bucket in the background. Each import records its source, original URL and licence on the row.",
  },
];

export function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <section id="features" ref={sectionRef} className="scroll-mt-24 px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          timelineRef={sectionRef}
          eyebrow="Why it is different"
          title="Built around the run, not the session"
          description="Every piece of this exists for one reason: a training job is longer-lived than the thing that started it."
        />

        <Spotlight
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          ProximitySpotlight
          CursorFlowGradient
        >
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <TimelineAnimation
              key={title}
              as="div"
              animationNum={i + 2}
              timelineRef={sectionRef}
              className="h-full"
            >
              <SpotLightItem className="h-full">
                <div className="flex h-full flex-col rounded-[inherit] bg-[rgb(9_12_26_/_0.86)] p-6">
                  <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                    <Icon className="h-[18px] w-[18px] text-cyan-300" />
                  </span>
                  <h3 className="text-[15px] font-semibold tracking-tight text-slate-50">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </SpotLightItem>
            </TimelineAnimation>
          ))}
        </Spotlight>
      </div>
    </section>
  );
}
