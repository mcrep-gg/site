"use client";

import { useActionState } from "react";
import { LuCheck, LuCircleAlert, LuLoaderCircle } from "react-icons/lu";
import { setRankAction } from "@/app/admin/actions";
import type { StoredRank } from "@/lib/ranks";
import { IDLE } from "@/components/profile/types";

const OPTIONS = [
  { value: "none", label: "No rank", hint: "A regular Player." },
  { value: "staff", label: "Staff", hint: "Works Reports, suspends Players and removes Reputation." },
  { value: "pro", label: "Pro", hint: "A donator. Gets the Pro badge." },
] as const;

/** Gives a Player Staff or Pro, or takes their rank away. Admins only. */
export function RankForm({ playerUuid, username, rank }: { playerUuid: string; username: string; rank: StoredRank | null }) {
  const [state, formAction, pending] = useActionState(setRankAction.bind(null, playerUuid), IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-xs font-bold tracking-[0.08em] text-muted uppercase">Rank for {username}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer flex-col gap-1 rounded border-2 border-line-strong bg-page px-3 py-2.5 has-checked:border-accent has-checked:bg-accent-bg has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <input type="radio" name="rank" value={o.value} defaultChecked={(rank ?? "none") === o.value} className="accent-accent" />
                {o.label}
              </span>
              <span className="text-[13px] leading-snug text-muted">{o.hint}</span>
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
      {state.status === "ok" && (
        <p role="status" className="m-0 flex items-center gap-1.5 text-sm text-pos">
          <LuCheck aria-hidden className="size-4 shrink-0" />
          Rank saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="shadow-block flex h-11 cursor-pointer items-center justify-center gap-2 self-start rounded border-0 bg-accent px-4 text-sm font-bold text-accent-ink hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
      >
        {pending && <LuLoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
        Save rank
      </button>
    </form>
  );
}
