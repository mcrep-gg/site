import Link from "next/link";
import { Suspense } from "react";
import { LuArrowRight, LuFlag } from "react-icons/lu";
import { db } from "@/db";
import { listReports } from "@/server/admin";
import { Empty, ReportCard } from "@/components/admin/ui";
import { getOverview, requireModerator } from "./data";

const PREVIEW_REPORTS = 3;

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  await requireModerator();
  const [stats, open] = await Promise.all([getOverview(), listReports(db, "open", PREVIEW_REPORTS)]);
  const now = new Date();

  const tiles = [
    { label: "Open Reports", value: stats.openReports, href: "/admin/reports", alert: stats.openReports > 0 },
    { label: "Suspended", value: stats.activeSuspensions },
    { label: "Linked Players", value: stats.linkedPlayers, href: "/admin/players" },
    { label: "Given, 24 h", value: stats.given24h, href: "/admin/activity" },
    { label: "Given, 7 days", value: stats.given7d, href: "/admin/activity" },
  ];

  return (
    <>
      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => {
          const body = (
            <>
              <dt className="text-xs font-bold tracking-[0.08em] text-muted uppercase">{t.label}</dt>
              <dd className={`m-0 font-pixel text-4xl leading-none font-bold ${t.alert ? "text-neg" : "text-ink"}`}>
                {t.value.toLocaleString("en-GB")}
              </dd>
            </>
          );
          const box = `flex flex-col gap-3 rounded-md border-2 bg-surface p-4 ${t.alert ? "border-neg-line" : "border-line"}`;
          return t.href ? (
            <Link key={t.label} href={t.href} className={`${box} no-underline hover:border-field-line`}>
              {body}
            </Link>
          ) : (
            <div key={t.label} className={box}>
              {body}
            </div>
          );
        })}
      </dl>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="m-0 text-xl font-bold">Oldest open Reports</h2>
          {stats.openReports > PREVIEW_REPORTS && (
            <Link href="/admin/reports" className="flex items-center gap-1 text-sm font-semibold">
              All {stats.openReports} open Reports <LuArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
        {open.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {open.map((r) => (
              <ReportCard key={r.id} report={r} now={now} />
            ))}
          </div>
        ) : (
          <Empty icon={<LuFlag aria-hidden className="size-5" />} title="No open Reports">
            When Players report a +1 or −1, it shows up here.
          </Empty>
        )}
      </div>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview" className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="h-[94px] rounded-md border-2 border-line bg-surface" />
        ))}
      </div>
      <div className="h-80 rounded-md border-2 border-line bg-surface" />
    </div>
  );
}
