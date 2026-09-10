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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100">
        <Icon className="h-5 w-5 text-neutral-400" />
      </div>
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-neutral-500">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
