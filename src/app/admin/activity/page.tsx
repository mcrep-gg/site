import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LuArrowRight, LuChevronRight, LuHistory, LuX } from "react-icons/lu";
import { db } from "@/db";
import { getPlayer } from "@/server/players";
import { activity, EVENT_ACTIONS, type EventAction } from "@/server/admin";
import { Empty, PageTitle, PlayerLink } from "@/components/admin/ui";
import { ValueChip } from "@/components/reputation";
import { shortDateTime } from "@/components/profile/format";
import { requireModerator } from "../data";

export const metadata: Metadata = { title: "Activity" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ACTION_LABELS: Record<EventAction, string> = {
  give: "Gave",
  change: "Changed",
  remove: "Took back",
  admin_remove: "Removed by Staff",
};

const actionStyle: Record<EventAction, string> = {
  give: "text-ink-2",
  change: "text-ink-2",
  remove: "text-muted",
  admin_remove: "text-neg",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageTitle title="Activity">Every give, change and removal, newest first. Times are UTC.</PageTitle>
      <Suspense fallback={<div aria-busy="true" aria-label="Loading activity" className="h-96 rounded-md border-2 border-line bg-surface" />}>
        <Log searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Log({ searchParams }: { searchParams: SearchParams }) {
  await requireModerator();
  const sp = await searchParams;
  const playerParam = one(sp.player)?.toLowerCase();
  const playerUuid = playerParam && UUID_RE.test(playerParam) ? playerParam : undefined;
  const actionParam = one(sp.action);
  const action = EVENT_ACTIONS.find((a) => a === actionParam);
  const beforeParam = Number(one(sp.before));
  const before = Number.isSafeInteger(beforeParam) && beforeParam > 0 ? beforeParam : undefined;

  const [{ rows, nextBefore }, player] = await Promise.all([
    activity(db, { playerUuid, action, before }),
    playerUuid ? getPlayer(db, playerUuid) : null,
  ]);

  const href = (next: { player?: string; action?: EventAction; before?: number }) => {
    const params = new URLSearchParams();
    if (next.player) params.set("player", next.player);
    if (next.action) params.set("action", next.action);
    if (next.before) params.set("before", String(next.before));
    const qs = params.toString();
    return qs ? `/admin/activity?${qs}` : "/admin/activity";
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by action" className="flex flex-wrap gap-1 rounded-md border-2 border-line bg-surface p-1">
          {[undefined, ...EVENT_ACTIONS].map((a) => (
            <Link
              key={a ?? "all"}
              href={href({ player: playerUuid, action: a })}
              aria-current={action === a ? "page" : undefined}
              className={`flex h-9 items-center rounded px-3 text-sm font-bold no-underline ${
                action === a ? "bg-ink text-page hover:text-page" : "text-ink-2 hover:text-ink"
              }`}
            >
              {a ? ACTION_LABELS[a] : "All"}
            </Link>
          ))}
        </div>
        {playerUuid && (
          <span className="flex h-11 items-center gap-2 rounded-md border-2 border-accent-line bg-accent-bg py-0 pr-1 pl-3 text-sm text-accent-soft">
            Involving
            {player ? <PlayerLink player={player} /> : <span className="font-mono text-xs">{playerUuid}</span>}
            <Link
              href={href({ action })}
              aria-label="Show everyone"
              className="flex size-8 items-center justify-center rounded text-accent-dim no-underline hover:bg-accent-deep hover:text-ink"
            >
              <LuX aria-hidden className="size-4" />
            </Link>
          </span>
        )}
      </div>

      {rows.length ? (
        <ol className="m-0 flex list-none flex-col divide-y-2 divide-line overflow-hidden rounded-md border-2 border-line bg-surface p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
              <time dateTime={r.at.toISOString()} className="shrink-0 font-mono text-xs leading-6 text-muted sm:w-[172px]">
                {shortDateTime(r.at)}
              </time>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-sm font-bold ${actionStyle[r.action]}`}>{ACTION_LABELS[r.action]}</span>
                  <ValueChip value={r.value} />
                  <PlayerLink player={r.giver} />
                  <LuArrowRight aria-label="to" className="size-3.5 shrink-0 text-muted" />
                  <PlayerLink player={r.receiver} />
                  {r.admin && (
                    <span className="flex items-center gap-1.5 text-[13px] text-muted">
                      by <PlayerLink player={r.admin} size={16} />
                    </span>
                  )}
                </div>
                {r.reason && <p className="m-0 text-sm leading-normal [overflow-wrap:anywhere] whitespace-pre-line text-ink-2">{r.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty icon={<LuHistory aria-hidden className="size-5" />} title={before ? "No older activity" : "No activity yet"} />
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
        {before && <Link href={href({ player: playerUuid, action })}>Back to newest</Link>}
        {nextBefore && (
          <Link href={href({ player: playerUuid, action, before: nextBefore })} className="flex items-center gap-1">
            Older <LuChevronRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </>
  );
}
