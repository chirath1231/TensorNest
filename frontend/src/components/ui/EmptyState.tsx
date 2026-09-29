"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-16 text-center"
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/15 to-violet-500/15">
        <Icon className="h-5 w-5 text-cyan-200" />
      </div>
      <p className="text-sm font-medium text-slate-100">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-accent mt-5">
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
