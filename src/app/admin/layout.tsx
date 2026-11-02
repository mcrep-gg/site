import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { LuShieldCheck } from "react-icons/lu";
import { AdminNav } from "@/components/admin/admin-nav";
import { RankBadge } from "@/components/rank-badge";
import { getOverview, requireModerator } from "./data";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | mcrep.gg" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto box-border flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 sm:pt-10 sm:pb-20">
      <Suspense fallback={<ShellSkeleton />}>
        <Shell>{children}</Shell>
      </Suspense>
    </main>
  );
}

/**
 * Anyone who isn't an Admin or Staff gets a 404, so the dashboard doesn't advertise itself.
 * Pages and Server Actions still check for themselves: this only keeps the nav from showing.
 */
async function Shell({ children }: { children: ReactNode }) {
  const viewer = await requireModerator();
  const { openReports } = await getOverview();
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h1 className="m-0 font-pixel text-[32px] leading-[1.05] font-bold sm:text-[44px]">Admin</h1>
        <p className="m-0 flex items-center gap-1.5 text-[13px] text-muted">
          <LuShieldCheck aria-hidden className="size-4 text-accent" />
          Signed in as <span className="font-mono font-bold text-ink-2">{viewer.username}</span>
          <RankBadge rank={viewer.rank} size="sm" />
        </p>
      </div>
      <AdminNav openReports={openReports} isAdmin={viewer.rank === "admin"} />
      <div className="flex flex-col gap-6">{children}</div>
    </>
  );
}

function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6">
      <div className="h-11 w-40 rounded bg-surface sm:h-[46px]" />
      <div className="h-[52px] rounded-md border-2 border-line bg-surface" />
      <div className="h-64 rounded-md border-2 border-line bg-surface" />
    </div>
  );
}
