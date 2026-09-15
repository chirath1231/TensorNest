"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { scorePassword } from "@/lib/validation";
import { cn } from "@/lib/utils";

// Four segments, one per score level. Colour is never the only signal — the
// label spells out "Weak"/"Fair"/"Good"/"Strong" for anyone who cannot
// distinguish the hues.
const BAR = ["bg-white/10", "bg-rose-400", "bg-amber-400", "bg-cyan-400", "bg-emerald-400"];
const TEXT = ["text-muted", "text-rose-300", "text-amber-300", "text-cyan-300", "text-emerald-300"];

export function PasswordStrength({ password }: { password: string }) {
  const { score, label, advice, checks } = scorePassword(password);

  return (
    <AnimatePresence initial={false}>
      {password.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="pt-2.5">
            <div className="flex items-center gap-2">
              <div
                className="flex flex-1 gap-1"
                role="meter"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={4}
                aria-label="Password strength"
                aria-valuetext={label || "Too short"}
              >
                {[1, 2, 3, 4].map((seg) => (
                  <span key={seg} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.span
                      className={cn("block h-full rounded-full", BAR[score])}
                      initial={false}
                      animate={{ scaleX: seg <= score ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    />
                  </span>
                ))}
              </div>
              <span className={cn("w-16 shrink-0 text-right text-xs font-medium", TEXT[score])}>
                {label}
              </span>
            </div>

            <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    c.met ? "text-emerald-300" : "text-slate-500"
                  )}
                >
                  {c.met ? (
                    <Check className="h-3 w-3 shrink-0" />
                  ) : (
                    <X className="h-3 w-3 shrink-0" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>

            {advice && <p className="mt-2 text-xs text-muted">{advice}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
