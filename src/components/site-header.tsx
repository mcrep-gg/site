import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LuLogIn, LuSearch, LuTrophy } from "react-icons/lu";
import { isAdmin } from "@/lib/admin";
import { getViewer } from "@/lib/viewer";
import { HeaderSearch } from "./header-search";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="animate-fade-in border-b-2 border-line-soft bg-page">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-1 px-3 sm:gap-4 sm:px-6">
        <Link href="/" aria-label="mcrep.gg home" className="flex shrink-0 items-center no-underline">
          <Image src="/logo.svg" alt="" width={136} height={32} priority />
        </Link>
        <Suspense fallback={null}>
          <HeaderSearch />
        </Suspense>
        <div className="flex-1" />
        <Link href="/" aria-label="Search Players" className="flex size-11 items-center justify-center rounded text-ink-2 sm:hidden">
          <LuSearch aria-hidden className="size-5" />
        </Link>
        <Link href="/leaderboard" className="flex h-11 items-center gap-2 rounded px-2.5 text-sm font-semibold text-ink-2 no-underline hover:text-ink">
          <LuTrophy aria-hidden className="size-5" />
          <span className="hidden sm:inline">Leaderboard</span>
        </Link>
        <Suspense fallback={<div className="h-11 w-24" aria-hidden />}>
          <ViewerButton />
        </Suspense>
      </div>
    </header>
  );
}

async function ViewerButton() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <Link
        href="/sign-in"
        className="press shadow-block flex h-11 shrink-0 items-center gap-2 rounded bg-accent px-4 text-sm font-bold text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink"
      >
        <LuLogIn aria-hidden className="size-4" />
        Sign in
      </Link>
    );
  }
  return <UserMenu uuid={viewer.uuid} username={viewer.username} isAdmin={isAdmin(viewer.uuid)} />;
}
