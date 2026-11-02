import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line-soft px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-x-6 gap-y-3 text-[13px] leading-normal text-muted">
        <span className="max-w-[640px]">
          mcrep.gg is a fan-made project. Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
        </span>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
