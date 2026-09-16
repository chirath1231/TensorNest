"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus lands on the confirm button — a destructive
  // prompt the keyboard cannot dismiss is worse than no prompt at all.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="glass glass-raised glass-sheen relative w-full max-w-sm rounded-2xl p-6"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "mb-4 grid h-11 w-11 place-items-center rounded-xl border",
                danger
                  ? "border-rose-400/30 bg-rose-500/15 text-rose-200"
                  : "border-cyan-400/30 bg-cyan-400/15 text-cyan-200"
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 id="confirm-title" className="text-base font-semibold text-slate-50">
              {title}
            </h2>
            {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded-xl border border-white/12 px-3.5 py-2 text-sm text-slate-300 transition hover:bg-white/8 hover:text-slate-50"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-sm font-medium transition",
                  danger
                    ? "bg-rose-500 text-white hover:bg-rose-400"
                    : "btn-accent"
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
