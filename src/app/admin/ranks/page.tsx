import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LuCrown, LuGem, LuSearch, LuShield } from "react-icons/lu";
import type { IconType } from "react-icons";
import { db } from "@/db";
import { RANK_LABELS, type Rank } from "@/lib/ranks";
import { listRanked, type RankedPlayer } from "@/server/ranks";
import { adminPlayerPath, PageTitle, Panel } from "@/components/admin/ui";
import { SkinHead } from "@/components/skin-head";
import { shortDate } from "@/components/profile/format";
import { requireAdmin } from "../data";

export const metadata: Metadata = { title: "Ranks" };

const GROUPS: { rank: Rank; icon: IconType; iconClass: string; about: string; empty: string }[] = [
  {
    rank: "admin",
    icon: LuCrown,
    iconClass: "text-admin",
    about: "Run the site. Listed in ADMIN_UUIDS, so they can only be changed by redeploying.",
    empty: "No Admin has linked yet.",
  },
  {
    rank: "staff",
    icon: LuShield,
    iconClass: "text-staff",
    about: "Work Reports, suspend Players and remove Reputation. They can't give out ranks.",
    empty: "No Staff yet.",
  },
  { rank: "pro", icon: LuGem, iconClass: "text-pro", about: "Donators. They get the Pro badge.", empty: "No Pro Players yet." },
];

export default function RanksPage() {
  return (
    <>
      <PageTitle title="Ranks">
        Everyone with a rank. To give or take one away, find the Player and use the Rank panel on their page.
      </PageTitle>
      <Suspense fallback={<div aria-busy="true" aria-label="Loading ranks" className="h-96 rounded-md border-2 border-line bg-surface" />}>
        <Ranks />
      </Suspense>
    </>
  );
}

async function Ranks() {
  await requireAdmin();
  const ranked = await listRanked(db);

  return (
    <>
      <Link
        href="/admin/players"
        className="shadow-block flex h-11 items-center gap-2 self-start rounded bg-accent px-4 text-sm font-bold text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink"
      >
        <LuSearch aria-hidden className="size-4" />
        Find a Player
      </Link>
      {GROUPS.map(({ rank, icon: Icon, iconClass, about, empty }) => {
        const members = ranked.filter((p) => p.rank === rank);
        return (
          <Panel
            key={rank}
            title={
              <>
                <Icon aria-hidden className={`size-[18px] ${iconClass}`} /> {RANK_LABELS[rank]} ({members.length})
              </>
            }
          >
            <p className="m-0 -mt-1 text-sm leading-normal text-muted">{about}</p>
            {members.length ? (
              <ul className="m-0 flex list-none flex-col divide-y-2 divide-line overflow-hidden rounded border-2 border-line-strong bg-page p-0">
                {members.map((p) => (
                  <Member key={p.uuid} player={p} />
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-ink-2">{empty}</p>
            )}
          </Panel>
        );
      })}
    </>
  );
}

function Member({ player: p }: { player: RankedPlayer }) {
  return (
    <li>
      <Link href={adminPlayerPath(p.uuid)} className="flex min-h-14 items-center gap-3 px-3.5 py-2 text-ink no-underline hover:bg-surface-3 hover:text-ink">
        <SkinHead uuid={p.uuid} username={p.username} size={32} />
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold">{p.username}</span>
        {p.setAt && (
          <span className="shrink-0 text-[13px] text-muted max-sm:hidden">
            Since {shortDate(p.setAt)}
            {p.setBy ? `, by ${p.setBy.username}` : ""}
          </span>
        )}
      </Link>
    </li>
  );
}
