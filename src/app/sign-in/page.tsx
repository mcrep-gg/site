import type { Metadata } from "next";
import { Suspense } from "react";
import { LuServer } from "react-icons/lu";
import { CopyButton } from "@/components/sign-in/copy-button";
import { SignInCard } from "@/components/sign-in/sign-in-card";
import { SkinHead } from "@/components/skin-head";
import { LINK_SERVER_ADDRESS } from "@/lib/config";
import { getViewer } from "@/lib/viewer";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="stagger mx-auto flex w-full max-w-[1040px] flex-col gap-8 px-4 pt-7 pb-12 sm:px-6 sm:pt-14 sm:pb-20">
      <div className="flex max-w-[680px] flex-col gap-3">
        <h1 className="font-pixel text-[30px] leading-[1.08] font-bold sm:text-[44px]">Sign in with your Minecraft account</h1>
        <p className="text-[17px] leading-relaxed text-ink-2">
          No password and no Microsoft login. You prove the account is yours by joining our server for a few seconds.
        </p>
      </div>
      <Suspense fallback={null}>
        <AlreadySignedIn />
      </Suspense>
      <div className="flex flex-wrap items-start gap-6">
        <ol className="stagger flex min-w-0 [--stagger-base:120ms] flex-[1_1_420px] list-none flex-col gap-3.5">
          <Step n={1} title={`Join the server ${LINK_SERVER_ADDRESS} in Minecraft`}>
            <p className="text-sm leading-normal text-muted">In Java Edition, open Multiplayer, choose Add Server and use this address.</p>
            <div className="flex items-center gap-2.5 rounded border-2 border-line-strong bg-page py-1 pr-1 pl-3">
              <LuServer aria-hidden className="size-4 text-muted" />
              <span className="min-w-0 flex-1 font-mono text-base font-bold">{LINK_SERVER_ADDRESS}</span>
              <CopyButton text={LINK_SERVER_ADDRESS} label="Copy server address" />
            </div>
          </Step>
          <Step n={2} title="Type /link in chat">
            <p className="text-sm leading-normal text-muted">Press T to open chat, type the command and press Enter. Your code appears in chat.</p>
            <div className="flex items-center gap-0.5 rounded-[2px] bg-black/55 px-3 py-2.5 font-mono text-base font-medium text-white">
              <span>/link</span>
              <span aria-hidden className="ml-0.5 h-[18px] w-[9px] animate-blink bg-ink" />
            </div>
          </Step>
          <Step n={3} title="Enter the code you are given">
            <p className="text-sm leading-normal text-muted">Codes are 6 characters. Each one works once and expires after 5 minutes.</p>
          </Step>
        </ol>
        <SignInCard />
      </div>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-md border-2 border-line bg-surface p-5">
      <span
        aria-hidden
        className="shadow-block flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-accent font-pixel text-xl font-bold text-accent-ink"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {children}
      </div>
    </li>
  );
}

async function AlreadySignedIn() {
  const viewer = await getViewer();
  if (!viewer) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border-2 border-line bg-surface px-4 py-3">
      <SkinHead uuid={viewer.uuid} username={viewer.username} size={28} />
      <span className="flex-1 text-sm text-ink-2">
        You&apos;re already signed in as <strong className="font-mono text-ink">{viewer.username}</strong>.
      </span>
      <form action={signOut}>
        <button type="submit" className="h-10 rounded border-2 border-line-strong px-4 text-sm font-semibold text-ink">
          Sign out
        </button>
      </form>
    </div>
  );
}
