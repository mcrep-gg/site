import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LuFlag } from "react-icons/lu";
import { db } from "@/db";
import { listReports } from "@/server/admin";
import { Empty, PageTitle, ReportCard } from "@/components/admin/ui";
import { requireAdmin } from "../data";

export const metadata: Metadata = { title: "Reports" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageTitle title="Reports">
        Removing a +1 or −1 deletes it and its Reply, and can&apos;t be undone. Either decision closes every open Report on the same +1 or −1.
      </PageTitle>
      <Suspense fallback={<div aria-busy="true" aria-label="Loading Reports" className="h-96 rounded-md border-2 border-line bg-surface" />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Reports({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const status = (await searchParams).status === "resolved" ? "resolved" : "open";
  const reports = await listReports(db, status);
  const now = new Date();

  return (
    <>
      <div role="group" aria-label="Show" className="flex gap-1 self-start rounded-md border-2 border-line bg-surface p-1">
        {(["open", "resolved"] as const).map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/reports" : "/admin/reports?status=resolved"}
            aria-current={status === s ? "page" : undefined}
            className={`flex h-9 items-center rounded px-3.5 text-sm font-bold no-underline ${
              status === s ? "bg-ink text-page hover:text-page" : "text-ink-2 hover:text-ink"
            }`}
          >
            {s === "open" ? "Open" : "Resolved"}
          </Link>
        ))}
      </div>
      {reports.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} now={now} />
          ))}
        </div>
      ) : (
        <Empty icon={<LuFlag aria-hidden className="size-5" />} title={status === "open" ? "No open Reports" : "Nothing resolved yet"}>
          {status === "open" ? "You're all caught up." : "Reports you dismiss or act on are kept here."}
        </Empty>
      )}
    </>
  );
}
