import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { LuBan, LuClock, LuLink, LuLogOut, LuUserRound } from "react-icons/lu";
import { signOut } from "@/app/sign-in/actions";
import { db } from "@/db";
import { DAILY_LIMIT, NEW_PLAYER_DAILY_LIMIT, NEW_PLAYER_DAYS } from "@/lib/rules";
import { getViewer } from "@/lib/viewer";
import { givingAllowance } from "@/server/reputation";
import { CopyButton } from "@/components/sign-in/copy-button";
import { RankBadge } from "@/components/rank-badge";
import { SkinHead } from "@/components/skin-head";
import { shortDate, timeUntil } from "@/components/profile/format";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="stagger mx-auto box-border flex w-full max-w-[760px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 sm:pt-12 sm:pb-20">
      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 font-pixel text-[32px] leading-[1.05] font-bold sm:text-[44px]">Settings</h1>
        <p className="m-0 max-w-[600px] text-base leading-[1.55] text-ink-2">
          Your mcrep.gg account is your Minecraft Java Edition account. Your name and skin come from Minecraft.
        </p>
      </div>
      <Suspense fallback={<SettingsSkeleton />}>
        <Sections />
      </Suspense>
    </main>
  );
}

async function Sections() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");

  const now = new Date();
  const allowance = await givingAllowance(db, viewer, now);
  const { usedToday, limit, newPlayerDaysLeft, suspension } = allowance;
  const left = Math.max(0, limit - usedToday);
  const profilePath = `/player/${encodeURIComponent(viewer.username)}`;

  return (
    <>
      <Section icon={<LuUserRound aria-hidden className="size-[18px] text-accent" />} title="Minecraft account">
        <div className="flex items-center gap-4">
          <SkinHead uuid={viewer.uuid} username={viewer.username} size={56} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-mono text-lg font-bold [overflow-wrap:anywhere]">{viewer.username}</span>
              <RankBadge rank={viewer.rank} />
            </span>
            <span className="text-[13px] text-muted">Linked Player since {shortDate(viewer.linkedAt)}</span>
          </div>
        </div>
        <Field label="UUID">
          <span className="min-w-0 flex-1 font-mono text-[13px] font-medium text-ink-2 [overflow-wrap:anywhere]">{viewer.uuid}</span>
          <CopyButton text={viewer.uuid} label="Copy UUID" />
        </Field>
      </Section>

      <Section icon={<LuLink aria-hidden className="size-[18px] text-accent" />} title="Profile link">
        <p className="m-0 text-sm leading-normal text-ink-2">Share it with Players you trade with, so they can check your Reputation.</p>
        <Field label="Link">
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-ink-2">mcrep.gg{profilePath}</span>
          <CopyButton text={`https://mcrep.gg${profilePath}`} label="Copy profile link" />
        </Field>
        <Link href={profilePath} className="self-start text-sm font-semibold">
          View your profile
        </Link>
      </Section>

      <Section icon={<LuClock aria-hidden className="size-[18px] text-accent" />} title="Giving Reputation">
        {suspension ? (
          <div role="status" className="flex items-start gap-3 rounded border-2 border-neg-line bg-neg-bg px-4 py-3">
            <LuBan aria-hidden className="mt-0.5 size-4 shrink-0 text-neg" />
            <div className="flex flex-col gap-1 text-sm leading-normal">
              <strong className="text-[#ffd9d9]">
                Staff suspended you from giving Reputation{suspension.until ? ` until ${shortDate(suspension.until)}` : ""}.
              </strong>
              <span className="text-[#f2c4c4]">{suspension.reason}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm font-semibold text-ink">
                {left} of {limit} left to give today
              </span>
              <span className="text-[13px] text-muted">Resets in {timeUntil(allowance.resetsAt, now)}</span>
            </div>
            <div aria-hidden className="flex h-2.5 bg-page">
              <div className="origin-left animate-grow-x bg-accent" style={{ width: `${limit ? (left / limit) * 100 : 0}%` }} />
            </div>
          </div>
        )}
        <p className="m-0 text-[13px] leading-normal text-muted">
          {newPlayerDaysLeft > 0
            ? `New Player limit: ${NEW_PLAYER_DAILY_LIMIT} a day for your first ${NEW_PLAYER_DAYS} days (${newPlayerDaysLeft} ${newPlayerDaysLeft === 1 ? "day" : "days"} to go), then ${DAILY_LIMIT} a day.`
            : `You can give or change up to ${DAILY_LIMIT} Reputation a day. Limits reset at midnight UTC.`}
        </p>
      </Section>

      <Section icon={<LuLogOut aria-hidden className="size-[18px] text-accent" />} title="Sign out">
        <p className="m-0 text-sm leading-normal text-ink-2">
          Signs you out on this browser. Signing in with a new Link Code anywhere else also signs you out here.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-10 cursor-pointer items-center gap-2 rounded border-2 border-line-strong bg-surface-3 px-4 text-sm font-semibold text-ink"
          >
            <LuLogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </form>
      </Section>
    </>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-md border-2 border-line bg-surface p-5 sm:p-6">
      <h2 className="m-0 flex items-center gap-2 text-base font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-[0.08em] text-muted uppercase">{label}</span>
      <div className="flex items-center gap-2.5 rounded border-2 border-line-strong bg-page py-1 pr-1 pl-3">{children}</div>
    </div>
  );
}

/** Same shape as the sections, so nothing jumps when they stream in. */
function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="flex flex-col gap-6">
      {[188, 176, 148, 140].map((h) => (
        <div key={h} style={{ height: h }} className="animate-pulse rounded-md border-2 border-line bg-surface" />
      ))}
    </div>
  );
}
