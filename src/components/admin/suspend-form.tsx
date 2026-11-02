"use client";

import { useActionState, useId, useState } from "react";
import { LuBan, LuCircleAlert, LuLoaderCircle } from "react-icons/lu";
import { suspendAction } from "@/app/admin/actions";
import { SUSPENSION_LENGTHS, SUSPENSION_REASON_MAX } from "@/lib/admin";
import { IDLE } from "@/components/profile/types";

/** Suspends a Player from giving, changing or removing Reputation. */
export function SuspendForm({ playerUuid, username }: { playerUuid: string; username: string }) {
  const [state, formAction, pending] = useActionState(suspendAction.bind(null, playerUuid), IDLE);
  const [reason, setReason] = useState("");
  const id = useId();
  const over = reason.trim().length > SUSPENSION_REASON_MAX;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-reason`} className="text-xs font-bold tracking-[0.08em] text-muted uppercase">
          Reason
        </label>
        <textarea
          id={`${id}-reason`}
          name="reason"
          required
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-describedby={`${id}-reason-hint`}
          placeholder="e.g. Giving Reputation from alt accounts"
          className="resize-y rounded border-2 border-field-line bg-page px-3 py-2.5 font-sans text-sm leading-normal text-ink outline-none focus:border-accent"
        />
        <span id={`${id}-reason-hint`} className={`text-[13px] ${over ? "text-neg" : "text-muted"}`}>
          {username} sees this on their Settings page. {reason.trim().length} / {SUSPENSION_REASON_MAX}
        </span>
      </div>

      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-xs font-bold tracking-[0.08em] text-muted uppercase">Length</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SUSPENSION_LENGTHS).map(([value, label]) => (
            <label
              key={value}
              className="flex h-10 cursor-pointer items-center gap-2 rounded border-2 border-line-strong bg-page px-3 text-sm font-semibold text-ink-2 has-checked:border-accent has-checked:bg-accent-bg has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input type="radio" name="length" value={value} defaultChecked={value === "7"} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="m-0 flex items-start gap-1.5 text-sm leading-snug text-neg">
          <LuCircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || over}
        className="flex h-11 cursor-pointer items-center justify-center gap-2 self-start rounded border-2 border-neg-line bg-neg-bg px-4 text-sm font-bold text-neg hover:border-neg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <LuLoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <LuBan aria-hidden className="size-4" />}
        Suspend {username}
      </button>
    </form>
  );
}
