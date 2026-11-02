import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LuChevronRight, LuSearch, LuSearchX } from "react-icons/lu";
import { db } from "@/db";
import { searchPlayers } from "@/server/admin";
import { adminPlayerPath, Empty, PageTitle } from "@/components/admin/ui";
import { RankBadge } from "@/components/rank-badge";
import { SkinHead } from "@/components/skin-head";
import { shortDate } from "@/components/profile/format";
import { requireModerator } from "../data";

export const metadata: Metadata = { title: "Players" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function PlayersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageTitle title="Players">Find a Player the site knows by the start of their username, or paste a UUID.</PageTitle>
      <Suspense fallback={<div aria-busy="true" aria-label="Loading Players" className="h-96 rounded-md border-2 border-line bg-surface" />}>
        <Players searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Players({ searchParams }: { searchParams: SearchParams }) {
  await requireModerator();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 64) : "";
  const matches = await searchPlayers(db, q);

  return (
    <>
      <form action="/admin/players" role="search" className="flex gap-2">
        <label htmlFor="admin-player-search" className="sr-only">
          Username or UUID
        </label>
        <input
          id="admin-player-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Username or UUID"
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 rounded border-2 border-field-line bg-page px-3 font-mono text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="shadow-block flex h-11 cursor-pointer items-center gap-2 rounded border-0 bg-accent px-4 text-sm font-bold text-accent-ink hover:bg-accent-hover"
        >
          <LuSearch aria-hidden className="size-4" />
          Search
        </button>
      </form>

      {matches.length ? (
        <section className="flex flex-col gap-2" aria-label={q ? `Players matching ${q}` : "Recently linked Players"}>
          {!q && <h3 className="m-0 text-xs font-bold tracking-[0.08em] text-muted uppercase">Recently linked</h3>}
          <ul className="m-0 flex list-none flex-col divide-y-2 divide-line overflow-hidden rounded-md border-2 border-line bg-surface p-0">
            {matches.map((p) => (
              <li key={p.uuid}>
                <Link href={adminPlayerPath(p.uuid)} className="flex min-h-16 items-center gap-3 px-4 py-2.5 text-ink no-underline hover:bg-surface-3 hover:text-ink">
                  <SkinHead uuid={p.uuid} username={p.username} size={36} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-sm font-bold">{p.username}</span>
                      <RankBadge rank={p.rank} size="sm" />
                    </span>
                    <span className="truncate font-mono text-xs text-muted">{p.uuid}</span>
                  </div>
                  <span className="shrink-0 text-[13px] text-muted max-sm:hidden">
                    {p.linkedAt ? `Linked ${shortDate(p.linkedAt)}` : "Never linked"}
                  </span>
                  <LuChevronRight aria-hidden className="size-4 shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Empty icon={<LuSearchX aria-hidden className="size-5" />} title={q ? `No Player matching “${q}”` : "No Linked Players yet"}>
          {q ? "Only Players someone has looked up or who have linked are on the site." : undefined}
        </Empty>
      )}
    </>
  );
}
