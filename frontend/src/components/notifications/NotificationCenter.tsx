"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, CircleCheck, CircleX, MailWarning, Play } from "lucide-react";
import { toast } from "sonner";
import { notificationsApi } from "@/lib/resources";
import type { AppNotification, NotificationEvent, NotificationList } from "@/lib/types";
import { cn } from "@/lib/utils";

// Job outcomes arrive from a worker, not from anything this tab did, so the
// only way to see them is to ask. Twenty seconds is frequent enough that a
// finished run feels immediate without making an idle tab chatty.
const POLL_INTERVAL_MS = 20_000;

const eventStyles: Record<NotificationEvent, { icon: typeof Play; className: string }> = {
  job_started: { icon: Play, className: "border-cyan-400/30 bg-cyan-400/15 text-cyan-200" },
  job_succeeded: {
    icon: CircleCheck,
    className: "border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
  },
  job_failed: { icon: CircleX, className: "border-rose-400/30 bg-rose-500/15 text-rose-200" },
};

function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationList | null>(null);
  const [testing, setTesting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await notificationsApi.list());
    } catch {
      // A failed poll is not worth a toast — the next one in 20s may well work,
      // and a backend restart would otherwise bury the screen in errors.
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unread_count ?? 0;

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  }

  async function handleSelect(notification: AppNotification) {
    setOpen(false);
    if (!notification.read_at) {
      try {
        await notificationsApi.markRead(notification.id);
        await refresh();
      } catch {
        // Navigation matters more than the read receipt.
      }
    }
    if (notification.job_id) router.push(`/jobs/${notification.job_id}`);
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark all as read");
    }
  }

  async function handleTestEmail() {
    setTesting(true);
    try {
      const { sent_to } = await notificationsApi.sendTestEmail();
      toast.success(`Test email sent to ${sent_to}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send test email");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={handleOpen}
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className={cn(
          "btn-ghost relative px-2.5",
          open && "bg-white/10 text-slate-50"
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full
                       bg-gradient-to-br from-cyan-400 to-violet-500 px-1 text-[10px]
                       font-semibold text-slate-950"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            /* The bell sits well short of the right edge on a phone, so
               anchoring 22rem of card to it hangs the panel off the left of
               the screen. Below sm it spans the viewport instead. */
            className="glass glass-raised glass-sheen fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl
                       bg-[rgb(9_12_28_/_0.94)]
                       sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-50">Notifications</h2>
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 text-xs text-muted transition hover:text-slate-100"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[22rem] overflow-y-auto">
              {data === null ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
              ) : data.items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-2 h-5 w-5 text-slate-600" />
                  <p className="text-sm text-muted">No notifications yet.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Start a training job and its progress shows up here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.07]">
                  {data.items.map((notification) => {
                    const style = eventStyles[notification.event] ?? eventStyles.job_started;
                    const Icon = style.icon;
                    return (
                      <li key={notification.id}>
                        <button
                          onClick={() => handleSelect(notification)}
                          className={cn(
                            "flex w-full gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]",
                            !notification.read_at && "bg-white/[0.035]"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                              style.className
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-100">
                                {notification.title}
                              </span>
                              {!notification.read_at && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                              )}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted">
                              {notification.body}
                            </span>
                            <span className="mt-1 block text-[11px] text-slate-500">
                              {timeAgo(notification.created_at)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-white/10 px-4 py-3">
              {data?.email_enabled ? (
                <button
                  onClick={handleTestEmail}
                  disabled={testing}
                  className="text-xs text-muted transition hover:text-slate-100 disabled:opacity-50"
                >
                  {testing ? "Sending…" : "Send a test email"}
                </button>
              ) : (
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
                  <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Email alerts are off. Set the SMTP_* values in .env to get job
                  results by email.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
