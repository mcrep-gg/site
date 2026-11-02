import Link from "next/link";
import type { ReactNode } from "react";
import { LuArrowRight, LuCheck, LuTrash2, LuTriangleAlert } from "react-icons/lu";
import { removeReputationAction, resolveReportAction } from "@/app/admin/actions";
import { REPORT_CATEGORIES, isReportCategory } from "@/lib/rules";
import type { PlayerRef, ReportRow } from "@/server/admin";
import { ValueChip } from "@/components/reputation";
import { SkinHead } from "@/components/skin-head";
import { shortDateTime, timeAgo } from "@/components/profile/format";
import { ActionButton } from "./action-button";

export const adminPlayerPath = (uuid: string) => `/admin/players/${uuid}`;

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="m-0 text-2xl font-bold">{title}</h2>
      {children && <p className="m-0 max-w-[640px] text-sm leading-normal text-ink-2">{children}</p>}
    </div>
  );
}

export function Panel({ title, action, children }: { title?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-md border-2 border-line bg-surface p-5 sm:p-6">
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {title && <h3 className="m-0 flex items-center gap-2 text-base font-bold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A Player's head and name, linking to their Admin page. */
export function PlayerLink({ player, size = 20 }: { player: PlayerRef; size?: number }) {
  return (
    <Link
      href={adminPlayerPath(player.uuid)}
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle font-mono text-sm font-bold text-ink no-underline hover:text-accent-hover"
    >
      <SkinHead uuid={player.uuid} username={player.username} size={size} />
      <span className="truncate">{player.username}</span>
    </Link>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-4 rounded-md border-2 border-line bg-surface p-5">
      <div className="flex size-11 shrink-0 items-center justify-center rounded bg-accent-bg text-accent">{icon}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="m-0 text-base font-bold">{title}</h3>
        {children && <p className="m-0 text-sm leading-normal text-ink-2">{children}</p>}
      </div>
    </div>
  );
}

/** One +1/−1 as the giver left it: "Alex → Steve" and the reason. */
export function Copy({ value, giver, receiver, reason }: { value: 1 | -1; giver: PlayerRef; receiver: PlayerRef; reason: string | null }) {
  return (
    <div className="flex flex-col gap-2 rounded border-2 border-line-strong bg-page p-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <ValueChip value={value} />
        <PlayerLink player={giver} />
        <LuArrowRight aria-label="gave" className="size-3.5 shrink-0 text-muted" />
        <PlayerLink player={receiver} />
      </div>
      {reason ? (
        <p className="m-0 text-sm leading-normal [overflow-wrap:anywhere] whitespace-pre-line text-ink-2">{reason}</p>
      ) : (
        <p className="m-0 text-sm text-muted italic">No reason given</p>
      )}
    </div>
  );
}

export function ReportCard({ report, now }: { report: ReportRow; now: Date }) {
  const category = isReportCategory(report.category) ? REPORT_CATEGORIES[report.category] : report.category;
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-md border-2 border-line bg-surface p-5">
      <header className="flex flex-col gap-1.5">
        <h3 className="m-0 text-base leading-snug font-bold">{category}</h3>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted">
          Reported by <PlayerLink player={report.reporter} size={16} />
          <span aria-hidden>·</span>
          <time dateTime={report.createdAt.toISOString()} title={shortDateTime(report.createdAt)}>
            {timeAgo(report.createdAt, now)}
          </time>
        </div>
      </header>

      {report.details && (
        <blockquote className="m-0 border-l-4 border-line-strong pl-3 text-sm leading-normal [overflow-wrap:anywhere] whitespace-pre-line text-ink">
          {report.details}
        </blockquote>
      )}

      <Copy value={report.value} giver={report.giver} receiver={report.receiver} reason={report.reason} />

      {!report.current && !report.resolvedAt && (
        <p className="m-0 flex items-start gap-2 text-[13px] leading-snug text-muted">
          <LuTriangleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-faint" />
          The giver has since changed or removed this, so there is nothing left to remove.
        </p>
      )}

      {report.resolvedAt ? (
        <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted">
          {report.resolution === "removed" ? (
            <LuTrash2 aria-hidden className="size-3.5 text-neg" />
          ) : (
            <LuCheck aria-hidden className="size-3.5 text-pos" />
          )}
          <span className="font-semibold text-ink-2">{report.resolution === "removed" ? "Reputation removed" : "Dismissed"}</span>
          {report.resolvedBy && (
            <>
              by <PlayerLink player={report.resolvedBy} size={16} />
            </>
          )}
          <span aria-hidden>·</span>
          <time dateTime={report.resolvedAt.toISOString()}>{shortDateTime(report.resolvedAt)}</time>
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          {report.current && (
            <ActionButton
              action={resolveReportAction.bind(null, report.id, "remove")}
              icon={<LuTrash2 aria-hidden className="size-4" />}
              label={`Remove ${report.value === 1 ? "+1" : "−1"}`}
              confirm="Remove for good?"
              tone="danger"
            />
          )}
          <ActionButton
            action={resolveReportAction.bind(null, report.id, "dismiss")}
            icon={<LuCheck aria-hidden className="size-4" />}
            label={report.current ? "Keep it, dismiss" : "Dismiss"}
          />
        </div>
      )}
    </article>
  );
}

/** Removes any +1/−1 from a Player's Admin page. */
export function RemoveButton({ reputationId, value }: { reputationId: string; value: 1 | -1 }) {
  return (
    <ActionButton
      action={removeReputationAction.bind(null, reputationId)}
      icon={<LuTrash2 aria-hidden className="size-4" />}
      label={`Remove ${value === 1 ? "+1" : "−1"}`}
      confirm="Remove for good?"
      tone="danger"
    />
  );
}
