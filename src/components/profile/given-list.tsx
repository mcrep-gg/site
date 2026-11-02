"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { LuClock, LuCornerDownRight } from "react-icons/lu";
import { ValueChip } from "@/components/reputation";
import { SkinHead } from "@/components/skin-head";
import type { GivenView } from "./types";

/** How many entries show before "Show all". */
const FIRST_PAGE = 10;

/** "Reputation given": every +1/−1 this Player gave, with each receiver's Reply. Read-only: acting on one happens on the receiver's profile. */
export function GivenList({ entries, giverName, isOwn }: { entries: GivenView[]; giverName: string; isOwn: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, FIRST_PAGE);

  return (
    <>
      <h2 id="given-title" className="m-0 font-pixel text-2xl font-bold">
        Reputation given
      </h2>
      {entries.length === 0 ? (
        <p className="m-0 rounded-md border-2 border-dashed border-line-strong bg-surface px-5 py-6 text-sm text-muted">
          {isOwn ? "You haven't" : `${giverName} hasn't`} given anyone Reputation yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="stagger overflow-hidden rounded-md border-2 border-line bg-surface [--stagger-base:120ms] [--stagger-step:40ms]">
            {shown.map((e, i) => (
              <article
                key={e.id}
                style={{ "--stagger-index": Math.min(i % FIRST_PAGE, 9) } as CSSProperties}
                className={`flex gap-3.5 px-3.5 py-4 sm:px-5 sm:py-[18px] ${i > 0 ? "border-t-2 border-line-soft" : ""}`}
              >
                <SkinHead uuid={e.receiver.uuid} username={e.receiver.username} size={40} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <ValueChip value={e.value} />
                    <span className="text-[13px] text-muted">to</span>
                    <Link
                      href={`/player/${e.receiver.username}`}
                      className="font-mono text-[15px] font-semibold text-ink no-underline [overflow-wrap:anywhere] hover:text-accent"
                    >
                      {e.receiver.username}
                    </Link>
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
                          <strong className="font-semibold text-ink">Reply from {e.receiver.username}</strong> · {e.reply.when}
                        </span>
                        <p className="m-0 text-sm leading-normal text-ink [overflow-wrap:anywhere]">{e.reply.text}</p>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!showAll && entries.length > FIRST_PAGE && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="h-12 cursor-pointer rounded border-2 border-line-strong bg-surface text-sm font-semibold text-ink"
            >
              Show all given ({entries.length})
            </button>
          )}
        </div>
      )}
    </>
  );
}
