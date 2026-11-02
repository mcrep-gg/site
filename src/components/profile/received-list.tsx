"use client";

import Link from "next/link";
import { useState } from "react";
import { LuClock, LuCornerDownRight, LuFlag, LuMessageSquare, LuPencil } from "react-icons/lu";
import { ValueChip } from "@/components/reputation";
import { SkinHead } from "@/components/skin-head";
import { ReplyDialog, ReportDialog } from "./entry-dialogs";
import type { EntryView } from "./types";

type Filter = "all" | "plus" | "minus";
type Open = { kind: "reply" | "report"; id: string } | null;

/** How many entries show before "Show all Reputation". */
const FIRST_PAGE = 10;

const actionLink = "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent px-2.5 text-[13px] font-semibold";

/** "Reputation received": the filter chips, every +1/−1 with its Reply, and the Reply and Report dialogs. */
export function ReceivedList({
  entries,
  receiverName,
  isOwn,
  viewerName,
}: {
  entries: EntryView[];
  receiverName: string;
  isOwn: boolean;
  /** null when signed out. */
  viewerName: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  const positive = entries.filter((e) => e.value === 1).length;
  const negative = entries.length - positive;
  const filtered = entries.filter((e) => filter === "all" || (filter === "plus" ? e.value === 1 : e.value === -1));
  const shown = showAll ? filtered : filtered.slice(0, FIRST_PAGE);
  const openEntry = open ? entries.find((e) => e.id === open.id) : undefined;

  const chips: [Filter, string, number][] = [
    ["all", "All", entries.length],
    ["plus", "+1", positive],
    ["minus", "−1", negative],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="received-title" className="m-0 font-pixel text-2xl font-bold">
          Reputation received
        </h2>
        <div role="group" aria-label="Filter Reputation" className="flex gap-1.5">
          {chips.map(([id, label, count]) => {
            const on = filter === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(id)}
                className={`flex h-10 cursor-pointer items-center gap-1.5 rounded border-2 px-3 text-sm font-semibold ${
                  on ? "border-ink bg-ink text-page" : "border-line-strong bg-surface text-ink-2"
                }`}
              >
                <span className="font-mono">{label}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="overflow-hidden rounded-md border-2 border-line bg-surface">
          {shown.length === 0 && (
            <p className="m-0 px-5 py-6 text-sm text-muted">{filter === "plus" ? "No +1 yet." : "No −1 yet."}</p>
          )}
          {shown.map((e, i) => {
            const canWriteReply = isOwn && !e.reply;
            const canEditReply = isOwn && !!e.reply;
            const canReport = !!viewerName && !e.mine;
            return (
              <article
                key={e.id}
                className={`flex gap-3.5 px-3.5 py-4 sm:px-5 sm:py-[18px] ${i > 0 ? "border-t-2 border-line-soft" : ""} ${
                  e.mine ? "bg-pos-bg/40" : ""
                }`}
              >
                <SkinHead uuid={e.giver.uuid} username={e.giver.username} size={40} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <ValueChip value={e.value} />
                    <Link
                      href={`/player/${e.giver.username}`}
                      className="font-mono text-[15px] font-semibold text-ink no-underline [overflow-wrap:anywhere] hover:text-accent"
                    >
                      {e.giver.username}
                    </Link>
                    {e.mine && (
                      <span className="inline-flex h-[22px] items-center rounded-[3px] bg-accent-bg px-[7px] text-xs font-bold text-accent">
                        You gave this
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                      <LuClock aria-hidden className="size-[13px]" />
                      {e.when}
                    </span>
                  </div>
                  {e.reason ? (
                    <p className="m-0 text-[15px] leading-[1.55] text-ink [overflow-wrap:anywhere]">{e.reason}</p>
                  ) : (
                    <p className="m-0 text-sm text-muted italic">No reason given</p>
                  )}
                  {e.reply && (
                    <div className="flex gap-2.5 rounded border-2 border-line bg-surface-2 px-3.5 py-3">
                      <LuCornerDownRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[13px] text-muted">
                          <strong className="font-semibold text-ink">Reply from {receiverName}</strong> · {e.reply.when}
                        </span>
                        <p className="m-0 text-sm leading-normal text-ink [overflow-wrap:anywhere]">{e.reply.text}</p>
                      </div>
                    </div>
                  )}
                  {(canWriteReply || canEditReply || canReport) && (
                    <div className="-mt-1.5 -mb-2.5 -ml-2.5 flex flex-wrap gap-1">
                      {canWriteReply && (
                        <button type="button" onClick={() => setOpen({ kind: "reply", id: e.id })} className={`${actionLink} text-accent`}>
                          <LuMessageSquare aria-hidden className="size-[15px]" />
                          Write a Reply
                        </button>
                      )}
                      {canEditReply && (
                        <button type="button" onClick={() => setOpen({ kind: "reply", id: e.id })} className={`${actionLink} text-ink-2`}>
                          <LuPencil aria-hidden className="size-[15px]" />
                          Edit your Reply
                        </button>
                      )}
                      {canReport &&
                        (e.reported ? (
                          <span className={`${actionLink} cursor-default text-faint`}>
                            <LuFlag aria-hidden className="size-[15px]" />
                            Reported
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOpen({ kind: "report", id: e.id })}
                            aria-label={`Report the ${e.value === 1 ? "+1" : "−1"} from ${e.giver.username}`}
                            className={`${actionLink} text-muted hover:text-ink`}
                          >
                            <LuFlag aria-hidden className="size-[15px]" />
                            Report
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {!showAll && filtered.length > FIRST_PAGE && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="h-12 cursor-pointer rounded border-2 border-line-strong bg-surface text-sm font-semibold text-ink"
          >
            Show all Reputation ({filtered.length})
          </button>
        )}
      </div>

      {openEntry && open?.kind === "reply" && viewerName && <ReplyDialog entry={openEntry} viewerName={viewerName} onClose={close} />}
      {openEntry && open?.kind === "report" && (
        <ReportDialog entry={openEntry} receiverName={receiverName} isOwn={isOwn} onClose={close} />
      )}
    </>
  );
}
