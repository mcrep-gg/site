"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LuClock } from "react-icons/lu";
import { ReactionCounts } from "@/components/profile/reactions";
import { ValueChip } from "@/components/reputation";
import { SkinHead } from "@/components/skin-head";
import type { FeedItem } from "./feed";

/** How often the feed checks for new Reputation while the tab is visible. */
const POLL_MS = 15_000;

/** The newest Reputation given by anyone. Starts from the server's list, then polls while the tab is visible. */
export function NewestFeed({ initial }: { initial: FeedItem[] }) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      try {
        const res = await fetch("/api/reputation/newest", { cache: "no-store" });
        if (res.ok) setItems(await res.json());
      } catch {
        // Offline or the server is restarting: keep showing what we have and try again next time.
      }
    };
    const start = () => {
      clearInterval(timer);
      timer = setInterval(load, POLL_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        load();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (items.length === 0) {
    return (
      <p className="m-0 rounded-md border-2 border-dashed border-line-strong bg-surface px-5 py-8 text-center leading-[1.55] text-ink-2">
        Nobody has given Reputation yet. Traded with someone? Look them up and be the first.
      </p>
    );
  }

  return (
    <ol className="m-0 list-none overflow-hidden rounded-md border-2 border-line bg-surface p-0">
      {items.map((e, i) => (
        <li key={e.id} className={`flex gap-3.5 px-3.5 py-4 sm:px-5 ${i > 0 ? "border-t-2 border-line-soft" : ""}`}>
          <SkinHead uuid={e.receiver.uuid} username={e.receiver.username} size={36} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <ValueChip value={e.value} />
              <Link
                href={`/player/${encodeURIComponent(e.receiver.username)}`}
                className="font-mono text-[15px] font-semibold text-ink no-underline [overflow-wrap:anywhere] hover:text-accent"
              >
                {e.receiver.username}
              </Link>
              <span className="text-[13px] text-muted">
                from{" "}
                <Link href={`/player/${encodeURIComponent(e.giver.username)}`} className="font-mono text-ink-2 no-underline hover:text-accent">
                  {e.giver.username}
                </Link>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                <LuClock aria-hidden className="size-[13px]" />
                {e.when}
              </span>
            </div>
            {e.reason ? (
              <p className="m-0 line-clamp-2 text-sm leading-[1.55] text-ink-2 [overflow-wrap:anywhere]">{e.reason}</p>
            ) : (
              <p className="m-0 text-sm text-muted italic">No reason given</p>
            )}
            <ReactionCounts reactions={e.reactions} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Placeholder rows while the first list loads. */
export function NewestFeedSkeleton() {
  return (
    <div aria-busy="true" className="overflow-hidden rounded-md border-2 border-line bg-surface">
      <p className="sr-only" role="status">
        Loading the newest Reputation
      </p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`flex gap-3.5 px-3.5 py-4 sm:px-5 ${i > 0 ? "border-t-2 border-line-soft" : ""}`}>
          <div className="size-9 shrink-0 rounded-[3px] bg-surface-3" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-4 w-48 max-w-full rounded-[3px] bg-surface-3" />
            <div className="h-3.5 w-72 max-w-full rounded-[3px] bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
