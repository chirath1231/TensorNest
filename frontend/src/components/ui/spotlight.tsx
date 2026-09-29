"use client";

// Adapted from ui-layouts.com/components/spotlight-cards.
//
// Two changes from the published source. It ships under `// @ts-nocheck`, so
// the mouse handlers and context are typed properly here. And the published
// `SpotLightItem` registers its own window-level `mousemove` listener, which
// means a six-card grid installs six listeners that all compute the same
// number — the shared cursor position moves up into the provider instead.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface SpotlightContextValue {
  /** Border lights up as the cursor nears the card, tracked in viewport space. */
  ProximitySpotlight: boolean;
  /** Stronger version of the same, only while the group is hovered. */
  HoverFocusSpotlight: boolean;
  /** Soft wash that follows the cursor across the card it is over. */
  CursorFlowGradient: boolean;
  pointer: { x: number; y: number };
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

export function useSpotlight() {
  const ctx = useContext(SpotlightContext);
  if (!ctx) throw new Error("useSpotlight must be used within a <Spotlight>");
  return ctx;
}

export function Spotlight({
  children,
  className,
  ProximitySpotlight = true,
  HoverFocusSpotlight = false,
  CursorFlowGradient = true,
}: {
  children: ReactNode;
  className?: string;
  ProximitySpotlight?: boolean;
  HoverFocusSpotlight?: boolean;
  CursorFlowGradient?: boolean;
}) {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Only the viewport-space effects need the global cursor; the per-card
    // wash measures against its own box and does not.
    if (!ProximitySpotlight && !HoverFocusSpotlight) return;
    const onMove = (e: globalThis.MouseEvent) =>
      setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [ProximitySpotlight, HoverFocusSpotlight]);

  return (
    <SpotlightContext.Provider
      value={{ ProximitySpotlight, HoverFocusSpotlight, CursorFlowGradient, pointer }}
    >
      <div className={cn("group relative z-10", className)}>{children}</div>
    </SpotlightContext.Provider>
  );
}

export function SpotLightItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ProximitySpotlight, HoverFocusSpotlight, CursorFlowGradient, pointer } =
    useSpotlight();
  const [hovered, setHovered] = useState(false);
  const [local, setLocal] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    setLocal({ x: e.clientX - left, y: e.clientY - top });
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => CursorFlowGradient && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        // The 1px padding is the whole trick: the gradients paint on this
        // element, the child covers all but a hairline of it, and what is left
        // reads as a lit border.
        "relative overflow-hidden rounded-2xl bg-white/[0.07] p-px",
        className
      )}
    >
      {ProximitySpotlight && (
        <div
          aria-hidden
          // A `fixed` attachment anchors the gradient to the viewport rather
          // than to this box, so one continuous pool of light sweeps across
          // every card in the grid at once.
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
          style={{
            background: `radial-gradient(circle at ${pointer.x}px ${pointer.y}px, rgba(255,255,255,0.43) 0%, transparent 17%, transparent) fixed`,
          }}
        />
      )}

      {HoverFocusSpotlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at ${pointer.x}px ${pointer.y}px, rgba(255,255,255,0.46) 0%, transparent 20%, transparent) fixed`,
          }}
        />
      )}

      <div className="relative z-10 h-full rounded-[inherit]">
        {hovered && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] transition duration-300"
            style={{
              background: `radial-gradient(250px circle at ${local.x}px ${local.y}px, rgba(255,255,255,0.13), transparent 80%)`,
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
}
