import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LuBan, LuCrown, LuExternalLink, LuHistory, LuShieldOff, LuInbox, LuSend } from "react-icons/lu";
import { liftSuspensionAction } from "@/app/admin/actions";
import { db } from "@/db";
import { playerDetail, type AdminEntry, type SuspensionRow } from "@/server/admin";
import { ActionButton } from "@/components/admin/action-button";
import { RankForm } from "@/components/admin/rank-form";
import { SuspendForm } from "@/components/admin/suspend-form";
import { Panel, PlayerLink, RemoveButton } from "@/components/admin/ui";
import { CopyButton } from "@/components/sign-in/copy-button";
import { RankBadge } from "@/components/rank-badge";
import { NetReputation, ValueChip } from "@/components/reputation";
import { SkinHead } from "@/components/skin-head";
import { shortDate, shortDateTime, timeAgo } from "@/components/profile/format";
import { canModerate, isStoredRank } from "@/lib/ranks";
import { requireModerator } from "../../data";

export const metadata: Metadata = { title: "Player" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Params = Promise<{ uuid: string }>;

export default function AdminPlayerPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Loading Player" className="h-[480px] rounded-md border-2 border-line bg-surface" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Params }) {
  const viewer = await requireModerator();
  const uuid = (await params).uuid.toLowerCase();
  if (!UUID_RE.test(uuid)) notFound();
  const now = new Date();
  const detail = await playerDetail(db, uuid, now);
  if (!detail) notFound();

  const { player, totals, received, given, suspensions } = detail;
  const active = suspensions.find((s) => s.active);

  return (
    <>
      <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-md border-2 border-line bg-surface p-5 sm:p-6">
        <SkinHead uuid={player.uuid} username={player.username} size={64} />
        <div className="flex min-w-0 flex-1 basis-[240px] flex-col gap-1.5">
          <h2 className="m-0 flex flex-wrap items-center gap-2 font-mono text-2xl font-bold [overflow-wrap:anywhere]">
            {player.username}
            <RankBadge rank={player.rank} />
            {active && (
              <span className="inline-flex h-6 items-center gap-1 rounded-[3px] border border-neg-line bg-neg-bg px-2 font-sans text-xs font-bold text-neg">
                <LuBan aria-hidden className="size-3" />
                Suspended
              </span>
            )}
          </h2>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-mono text-[13px] text-ink-2">{player.uuid}</span>
            <CopyButton text={player.uuid} label="Copy UUID" />
          </div>
          <span className="text-[13px] text-muted">{player.linkedAt ? `Linked Player since ${shortDate(player.linkedAt)}` : "Never linked"}</span>
        </div>
        <div className="flex flex-col items-start gap-2.5">
          <NetReputation positive={totals.positive} negative={totals.negative} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
            <Link href={`/player/${encodeURIComponent(player.username)}`} className="flex items-center gap-1">
              Public profile <LuExternalLink aria-hidden className="size-3.5" />
            </Link>
            <Link href={`/admin/activity?player=${player.uuid}`} className="flex items-center gap-1">
              Activity <LuHistory aria-hidden className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <Panel title={<><LuBan aria-hidden className="size-[18px] text-accent" /> Suspension</>}>
        {active ? (
          <ActiveSuspension suspension={active} />
        ) : player.uuid === viewer.uuid ? (
          <p className="m-0 text-sm text-muted">You can&apos;t suspend yourself.</p>
        ) : canModerate(player.rank) ? (
          <p className="m-0 text-sm text-muted">
            {player.rank === "admin"
              ? "Admins can't be suspended."
              : `Staff can't be suspended. An Admin has to take away ${player.username}'s Staff rank first.`}
          </p>
        ) : (
          <>
            <p className="m-0 text-sm leading-normal text-ink-2">
              A suspended Player can&apos;t give, change or remove Reputation. Everything they already gave stays up.
            </p>
            <SuspendForm playerUuid={player.uuid} username={player.username} />
          </>
        )}
        {suspensions.some((s) => !s.active) && <SuspensionHistory suspensions={suspensions.filter((s) => !s.active)} now={now} />}
      </Panel>

      {viewer.rank === "admin" && (
        <Panel title={<><LuCrown aria-hidden className="size-[18px] text-accent" /> Rank</>}>
          {player.rank === "admin" ? (
            <p className="m-0 text-sm leading-normal text-ink-2">
              {player.username} is an Admin. Admins are listed in ADMIN_UUIDS, so this can&apos;t be changed from the site.
            </p>
          ) : (
            <RankForm playerUuid={player.uuid} username={player.username} rank={isStoredRank(player.rank) ? player.rank : null} />
          )}
        </Panel>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <EntryList
          title={<><LuInbox aria-hidden className="size-[18px] text-accent" /> Received ({received.length})</>}
          entries={received}
          side="received"
          now={now}
        />
        <EntryList
          title={<><LuSend aria-hidden className="size-[18px] text-accent" /> Given ({given.length})</>}
          entries={given}
          side="given"
          now={now}
        />
      </div>
    </>
  );
}

function ActiveSuspension({ suspension: s }: { suspension: SuspensionRow }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded border-2 border-neg-line bg-neg-bg p-4">
      <div className="flex min-w-0 flex-1 basis-[260px] flex-col gap-1.5 text-sm leading-normal">
        <strong className="text-[#ffd9d9]">{s.until ? `Suspended until ${shortDateTime(s.until)}` : "Suspended until Staff lift it"}</strong>
        <span className="[overflow-wrap:anywhere] text-[#f2c4c4]">{s.reason}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-[#f2c4c4]/80">
          <span>{shortDate(s.createdAt)}</span>
          {s.createdBy && (
            <>
              by <PlayerLink player={s.createdBy} size={16} />
            </>
          )}
        </span>
      </div>
      <ActionButton
        action={liftSuspensionAction.bind(null, s.id)}
        icon={<LuShieldOff aria-hidden className="size-4" />}
        label="Lift Suspension"
        confirm="Lift it now?"
      />
    </div>
  );
}

function SuspensionHistory({ suspensions, now }: { suspensions: SuspensionRow[]; now: Date }) {
  return (
    <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
      <h4 className="m-0 text-xs font-bold tracking-[0.08em] text-muted uppercase">Past Suspensions</h4>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {suspensions.map((s) => (
          <li key={s.id} className="flex flex-col gap-1 text-sm leading-normal">
            <span className="[overflow-wrap:anywhere] text-ink-2">{s.reason}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
              <span>{shortDate(s.createdAt)}</span>
              {s.createdBy && (
                <>
                  by <PlayerLink player={s.createdBy} size={16} />
                </>
              )}
              <span aria-hidden>·</span>
              {s.liftedAt ? (
                <>
                  <span>lifted {timeAgo(s.liftedAt, now)}</span>
                  {s.liftedBy && (
                    <>
                      by <PlayerLink player={s.liftedBy} size={16} />
                    </>
                  )}
                </>
              ) : (
                `ran out ${shortDate(s.until!)}`
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntryList({ title, entries, side, now }: { title: React.ReactNode; entries: AdminEntry[]; side: "received" | "given"; now: Date }) {
  return (
    <Panel title={title}>
      {entries.length ? (
        <ul className="m-0 flex list-none flex-col divide-y-2 divide-line p-0">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 basis-[220px] flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <ValueChip value={e.value} />
                  <span className="text-[13px] text-muted">{side === "received" ? "from" : "to"}</span>
                  <PlayerLink player={e.other} />
                  <time dateTime={e.createdAt.toISOString()} title={shortDateTime(e.createdAt)} className="text-[13px] text-muted">
                    {timeAgo(e.createdAt, now)}
                  </time>
                </div>
                {e.reason && <p className="m-0 text-sm leading-normal [overflow-wrap:anywhere] whitespace-pre-line text-ink-2">{e.reason}</p>}
                {e.openReports > 0 && (
                  <Link href="/admin/reports" className="self-start text-[13px] font-semibold text-neg hover:text-neg">
                    {e.openReports} open {e.openReports === 1 ? "Report" : "Reports"}
                  </Link>
                )}
              </div>
              <RemoveButton reputationId={e.id} value={e.value} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted">{side === "received" ? "Nobody has given them Reputation." : "They haven't given anyone Reputation."}</p>
      )}
    </Panel>
  );
}
