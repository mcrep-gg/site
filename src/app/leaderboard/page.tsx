import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LuUsers } from "react-icons/lu";
import { LeaderboardList, LeaderboardListSkeleton } from "@/components/leaderboard/leaderboard-list";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { db } from "@/db";
import { leaderboard, LEADERBOARD_MIN_GIVERS } from "@/server/reputation";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Minecraft Java Edition Players with the highest and lowest Net Reputation on mcrep.gg.",
};

const LIST_LENGTH = 10;

export default function LeaderboardPage() {
  return (
    <main className="mx-auto box-border flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 sm:pt-12 sm:pb-20">
      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 font-pixel text-[32px] leading-[1.05] font-bold sm:text-[44px]">Leaderboard</h1>
        <p className="m-0 max-w-[640px] text-base leading-[1.55] text-ink-2">
          Players with the highest and lowest Net Reputation. Players need Reputation from at least {LEADERBOARD_MIN_GIVERS} Players to be
          listed.
        </p>
      </div>
      <Suspense fallback={<LoadingLists />}>
        <Lists />
      </Suspense>
    </main>
  );
}

async function Lists() {
  // Always read fresh at request time; never bake the lists into the prerendered shell.
  await connection();
  const [highest, lowest] = await Promise.all([leaderboard(db, "highest", LIST_LENGTH), leaderboard(db, "lowest", LIST_LENGTH)]);

  if (highest.length === 0) return <NobodyListed />;

  // With few eligible Players both queries return the same people; keep each list to its own side of zero.
  return (
    <LeaderboardTabs
      highest={<LeaderboardList kind="highest" rows={highest.filter((r) => r.net > 0)} />}
      lowest={<LeaderboardList kind="lowest" rows={lowest.filter((r) => r.net < 0)} />}
    />
  );
}

function LoadingLists() {
  return (
    <div aria-busy="true" className="flex flex-wrap items-start gap-6">
      <p className="sr-only" role="status">
        Loading the leaderboard
      </p>
      <div className="min-w-0 flex-[1_1_400px]">
        <LeaderboardListSkeleton kind="highest" />
      </div>
      <div className="min-w-0 flex-[1_1_400px] max-md:hidden">
        <LeaderboardListSkeleton kind="lowest" />
      </div>
    </div>
  );
}

/** Nobody has Reputation from enough Players yet. */
function NobodyListed() {
  return (
    <div role="status" className="flex items-start gap-4 rounded-md border-2 border-line bg-surface p-5">
      <div className="flex size-12 shrink-0 items-center justify-center rounded bg-accent-bg text-accent">
        <LuUsers aria-hidden className="size-6" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="m-0 text-xl font-bold">Nobody is listed yet</h2>
        <p className="m-0 leading-[1.55] text-ink-2">
          Players need Reputation from at least {LEADERBOARD_MIN_GIVERS} Players to be listed. Nobody has reached that yet.
        </p>
        <p className="m-0 leading-[1.55] text-muted">
          Traded or played with someone? <Link href="/">Look them up</Link> and give them Reputation.
        </p>
      </div>
    </div>
  );
}
