import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LuArrowRight, LuCloudOff, LuDiff, LuLogIn, LuSearch, LuSearchX, LuShieldCheck } from "react-icons/lu";
import { newestFeed } from "@/components/home/feed";
import { NewestFeed, NewestFeedSkeleton } from "@/components/home/newest-feed";
import { HomeSearchForm, SearchNotice, TryPlayers } from "@/components/home/search";
import { db } from "@/db";
import { LINK_SERVER_ADDRESS } from "@/lib/config";
import { getViewer } from "@/lib/viewer";
import { findPlayerByName, type Player } from "@/server/players";
import { leaderboard } from "@/server/reputation";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="stagger mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-14 px-4 pt-8 pb-12 sm:gap-[88px] sm:px-6 sm:pt-[72px] sm:pb-20">
      <section aria-labelledby="hero-title" className="flex flex-col gap-5">
        <span className="inline-flex items-center gap-2 self-start rounded border-2 border-line-strong bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-ink-2">
          <LuShieldCheck aria-hidden className="size-3.5 text-pos" />
          Minecraft Java Edition
        </span>
        <h1 id="hero-title" className="m-0 max-w-[760px] font-pixel text-[40px] leading-[1.05] font-bold sm:text-[68px]">
          Know who you&apos;re trading with.
        </h1>
        <p className="m-0 max-w-[600px] text-base leading-[1.55] text-ink-2 sm:text-[19px]">
          Search any username to see the +1s and −1s other Players left after trades and games, and why.
        </p>
        <Suspense fallback={<HomeSearchForm />}>
          <SearchArea searchParams={searchParams} />
        </Suspense>
      </section>

      <section aria-labelledby="newest-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="newest-title" className="m-0 font-pixel text-[28px] font-bold">
            Newest Reputation given
          </h2>
          <LiveBadge />
        </div>
        <Suspense fallback={<NewestFeedSkeleton />}>
          <NewestArea />
        </Suspense>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-5">
        <h2 id="how-title" className="m-0 font-pixel text-[28px] font-bold">
          How it works
        </h2>
        <ol className="stagger m-0 flex list-none flex-wrap gap-4 p-0 [--stagger-base:180ms]">
          <Step icon={<LuSearch aria-hidden className="size-5" />} title="Look up a Player">
            Search any Java Edition username. Every Player has a profile here, even if they have never visited.
          </Step>
          <Step icon={<LuDiff aria-hidden className="size-5" />} title="Read their Reputation">
            Each one is a +1 or −1 with a reason. You see who gave it, when, and the Player&apos;s Reply.
          </Step>
          <Step icon={<LuLogIn aria-hidden className="size-5" />} title="Give your own">
            Sign in with a Link Code from our server. No password. Then give Reputation to Players you traded or played with.
          </Step>
        </ol>
      </section>

      <Suspense fallback={null}>
        <SignUp />
      </Suspense>
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

async function NewestArea() {
  // The feed reads the clock and the database: request time only.
  await connection();
  return <NewestFeed initial={await newestFeed()} />;
}

/** A pulsing dot: the feed below updates on its own. */
function LiveBadge() {
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded border-2 border-pos-line bg-pos-bg px-2.5 text-xs font-bold tracking-[0.08em] text-pos uppercase">
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full bg-pos opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-pos" />
      </span>
      Live
      <span className="sr-only">: updates on its own</span>
    </span>
  );
}

/** The closing call to action. Hidden from Players who are already signed in. */
async function SignUp() {
  if (await getViewer()) return null;
  return (
    <section
      aria-labelledby="signup-title"
      className="flex flex-wrap items-center gap-6 rounded-md border-2 border-accent-line bg-accent-deep p-6 sm:p-9"
    >
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
        <h2 id="signup-title" className="m-0 font-pixel text-[28px] leading-[1.1] font-bold sm:text-4xl">
          Sign up now
        </h2>
        <p className="m-0 max-w-[520px] leading-[1.55] text-ink-2">
          Your Minecraft account is your mcrep.gg account. Join <span className="font-mono font-semibold text-ink">{LINK_SERVER_ADDRESS}</span>,
          type <span className="font-mono font-semibold text-ink">/link</span> and enter the code. No password, no email.
        </p>
      </div>
      <Link
        href="/sign-in"
        className="press shadow-block inline-flex h-14 flex-none items-center gap-2 rounded bg-accent px-7 text-base font-bold text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink"
      >
        Sign up
        <LuArrowRight aria-hidden className="size-[18px]" />
      </Link>
    </section>
  );
}

function Step({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-[1_1_240px] flex-col gap-2.5 rounded-md border-2 border-line bg-surface p-5">
      <div className="flex size-10 items-center justify-center rounded bg-accent-bg text-accent">{icon}</div>
      <h3 className="m-0 text-base font-bold">{title}</h3>
      <p className="m-0 text-sm leading-[1.55] text-muted">{children}</p>
    </li>
  );
}

function Query({ children }: { children: string }) {
  return <strong className="font-mono text-ink [overflow-wrap:anywhere]">{children}</strong>;
}
