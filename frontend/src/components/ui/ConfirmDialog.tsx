"use client";

import { AnimatePresence, motion } from "framer-motion";

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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="w-full max-w-sm rounded-lg border border-[#f2bc33] bg-white p-5 shadow-lg dark:bg-neutral-900"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-[#e6c163] dark:text-[#e6c163]">{title}</h2>
            {description && <p className="mt-1.5 text-sm text-[#e6c163]">{description}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded-md border border-[#f2bc33] px-3 py-1.5 text-sm text-[#e6c163] transition hover:bg-neutral-50 dark:text-[#e6c163] dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`rounded-md px-3 py-1.5 text-sm font-medium text-white transition ${
                  danger ? "bg-red-600 hover:bg-red-700" : "bg-cyan-600 hover:bg-cyan-700"
                }`}
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
