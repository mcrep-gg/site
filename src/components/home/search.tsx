import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { LuSearch } from "react-icons/lu";
import { SkinHead } from "@/components/skin-head";

/** The big username search on Home. Submits GET /?q=<username>. */
export function HomeSearchForm({ query = "", warn = false }: { query?: string; warn?: boolean }) {
  return (
    <Form action="/" role="search" className="mt-2 flex flex-col gap-2">
      <label htmlFor="home-search" className="text-sm font-semibold">
        Minecraft username
      </label>
      <div className="flex flex-wrap gap-2.5">
        <div
          className={`flex h-14 flex-[1_1_260px] items-center gap-2.5 rounded border-2 bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
            warn ? "border-accent-line" : "border-line-strong"
          }`}
        >
          <LuSearch aria-hidden className="size-5 shrink-0 text-muted" />
          <input
            id="home-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="e.g. BlockSmith_Ava"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-lg font-medium text-ink outline-none focus-visible:outline-none!"
          />
        </div>
        <button
          type="submit"
          className="shadow-block flex h-14 flex-none cursor-pointer items-center justify-center rounded bg-accent px-7 text-base font-bold text-accent-ink hover:bg-accent-hover"
        >
          Search
        </button>
      </div>
    </Form>
  );
}

/** "Try:" chips linking to a few Players' profiles. */
export function TryPlayers({ players }: { players: { uuid: string; username: string }[] }) {
  if (players.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <span>Try:</span>
      {players.map((p) => (
        <Link
          key={p.uuid}
          href={`/player/${encodeURIComponent(p.username)}`}
          className="inline-flex h-11 items-center gap-2 rounded border-2 border-line-strong bg-surface pr-3 pl-2 font-mono text-[13px] font-medium no-underline hover:border-accent-line"
        >
          <SkinHead uuid={p.uuid} username={p.username} size={22} />
          <span className="text-ink">{p.username}</span>
        </Link>
      ))}
    </div>
  );
}

/** The accent-bordered panel under the search box ("No Player with that name"). */
export function SearchNotice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-4 rounded-md border-2 border-accent-line bg-surface p-5">
      <div className="flex size-12 shrink-0 items-center justify-center rounded bg-accent-bg text-accent">{icon}</div>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="m-0 text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
