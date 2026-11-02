"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { LuCircleAlert, LuLoaderCircle } from "react-icons/lu";
import { IDLE, type ActionResult } from "@/components/profile/types";

// An armed button that isn't confirmed goes back to normal, so a stray click later can't remove anything.
const DISARM_AFTER_MS = 4000;

const tones = {
  default: "border-line-strong bg-surface-3 text-ink hover:border-field-line",
  danger: "border-neg-line bg-neg-bg text-neg hover:border-neg",
} as const;

/**
 * Runs an Admin Server Action from one button and shows its error underneath.
 * With `confirm`, the first press only arms it and asks again: for anything that can't be undone.
 */
export function ActionButton({
  action,
  icon,
  label,
  confirm,
  tone = "default",
}: {
  action: () => Promise<ActionResult>;
  icon?: ReactNode;
  label: string;
  confirm?: string;
  tone?: keyof typeof tones;
}) {
  const [state, formAction, pending] = useActionState<ActionResult>(() => action(), IDLE);
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const arm = () => {
    setArmed(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setArmed(false), DISARM_AFTER_MS);
  };

  const needsConfirm = !!confirm && !armed;
  return (
    <form
      action={() => {
        clearTimeout(timer.current);
        setArmed(false);
        formAction();
      }}
      className="flex flex-col gap-1.5"
    >
      <button
        type="submit"
        onClick={(e) => {
          if (!needsConfirm) return;
          // Not type="button": React re-renders before the browser acts on the click, so a type that flips to "submit"
          // on arming would submit this same click.
          e.preventDefault();
          arm();
        }}
        disabled={pending}
        aria-live="polite"
        className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded border-2 px-3.5 text-sm font-semibold whitespace-nowrap disabled:cursor-wait disabled:opacity-60 ${
          armed ? "border-neg bg-neg text-neg-ink hover:border-neg" : tones[tone]
        }`}
      >
        {pending ? <LuLoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : icon}
        {armed ? confirm : label}
      </button>
      {state.status === "error" && (
        <p role="alert" className="m-0 flex max-w-[320px] items-start gap-1.5 text-[13px] leading-snug text-neg">
          <LuCircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {state.message}
        </p>
      )}
    </form>
  );
}
