"use client";

// Adapted from ui-layouts.com/components/liquid-glass.
// Two changes from the published source: it imports from `framer-motion`
// rather than `motion/react` (the package this project already depends on,
// same API), and `backdrop-blur-xs` becomes `backdrop-blur-sm` because that
// tier only exists in Tailwind v4 and this project is on v3.

import { motion } from "framer-motion";
import type React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Intensity = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  draggable?: boolean;
  expandable?: boolean;
  width?: string;
  height?: string;
  expandedWidth?: string;
  expandedHeight?: string;
  blurIntensity?: "sm" | "md" | "lg" | "xl";
  shadowIntensity?: Intensity;
  borderRadius?: string;
  glowIntensity?: Intensity;
}

const blurClasses = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
} as const;

const shadowStyles: Record<Intensity, string> = {
  none: "inset 0 0 0 0 rgba(255,255,255,0)",
  xs: "inset 1px 1px 1px 0 rgba(255,255,255,0.18), inset -1px -1px 1px 0 rgba(255,255,255,0.18)",
  sm: "inset 2px 2px 2px 0 rgba(255,255,255,0.20), inset -2px -2px 2px 0 rgba(255,255,255,0.20)",
  md: "inset 3px 3px 3px 0 rgba(255,255,255,0.24), inset -3px -3px 3px 0 rgba(255,255,255,0.22)",
  lg: "inset 4px 4px 4px 0 rgba(255,255,255,0.28), inset -4px -4px 4px 0 rgba(255,255,255,0.26)",
  xl: "inset 6px 6px 6px 0 rgba(255,255,255,0.32), inset -6px -6px 6px 0 rgba(255,255,255,0.30)",
  "2xl":
    "inset 8px 8px 8px 0 rgba(255,255,255,0.36), inset -8px -8px 8px 0 rgba(255,255,255,0.34)",
};

const glowStyles: Record<Intensity, string> = {
  none: "0 4px 4px rgba(0,0,0,0.05), 0 0 12px rgba(0,0,0,0.05)",
  xs: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 16px rgba(255,255,255,0.05)",
  sm: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 24px rgba(255,255,255,0.10)",
  md: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 32px rgba(255,255,255,0.15)",
  lg: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 40px rgba(255,255,255,0.20)",
  xl: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 48px rgba(255,255,255,0.25)",
  "2xl":
    "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 60px rgba(255,255,255,0.30)",
};

export function LiquidGlassCard({
  children,
  className = "",
  draggable = false,
  expandable = false,
  width,
  height,
  expandedWidth,
  expandedHeight,
  blurIntensity = "xl",
  borderRadius = "28px",
  glowIntensity = "sm",
  shadowIntensity = "md",
  ...props
}: LiquidGlassCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  function handleToggleExpansion(e: React.MouseEvent<HTMLDivElement>) {
    if (!expandable) return;
    // Never swallow a click meant for something the user can actually operate.
    if ((e.target as HTMLElement).closest("a, button, input, select, textarea")) return;
    setIsExpanded((v) => !v);
  }

  const containerVariants = expandable
    ? {
        collapsed: {
          width: width || "auto",
          height: height || "auto",
          transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] as const },
        },
        expanded: {
          width: expandedWidth || "auto",
          height: expandedHeight || "auto",
          transition: { duration: 0.4, ease: [0.5, 1.5, 0.5, 1] as const },
        },
      }
    : undefined;

  const interactive = draggable || expandable;

  return (
    <>
      {/* Displacement filter that gives the blur its liquid, refracted edge.
          Rendered once per card but keyed by a stable id, so duplicates are
          harmless — SVG filter ids resolve to the first match. */}
      <svg className="hidden" aria-hidden="true">
        <defs>
          <filter
            id="glass-blur"
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="objectBoundingBox"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.003 0.007"
              numOctaves="1"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="180"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <motion.div
        className={cn(
          "relative",
          draggable && "cursor-grab active:cursor-grabbing",
          expandable && "cursor-pointer",
          className
        )}
        style={{
          borderRadius,
          ...(width && !expandable ? { width } : {}),
          ...(height && !expandable ? { height } : {}),
        }}
        variants={containerVariants}
        animate={expandable ? (isExpanded ? "expanded" : "collapsed") : undefined}
        onClick={expandable ? handleToggleExpansion : undefined}
        drag={draggable}
        dragConstraints={draggable ? { left: 0, right: 0, top: 0, bottom: 0 } : undefined}
        dragElastic={draggable ? 0.3 : undefined}
        dragTransition={
          draggable ? { bounceStiffness: 300, bounceDamping: 10, power: 0.3 } : undefined
        }
        whileDrag={draggable ? { scale: 1.02 } : undefined}
        whileHover={interactive ? { scale: 1.01 } : undefined}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        {...props}
      >
        {/* Bend: the refracting backdrop */}
        <div
          className={cn("absolute inset-0 z-0", blurClasses[blurIntensity])}
          style={{ borderRadius, filter: "url(#glass-blur)" }}
        />
        {/* Face: outer glow and drop shadow */}
        <div
          className="absolute inset-0 z-10"
          style={{ borderRadius, boxShadow: glowStyles[glowIntensity] }}
        />
        {/* Edge: inner rim highlight */}
        <div
          className="absolute inset-0 z-20"
          style={{ borderRadius, boxShadow: shadowStyles[shadowIntensity] }}
        />
        <div className="relative z-30">{children}</div>
      </motion.div>
    </>
  );
}

export default LiquidGlassCard;
