"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LuCheck, LuCircleX, LuClock, LuShieldCheck } from "react-icons/lu";
import { signIn, type SignInState } from "@/app/sign-in/actions";
import { SkinHead } from "@/components/skin-head";

const errors = {
  expired: {
    icon: LuClock,
    title: "This code has expired",
    body: (
      <>
        Codes only work for 5 minutes. Type <Cmd>/link</Cmd> in-game again to get a new one.
      </>
    ),
  },
  used: {
    icon: LuCircleX,
    title: "This code was already used",
    body: (
      <>
        Each code works once. Type <Cmd>/link</Cmd> again for a fresh code. If you didn&apos;t use it yourself, get a new one right away.
      </>
    ),
  },
  invalid: {
    icon: LuCircleX,
    title: "That code doesn't exist",
    body: (
      <>
        Check you typed all 6 characters from chat, or type <Cmd>/link</Cmd> again for a new code.
      </>
    ),
  },
} as const;

export function SignInCard() {
  const [state, action, pending] = useActionState(signIn, { status: "idle" } as SignInState);
  const [code, setCode] = useState("");
  const [edited, setEdited] = useState(false);

  if (state.status === "success") {
    return (
      <Card success>
        <div role="status" className="flex flex-col items-center gap-3.5 text-center">
          <div className="flex size-14 items-center justify-center rounded border-2 border-pos-line bg-pos-bg text-pos">
            <LuCheck aria-hidden className="size-7" strokeWidth={2.5} />
          </div>
          <h2 className="font-pixel text-[26px] font-bold">You&apos;re signed in</h2>
          <div className="flex items-center gap-2.5 rounded border-2 border-line-strong bg-page py-2 pr-3.5 pl-2">
            <SkinHead uuid={state.uuid} username={state.username} size={36} />
            <span className="font-mono text-base font-bold">{state.username}</span>
          </div>
          <p className="leading-relaxed text-ink-2">You&apos;re now a Linked Player. You&apos;ll stay signed in on this device unless you don&apos;t visit for 90 days.</p>
          <div className="mt-1 flex w-full flex-col gap-2.5">
            <Link
              href={`/player/${state.username}`}
              className="shadow-block flex h-[52px] items-center justify-center rounded bg-accent text-base font-bold text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink"
            >
              Go to my profile
            </Link>
            <Link
              href="/"
              className="flex h-12 items-center justify-center rounded border-2 border-line-strong text-[15px] font-semibold text-ink no-underline hover:text-ink"
            >
              Look up a Player
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  const error = state.status === "error" && !edited ? errors[state.error] : null;
  const value = edited || state.status !== "error" ? code : state.code.toUpperCase();

  return (
    <Card>
      <form action={action} className="flex flex-col gap-4" onSubmit={() => setEdited(false)}>
        <h2 id="code-title" className="font-pixel text-2xl font-bold">
          Enter your Link Code
        </h2>
        <div className="flex flex-col gap-2">
          <label htmlFor="link-code" className="text-sm font-semibold">
            Link Code
          </label>
          <input
            id="link-code"
            name="code"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            maxLength={6}
            spellCheck={false}
            required
            value={value}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
              setEdited(true);
            }}
            placeholder="ABC123"
            aria-invalid={!!error}
            aria-describedby="code-msg"
            className={`h-16 w-full rounded border-2 bg-page px-4 text-center font-mono text-[30px] font-bold tracking-[0.35em] text-ink uppercase outline-none ${
              error ? "border-neg" : "border-field-line"
            }`}
          />
        </div>
        <div id="code-msg">
          {error && (
            <div role="alert" className="flex gap-2.5 rounded border-2 border-neg-line bg-neg-bg px-3.5 py-3">
              <error.icon aria-hidden className="mt-px size-[18px] shrink-0 text-neg" />
              <div className="flex flex-col gap-1">
                <strong className="text-sm text-[#ffd9d9]">{error.title}</strong>
                <span className="text-[13px] leading-normal text-[#f2c4c4]">{error.body}</span>
              </div>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="shadow-block flex h-[52px] items-center justify-center gap-2 rounded bg-accent text-base font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-70"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
        <div className="flex flex-col gap-2 pt-1 text-[13px] leading-normal text-muted">
          <span className="flex gap-2">
            <LuClock aria-hidden className="mt-0.5 size-[15px] shrink-0 text-pos" />
            You&apos;ll stay signed in on this device unless you don&apos;t visit for 90 days.
          </span>
          <span className="flex gap-2">
            <LuShieldCheck aria-hidden className="mt-0.5 size-[15px] shrink-0 text-pos" />
            mcrep.gg never asks for your password.
          </span>
        </div>
      </form>
    </Card>
  );
}

function Card({ success, children }: { success?: boolean; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="code-title"
      className={`min-w-0 flex-[1_1_340px] rounded-md border-2 bg-surface p-6 ${success ? "border-pos-line" : "border-line-strong"}`}
    >
      {children}
    </section>
  );
}

function Cmd({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-white">{children}</code>;
}
