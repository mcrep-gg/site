"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuFlag, LuHistory, LuLayoutDashboard, LuUsers } from "react-icons/lu";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LuLayoutDashboard },
  { href: "/admin/reports", label: "Reports", icon: LuFlag },
  { href: "/admin/players", label: "Players", icon: LuUsers },
  { href: "/admin/activity", label: "Activity", icon: LuHistory },
] as const;

export function AdminNav({ openReports }: { openReports: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto rounded-md border-2 border-line bg-surface p-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const on = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex h-11 min-w-fit flex-1 items-center justify-center gap-2 rounded px-3 text-sm font-bold no-underline ${
              on ? "bg-ink text-page hover:text-page" : "text-ink-2 hover:text-ink"
            }`}
          >
            <Icon aria-hidden className="size-4 shrink-0 max-sm:hidden" />
            {label}
            {href === "/admin/reports" && openReports > 0 && (
              <span
                aria-label={`${openReports} open`}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-[3px] bg-neg px-1 font-mono text-xs font-bold text-neg-ink"
              >
                {openReports > 99 ? "99+" : openReports}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
