import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense, type ReactNode } from "react";
import { LuCheck, LuCircleAlert, LuInfo, LuLogIn, LuSearchX, LuShieldCheck, LuTriangleAlert, LuUserRound } from "react-icons/lu";
import { db } from "@/db";
import { formatNet } from "@/lib/rules";
import { getViewer } from "@/lib/viewer";
import { findPlayerByName, type Player } from "@/server/players";
import { giverStatus, hasReported, receivedReputation, totalsFor } from "@/server/reputation";
import { SkinHead } from "@/components/skin-head";
import { shortDate, timeAgo, timeUntil } from "@/components/profile/format";
import { CopyProfileLink, GivePanel } from "@/components/profile/give-panel";
import { ReceivedList } from "@/components/profile/received-list";
import type { EntryView, GiveContext } from "@/components/profile/types";

type Params = Promise<{ name: string }>;

/** One lookup per request, shared by the metadata and the page. Throws when Mojang can't be reached. */
const findPlayer = cache(async (name: string): Promise<Player | null> => {
  // Freshness checks read the clock and Mojang lookups hit the network: request time only.
  await connection();
  return findPlayerByName(db, name);
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name } = await params;
  const player = await findPlayer(name).catch(() => null);
  return player
    ? { title: `${player.username}'s Reputation`, description: `What other Minecraft Players say about ${player.username}.` }
    : { title: "No Player with that name" };
}

export default function PlayerPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto box-border flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-5 pb-12 sm:px-6 sm:pt-8 sm:pb-20">
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: { params: Params }) {
  const { name } = await params;

  let player: Player | null;
  try {
    player = await findPlayer(name);
  } catch {
    return <LookupFailed name={name} />;
  }
  if (!player) return <NoPlayer name={name} />;
  if (player.username !== name) redirect(`/player/${encodeURIComponent(player.username)}`);

  const [viewer, totals, received] = await Promise.all([getViewer(), totalsFor(db, player.uuid), receivedReputation(db, player.uuid)]);
  const isOwn = viewer?.uuid === player.uuid;
  const [status, reported] = await Promise.all([
    viewer && !isOwn ? giverStatus(db, viewer, player.uuid) : null,
    viewer ? hasReported(db, viewer.uuid, received.map((e) => e.id)) : new Set<string>(),
  ]);
  const now = new Date();

  const entries: EntryView[] = received.map((e) => ({
    id: e.id,
    value: e.value,
    reason: e.reason,
    when: timeAgo(e.createdAt, now),
    giver: e.giver,
    reply: e.reply ? { text: e.reply.text, when: timeAgo(e.reply.updatedAt, now) } : null,
    mine: !!viewer && e.giver.uuid === viewer.uuid,
    reported: reported.has(e.id),
  }));

  const { positive: pos, negative: neg } = totals;
  const total = pos + neg;
  const net = formatNet(pos, neg);
  const posPct = total ? Math.round((pos / total) * 100) : 0;
  const mostlyPos = total >= 5 && pos / total >= 0.8;
  const mostlyNeg = total >= 5 && neg / total >= 0.6;
  const username = player.username;

  let giveCtx: GiveContext | null = null;
  if (viewer && status) {
    const mine = entries.find((e) => e.mine);
    giveCtx = {
      target: { uuid: player.uuid, username },
      viewerName: viewer.username,
      existing: status.existing
        ? {
            value: status.existing.value,
            reason: status.existing.reason,
            when: timeAgo(status.existing.createdAt, now),
            hasReply: !!mine?.reply,
          }
        : null,
      usedToday: status.usedToday,
      limit: status.limit,
      newPlayerDaysLeft: status.newPlayerDaysLeft,
      resetsIn: timeUntil(status.resetsAt, now),
      suspension: status.suspension
        ? { reason: status.suspension.reason, until: status.suspension.until ? shortDate(status.suspension.until) : null }
        : null,
    };
  }

  return (
    <>
      {mostlyNeg && (
        <div role="alert" className="flex items-start gap-3.5 rounded-md border-2 border-neg-line bg-neg-bg px-[18px] py-4">
          <LuTriangleAlert aria-hidden className="size-6 shrink-0 text-neg" />
          <div className="flex flex-col gap-1">
            <strong className="text-base text-[#ffd9d9] [overflow-wrap:anywhere]">Be careful trading with {username}</strong>
            <p className="m-0 text-sm leading-normal text-[#f2c4c4]">
              They received {neg} −1 and {pos} +1. Read the reasons below before you trade, and never drop your items first.
            </p>
          </div>
        </div>
      )}

      <section
        aria-label="Player summary"
        className={`flex flex-wrap items-stretch gap-6 rounded-md border-2 bg-surface p-[18px] sm:p-6 ${mostlyNeg ? "border-neg-line" : "border-line"}`}
      >
        <div className="flex min-w-0 flex-[1_1_300px] items-center gap-5">
          <div className="shrink-0 max-sm:[&>img]:size-16!">
            <SkinHead uuid={player.uuid} username={username} size={88} />
          </div>
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="m-0 font-pixel text-[28px] leading-[1.05] font-bold [overflow-wrap:anywhere] sm:text-[40px]">{username}</h1>
            <div className="flex flex-wrap gap-1.5">
              {isOwn && <Badge className="bg-accent-bg font-bold text-accent">This is you</Badge>}
              {player.linkedAt ? (
                <Badge className="gap-[5px] border border-line-strong bg-surface-3 font-semibold text-ink-2">
                  <LuCheck aria-hidden className="size-[13px]" />
                  Linked Player
                </Badge>
              ) : (
                <Badge className="border border-line-strong bg-surface-3 font-semibold text-muted">Not on mcrep.gg yet</Badge>
              )}
              {mostlyPos && (
                <Badge className="gap-[5px] bg-pos-bg font-bold text-pos">
                  <LuShieldCheck aria-hidden className="size-[13px]" />
                  Mostly positive
                </Badge>
              )}
              {mostlyNeg && (
                <Badge className="gap-[5px] bg-neg-bg font-bold text-neg">
                  <LuTriangleAlert aria-hidden className="size-[13px]" />
                  Mostly negative
                </Badge>
              )}
            </div>
            <span className="text-[13px] text-muted">
              Java Edition · Reputation from {total} {total === 1 ? "Player" : "Players"}
            </span>
          </div>
        </div>

        <div className="flex flex-[1_1_220px] flex-col justify-center gap-2.5">
          <span className="text-xs font-bold tracking-[0.08em] text-muted uppercase">Net Reputation</span>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span
              className={`font-pixel text-[44px] leading-none font-bold sm:text-[56px] ${
                net.sign === "pos" ? "text-pos" : net.sign === "neg" ? "text-neg" : "text-zero"
              }`}
            >
              {net.net}
            </span>
            <span className="font-mono text-lg font-medium text-ink-2">{net.counts}</span>
          </div>
          {total > 0 && (
            <div aria-hidden className="flex h-2.5 bg-page">
              <div className="bg-pos" style={{ width: `${posPct}%` }} />
              <div className="bg-neg" style={{ width: `${100 - posPct}%` }} />
            </div>
          )}
          <span className="text-[13px] text-muted">{total ? `${pos} positive, ${neg} negative` : "No Reputation yet"}</span>
        </div>

        <div className="flex flex-[1_1_280px] flex-col justify-center rounded border-2 border-line-strong bg-surface-3 p-[18px]">
          {isOwn ? (
            <div className="flex flex-col gap-2.5">
              <h2 className="m-0 text-base font-bold">Your profile</h2>
              <p className="m-0 text-sm leading-normal text-ink-2">
                You can&apos;t give yourself Reputation. Write a Reply on any +1 or −1 you received to share your side.
              </p>
              <CopyProfileLink username={username} />
            </div>
          ) : giveCtx ? (
            <GivePanel ctx={giveCtx} title={total === 0 ? `Be the first to give ${username} Reputation` : `Give ${username} Reputation`} />
          ) : (
            <div className="flex flex-col gap-3">
              <h2 className="m-0 text-base font-bold [overflow-wrap:anywhere]">Give {username} Reputation</h2>
              <p className="m-0 text-sm leading-normal text-ink-2">
                Sign in with your Minecraft account first. No password: you get a one-time code in-game.
              </p>
              <Link
                href="/sign-in"
                className="shadow-block flex h-12 items-center justify-center gap-2 rounded bg-accent text-[15px] font-bold text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink"
              >
                <LuLogIn aria-hidden className="size-4" />
                Sign in to give Reputation
              </Link>
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="received-title" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
          {total > 0 ? (
            <ReceivedList entries={entries} receiverName={username} isOwn={isOwn} viewerName={viewer?.username ?? null} />
          ) : (
            <>
              <h2 id="received-title" className="m-0 font-pixel text-2xl font-bold">
                Reputation received
              </h2>
              <div className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-line-strong bg-surface px-6 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded border-2 border-line-strong bg-surface-3 text-muted">
                  <LuUserRound aria-hidden className="size-[26px]" />
                </div>
                <h3 className="m-0 font-pixel text-[22px] font-bold">No Reputation yet</h3>
                <p className="m-0 max-w-[460px] leading-[1.55] text-ink-2">
                  {isOwn ? "You haven't" : `${username} hasn't`} received any Reputation. That&apos;s normal: most Players only show up
                  here after someone gives them a +1 or −1.
                </p>
                <p className="m-0 max-w-[460px] text-sm leading-[1.55] text-muted">
                  {isOwn
                    ? "Having no Reputation is not a bad sign, and not a good one either. Share your profile link with Players you trade with."
                    : `Having no Reputation is not a bad sign, and not a good one either. If you trade with ${username}, come back and be the first to give Reputation.`}
                </p>
              </div>
            </>
          )}
        </section>

        <aside className="flex flex-[1_1_280px] flex-col gap-4">
          <div className="flex flex-col gap-3.5 rounded-md border-2 border-line bg-surface p-5">
            <h2 className="m-0 flex items-center gap-2 text-base font-bold">
              <LuInfo aria-hidden className="size-[18px] text-accent" />
              Reading a profile
            </h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm leading-normal text-ink-2">
              <Tip>Read the reasons, not just the number. One angry −1 matters less than a pattern.</Tip>
              <Tip>Each Player can give another Player only one +1 or −1. A new one replaces the old one.</Tip>
              <Tip>A Reply is the receiving Player&apos;s side of the story.</Tip>
              <Tip>Reputation is what Players say, not a guarantee. Use a middleman for big trades.</Tip>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex h-[26px] items-center rounded-[3px] px-2 text-xs ${className}`}>{children}</span>;
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-accent" />
      <span>{children}</span>
    </li>
  );
}

function NoPlayer({ name }: { name: string }) {
  return (
    <div role="status" className="flex items-start gap-4 rounded-md border-2 border-accent-line bg-surface p-5">
      <div className="flex size-12 shrink-0 items-center justify-center rounded bg-accent-bg text-accent">
        <LuSearchX aria-hidden className="size-6" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="m-0 text-xl font-bold">No Player with that name</h1>
        <p className="m-0 leading-[1.55] text-ink-2">
          There is no Minecraft Java Edition account called{" "}
          <strong className="font-mono text-ink [overflow-wrap:anywhere]">{name}</strong>. Check the spelling: usernames are 3 to 16
          characters and only use letters, numbers and underscores.
        </p>
        <p className="m-0 leading-[1.55] text-muted">Changed their name recently? Search for their new one.</p>
        <Link href="/" className="font-semibold">
          Search for a Player
        </Link>
      </div>
    </div>
  );
}

function LookupFailed({ name }: { name: string }) {
  return (
    <div role="alert" className="flex items-start gap-4 rounded-md border-2 border-accent-line bg-surface p-5">
      <div className="flex size-12 shrink-0 items-center justify-center rounded bg-accent-bg text-accent">
        <LuCircleAlert aria-hidden className="size-6" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="m-0 text-xl font-bold">Couldn&apos;t look up that Player</h1>
        <p className="m-0 leading-[1.55] text-ink-2">
          We couldn&apos;t reach Mojang to find <strong className="font-mono text-ink [overflow-wrap:anywhere]">{name}</strong>. Try again
          in a minute.
        </p>
        <Link href="/" className="font-semibold">
          Back to search
        </Link>
      </div>
    </div>
  );
}

/** Same shape as the profile, so nothing jumps when it streams in. */
function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6 rounded-md border-2 border-line bg-surface p-[18px] sm:p-6">
        <div className="flex flex-[1_1_300px] items-center gap-5">
          <div className="size-16 shrink-0 rounded-[3px] bg-surface-3 sm:size-[88px]" />
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="h-8 w-48 max-w-full rounded bg-surface-3 sm:h-10" />
            <div className="h-[26px] w-32 rounded bg-surface-3" />
          </div>
        </div>
        <div className="flex flex-[1_1_220px] flex-col gap-2.5">
          <div className="h-3 w-28 rounded bg-surface-3" />
          <div className="h-11 w-36 rounded bg-surface-3 sm:h-14" />
        </div>
        <div className="h-[150px] flex-[1_1_280px] rounded border-2 border-line-strong bg-surface-3" />
      </div>
      <div className="h-[320px] rounded-md border-2 border-line bg-surface" />
    </div>
  );
}
