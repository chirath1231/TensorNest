"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, LayoutGrid, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Wordmark } from "@/components/ui/Logo";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ProfileMenu } from "@/components/ProfileMenu";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Notebooks", icon: LayoutGrid },
  { href: "/jobs", label: "Jobs", icon: Play },
  { href: "/datasets", label: "Datasets", icon: Database },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgb(6_8_20_/_0.62)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-7">
          <Link href="/dashboard" className="shrink-0">
            <Wordmark className="hidden sm:flex" />
            <span className="flex h-7 w-7 sm:hidden">
              <Wordmark className="[&>span:last-child]:hidden" />
            </span>
          </Link>

          <div className="flex items-center gap-0.5">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "text-slate-50" : "text-slate-400 hover:text-slate-100"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 -z-10 rounded-lg border border-white/10 bg-white/10"
                      transition={{ type: "spring", stiffness: 480, damping: 36 }}
                    />
                  )}
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NotificationCenter />
          <ProfileMenu />
        </div>
      </nav>
    </header>
  );
}
