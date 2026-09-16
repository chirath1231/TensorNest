"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, Check } from "lucide-react";
import { TimelineAnimation } from "@/components/ui/timeline-animation";
import { SectionHeading } from "./SectionHeading";
import { cn } from "@/lib/utils";

interface Tier {
  name: string;
  meta: string;
  price: string;
  priceNote: string;
  points: string[];
  cta: string;
  href: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Local CPU",
    meta: "Docker, on your own machine",
    price: "Free",
    priceNote: "no account needed beyond sign-up",
    points: [
      "Same ComputeProvider interface as the GPUs",
      "Logs and checkpoints to MinIO or R2",
      "Ideal for proving a script out before it costs anything",
    ],
    cta: "Start here",
    href: "/register",
  },
  {
    name: "Modal GPU",
    meta: "Tesla T4 · A10G · A100 · H100",
    price: "Your Modal bill",
    priceNote: "usage bills against your own token",
    points: [
      "Bring your own Modal token — we never resell compute",
      "Sandboxes own the run; a worker restart reattaches",
      "Set MODAL_GPU and the job form offers the tier",
    ],
    cta: "Read the setup",
    href: "https://github.com/chirath1231/TensorNest#enabling-gpu-jobs-modal",
    featured: true,
  },
  {
    name: "Self-hosted",
    meta: "Docker Compose, your infrastructure",
    price: "Open source",
    priceNote: "clone it and run the stack",
    points: [
      "Postgres, Redis, MinIO and the worker in one compose file",
      "Swap in Cloudflare R2 by pointing S3_* at your bucket",
      "Add a provider by implementing one interface",
    ],
    cta: "View the repo",
    href: "https://github.com/chirath1231/TensorNest",
  },
];

export function ComputeTiers() {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <section id="compute" ref={sectionRef} className="scroll-mt-24 px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          timelineRef={sectionRef}
          eyebrow="Compute"
          title="Pay the GPU, not the middleman"
          description="TensorNest schedules work onto compute you already own or already pay for. There is no markup here because there is no resale here."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <TimelineAnimation
              key={tier.name}
              as="div"
              animationNum={i + 2}
              timelineRef={sectionRef}
              className="h-full"
            >
              <div
                className={cn(
                  "flex h-full flex-col rounded-2xl p-7",
                  // The animated conic border marks the one tier that actually
                  // reaches a GPU, so the eye lands there without a louder fill.
                  tier.featured
                    ? "gradient-border"
                    : "border border-white/10 bg-white/[0.035]"
                )}
              >
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-50">
                  {tier.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{tier.meta}</p>

                <p className="mt-6 text-3xl font-semibold tracking-tight text-slate-50">
                  {tier.price}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">{tier.priceNote}</p>

                <ul className="mt-7 flex-1 space-y-3">
                  {tier.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      {p}
                    </li>
                  ))}
                </ul>

                {tier.href.startsWith("/") ? (
                  <Link
                    href={tier.href}
                    className={cn("mt-8", tier.featured ? "btn-accent" : "btn-ghost border border-white/12")}
                  >
                    {tier.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <a
                    href={tier.href}
                    target="_blank"
                    rel="noreferrer"
                    className={cn("mt-8", tier.featured ? "btn-accent" : "btn-ghost border border-white/12")}
                  >
                    {tier.cta}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </TimelineAnimation>
          ))}
        </div>

        <TimelineAnimation
          as="p"
          animationNum={5}
          timelineRef={sectionRef}
          className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-slate-500"
        >
          A new Modal account starts with $1 of credit and unlocks the full monthly
          allowance once a payment method is added. $1 is roughly 1.7 hours of T4
          time — enough to verify the integration, not to train a real model.
        </TimelineAnimation>
      </div>
    </section>
  );
}
