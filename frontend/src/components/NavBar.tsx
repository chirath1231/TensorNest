"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const links = [
  { href: "/dashboard", label: "Notebooks" },
  { href: "/jobs", label: "Jobs" },
  { href: "/datasets", label: "Datasets" },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold tracking-tight">TensorNest</span>
        <div className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${
                pathname?.startsWith(link.href)
                  ? "text-neutral-900 font-medium"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-neutral-500">{user?.email}</span>
        <button onClick={logout} className="text-sm text-neutral-500 hover:text-neutral-900">
          Sign out
        </button>
      </div>
    </nav>
  );
}
