import Link from "next/link";
import type { ReactNode } from "react";
import { LuArrowDown, LuArrowUp } from "react-icons/lu";
import { SkinHead } from "@/components/skin-head";
import { formatNet } from "@/lib/rules";
import type { LeaderboardRow } from "@/server/reputation";

export type ListKind = "highest" | "lowest";

const LISTS = {
  highest: {
    title: "Highest Net Reputation",
    sub: "Most trusted Players",
    icon: <LuArrowUp aria-hidden strokeWidth={2.5} className="size-5" />,
    iconClass: "bg-pos-bg text-pos",
    empty: "Nobody with Reputation from at least 10 Players has a positive Net Reputation yet.",
  },
  lowest: {
    title: "Lowest Net Reputation",
    sub: "Be careful trading with these Players",
    icon: <LuArrowDown aria-hidden strokeWidth={2.5} className="size-5" />,
    iconClass: "bg-neg-bg text-neg",
    empty: "Nobody with Reputation from at least 10 Players has a negative Net Reputation yet.",
  },
} as const;

const netColor = { pos: "text-pos", neg: "text-neg", zero: "text-zero" } as const;

/** The card frame shared by a list, its skeleton and nothing else. */
function ListCard({ kind, id, children }: { kind: ListKind; id?: string; children: ReactNode }) {
  const l = LISTS[kind];
  return (
    <section id={id} aria-label={l.title} className="min-w-0 overflow-hidden rounded-md border-2 border-line bg-surface">
      <header className="flex items-center gap-3 border-b-2 border-line-soft px-5 py-[18px]">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded ${l.iconClass}`}>{l.icon}</span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="m-0 text-lg font-bold">{l.title}</h2>
          <span className="text-[13px] text-muted">{l.sub}</span>
        </div>
      </header>
      {children}
    </section>
  );
}

/** One ranked list. Ranks 01 to 03 of the highest list get the accent podium chip. */
export function LeaderboardList({ kind, rows, id }: { kind: ListKind; rows: LeaderboardRow[]; id?: string }) {
  return (
    <ListCard kind={kind} id={id}>
      {rows.length === 0 ? (
        <p className="m-0 px-5 py-6 text-sm leading-[1.55] text-muted">{LISTS[kind].empty}</p>
      ) : (
        <ol className="m-0 list-none p-0">
          {rows.map((r, i) => {
            const f = formatNet(r.positive, r.negative);
            const podium = kind === "highest" && i < 3;
            return (
              <li key={r.uuid} className={i === 0 ? "" : "border-t-2 border-line-soft"}>
                <Link
                  href={`/player/${encodeURIComponent(r.username)}`}
                  aria-label={`Rank ${i + 1}, ${r.username}, Net Reputation ${f.net}, ${r.positive} positive, ${r.negative} negative`}
                  className="flex min-h-14 items-center gap-3 px-3 py-2 no-underline hover:bg-surface-3 sm:px-5"
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-[34px] shrink-0 items-center justify-center rounded-[3px] font-mono text-[13px] font-bold ${
                      podium ? "bg-accent-bg text-accent" : "bg-surface-3 text-muted"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <SkinHead uuid={r.uuid} username={r.username} size={32} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold text-ink">{r.username}</span>
                  <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <strong className={`font-mono text-[17px] font-bold ${netColor[f.sign]}`}>{f.net}</strong>
                    <span className="font-mono text-[13px] font-medium text-muted">{f.counts}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </ListCard>
  );
}

/** Placeholder rows while the lists load. */
export function LeaderboardListSkeleton({ kind }: { kind: ListKind }) {
  return (
    <ListCard kind={kind}>
      <ol aria-hidden className="m-0 list-none p-0">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className={`flex min-h-14 items-center gap-3 px-3 py-2 sm:px-5 ${i === 0 ? "" : "border-t-2 border-line-soft"}`}>
            <span className="h-7 w-[34px] shrink-0 rounded-[3px] bg-surface-3" />
            <span className="size-8 shrink-0 rounded-[3px] bg-surface-3" />
            <span className="h-4 flex-1 animate-pulse rounded-[3px] bg-surface-3" />
            <span className="h-4 w-20 animate-pulse rounded-[3px] bg-surface-3" />
          </li>
        ))}
      </ol>
    </ListCard>
  );
}
