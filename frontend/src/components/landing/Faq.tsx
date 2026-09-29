"use client";

import { useRef } from "react";
import {
  Accordion,
  AccordionContainer,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
} from "@/components/ui/accordion";
import { TimelineAnimation } from "@/components/ui/timeline-animation";
import { SectionHeading } from "./SectionHeading";

const QUESTIONS = [
  {
    value: "tab",
    q: "What actually happens when I close the tab?",
    a: "Nothing. Submitting a job hands it to a provider — a Docker container locally, or a Modal sandbox remotely — and the backend keeps only its id. No process of ours is holding the run open, so there is nothing for a closed browser to interrupt.",
  },
  {
    value: "worker",
    q: "What if your worker crashes mid-run?",
    a: "The worker is the least durable part of the system and the design assumes it will die. A reconciler sweeps every minute, and once at startup, asking each provider what actually happened to jobs still marked running, then persists their logs and checkpoints. A restarted worker reattaches to the existing run rather than starting a second one.",
  },
  {
    value: "gpu",
    q: "Do I need a GPU account to try it?",
    a: "No. The local Docker CPU provider is free and needs nothing beyond Docker Desktop. Register, open Jobs, leave Local CPU selected and submit the sample script — it goes queued → running → succeeded in about ten seconds, with logs and five checkpoints.",
  },
  {
    value: "notebooks",
    q: "Are notebooks detached too?",
    a: "No, and that is deliberate. Notebooks are for interactive work, so they are session-bound: close the tab and the kernel container is reaped after thirty minutes idle. When a piece of work needs to outlive the session, export it or submit it as a job — that is the thing jobs are for.",
  },
  {
    value: "data",
    q: "Where does my data live?",
    a: "In an S3-compatible bucket you control — Cloudflare R2 in the deployed setup, MinIO locally, same API either way. Uploads stream straight through without being buffered in memory, and downloads come back as short-lived presigned URLs issued directly by storage.",
  },
  {
    value: "ready",
    q: "Is this production-ready?",
    a: "It is an early research prototype. The core loop works end to end and has been verified on a real Tesla T4, but read the known limitations in the README before you rely on it for anything that matters.",
  },
];

export function Faq() {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <section id="faq" ref={sectionRef} className="scroll-mt-24 px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          timelineRef={sectionRef}
          eyebrow="FAQ"
          title="The questions that actually get asked"
        />

        <TimelineAnimation
          as="div"
          animationNum={2}
          timelineRef={sectionRef}
          className="mt-12"
        >
          <AccordionContainer>
            <Accordion defaultValue="tab">
              {QUESTIONS.map(({ value, q, a }) => (
                <AccordionItem key={value} value={value}>
                  <AccordionHeader>{q}</AccordionHeader>
                  <AccordionPanel>
                    <p>{a}</p>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </AccordionContainer>
        </TimelineAnimation>
      </div>
    </section>
  );
}
