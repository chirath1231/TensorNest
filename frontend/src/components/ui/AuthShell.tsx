"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { LogoMark } from "@/components/ui/Logo";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";

const POINTS = [
  "Jobs keep running after you close the tab",
  "Checkpoints and logs land in object storage",
  "Local CPU or a remote GPU, same script",
];

/** Two-up frame shared by sign-in and register: the pitch on the left, the
 *  form inside a liquid-glass card on the right. Below `lg` the pitch is
 *  dropped rather than stacked — on a phone it would just push the form,
 *  the only thing the page is actually for, below the fold.
 *
 *  It also guards the flow the other way round from AuthGuard: these pages are
 *  for people who are *not* signed in, so someone who still has a session is
 *  sent on to the dashboard instead of being shown a sign-in form they have no
 *  use for. Living here rather than in each page means any future auth screen
 *  inherits it. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      {/* min-w-0 on the grid and its card column: grid and flex items default to
          min-width:auto, which refuses to shrink below the form's intrinsic
          width and pushes the card off the right edge of a narrow phone. */}
      <div className="grid w-full min-w-0 max-w-5xl items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,26rem)]">
        <motion.section
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hidden lg:block"
        >
          {/* The only way back out of the auth flow — without it, someone who
              lands on /login from a bookmark has no route to the marketing
              page at all. */}
          <Link href="/" className="mb-7 flex w-fit items-center gap-3">
            <span className="block h-12 w-12 shrink-0">
              <LogoMark />
            </span>
            <span className="text-xl font-semibold tracking-tight text-slate-100">
              Tensor<span className="text-gradient">Nest</span>
            </span>
          </Link>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-slate-50">
            Training that
            <br />
            <span className="text-gradient">outlives the tab.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
            TensorNest hands your script to a scheduler that owns the run. Close the
            browser, reboot, come back tomorrow — the status, logs and checkpoints
            are waiting.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.09, duration: 0.4 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-cyan-300 to-violet-400" />
                {p}
              </motion.li>
            ))}
          </ul>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full min-w-0 max-w-md"
        >
          <LiquidGlassCard
            borderRadius="26px"
            blurIntensity="xl"
            glowIntensity="md"
            shadowIntensity="sm"
            className="glass glass-raised glass-sheen overflow-hidden"
          >
            <div className="p-6 sm:p-9">
              <div className="mb-7">
                <Link href="/" className="mb-5 flex w-fit items-center gap-2.5 lg:hidden">
                  <span className="block h-10 w-10 shrink-0">
                    <LogoMark />
                  </span>
                  <span className="text-lg font-semibold tracking-tight text-slate-100">
                    Tensor<span className="text-gradient">Nest</span>
                  </span>
                </Link>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
                <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
              </div>
              {children}
            </div>
          </LiquidGlassCard>
        </motion.div>
      </div>
    </main>
  );
}
