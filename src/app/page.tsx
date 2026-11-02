import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { LuCloudOff, LuDiff, LuLogIn, LuSearch, LuSearchX, LuShieldCheck } from "react-icons/lu";
import { HomeSearchForm, SearchNotice, TryPlayers } from "@/components/home/search";
import { NetReputation } from "@/components/reputation";
import { db } from "@/db";
import { findPlayerByName, type Player } from "@/server/players";
import { leaderboard } from "@/server/reputation";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-12 px-4 pt-8 pb-12 sm:gap-[72px] sm:px-6 sm:pt-[72px] sm:pb-20">
      <section aria-labelledby="hero-title" className="flex flex-col gap-5">
        <span className="inline-flex items-center gap-2 self-start rounded border-2 border-line-strong bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-ink-2">
          <LuShieldCheck aria-hidden className="size-3.5 text-pos" />
          Player reputation for Minecraft Java Edition
        </span>
        <h1 id="hero-title" className="m-0 font-pixel text-[38px] leading-[1.05] font-bold sm:text-6xl">
          Check a Player before you trade.
        </h1>
        <p className="m-0 max-w-[640px] text-base leading-[1.55] text-ink-2 sm:text-[19px]">
          Players give each other +1 or −1 Reputation after trades and games. Look someone up first, so you know who you are dealing with
          before you hand over your loot.
        </p>
        <Suspense fallback={<HomeSearchForm />}>
          <SearchArea searchParams={searchParams} />
        </Suspense>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-5">
        <h2 id="how-title" className="m-0 font-pixel text-[28px] font-bold">
          How it works
        </h2>
        <div className="flex flex-wrap gap-4">
          <Step icon={<LuSearch aria-hidden className="size-5" />} title="Look up a Player">
            Search any Java Edition username. Every Player has a profile here, even if they have never visited.
          </Step>
          <Step icon={<LuDiff aria-hidden className="size-5" />} title="Read their Reputation">
            Each one is a +1 or −1 with a reason. You see who gave it, when, and the Player&apos;s Reply.
          </Step>
          <Step icon={<LuLogIn aria-hidden className="size-5" />} title="Give your own">
            Sign in with a Link Code from our server. No password. Then give Reputation to Players you traded or played with.
          </Step>
        </div>
      </section>

      <section aria-labelledby="net-title" className="flex flex-col gap-4">
        <h2 id="net-title" className="m-0 font-pixel text-[28px] font-bold">
          Reading Net Reputation
        </h2>
        <p className="m-0 max-w-[680px] leading-[1.55] text-ink-2">
          Net Reputation is positive Reputation minus negative Reputation. Each Player can give another Player only one +1 or −1, so nobody
          can pile on.
        </p>
        <div className="flex flex-wrap gap-3">
          <NetExample positive={15} negative={3}>
            15 positive, 3 negative
          </NetExample>
          <NetExample positive={2} negative={6}>
            2 positive, 6 negative
          </NetExample>
          <NetExample positive={0} negative={0}>
            No Reputation yet. Totally normal.
          </NetExample>
        </div>
      </section>
    </main>
  );
}

/** Reads ?q=: redirects to the Player's profile when found, otherwise keeps the query and explains why. */
async function SearchArea({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  // Lookups read the clock, the network and the database: request time only.
  await connection();
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";

  let player: Player | null = null;
  let lookupFailed = false;
  if (query) {
    try {
      player = await findPlayerByName(db, query);
    } catch {
      lookupFailed = true;
    }
  }
  // Outside the try: redirect() works by throwing.
  if (player) redirect(`/player/${encodeURIComponent(player.username)}`);

  if (!query) {
    const featured = await leaderboard(db, "highest", 3);
    return (
      <>
        <HomeSearchForm />
        <TryPlayers players={featured} />
      </>
    );
  }

  return (
    <>
      <HomeSearchForm query={query} warn />
      {lookupFailed ? (
        <SearchNotice icon={<LuCloudOff aria-hidden className="size-6" />} title="Could not check that name">
          <p className="m-0 leading-[1.55] text-ink-2">
            Mojang did not answer when we looked up <Query>{query}</Query>. Try again in a minute.
          </p>
        </SearchNotice>
      ) : (
        <SearchNotice icon={<LuSearchX aria-hidden className="size-6" />} title="No Player with that name">
          <p className="m-0 leading-[1.55] text-ink-2">
            There is no Minecraft Java Edition account called <Query>{query}</Query>. Check the spelling: usernames are 3 to 16 characters
            and only use letters, numbers and underscores.
          </p>
          <p className="m-0 leading-[1.55] text-muted">Changed their name recently? Search for their new one.</p>
        </SearchNotice>
      )}
    </>
  );
}

function Query({ children }: { children: string }) {
  return <strong className="font-mono text-ink [overflow-wrap:anywhere]">{children}</strong>;
}

function Step({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-[1_1_240px] flex-col gap-2.5 rounded-md border-2 border-line bg-surface p-5">
      <div className="flex size-10 items-center justify-center rounded bg-accent-bg text-accent">{icon}</div>
      <h3 className="m-0 text-base font-bold">{title}</h3>
      <p className="m-0 text-sm leading-[1.55] text-muted">{children}</p>
    </div>
  );
}

function NetExample({ positive, negative, children }: { positive: number; negative: number; children: ReactNode }) {
  return (
    <div className="flex flex-[1_1_200px] flex-col gap-2 rounded-md border-2 border-line bg-surface px-5 py-[18px]">
      <NetReputation positive={positive} negative={negative} />
      <span className="text-sm text-muted">{children}</span>
    </div>
  );
}
