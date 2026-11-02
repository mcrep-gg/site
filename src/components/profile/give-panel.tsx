"use client";

import { useState } from "react";
import { LuBan, LuClock, LuPencil, LuTrash2 } from "react-icons/lu";
import { ValueChip } from "@/components/reputation";
import type { Value } from "@/lib/rules";
import { GiveDialog, RemoveDialog } from "./give-dialog";
import type { GiveContext } from "./types";

type Open = { kind: "give"; choice: Value } | { kind: "remove" } | null;

const bigButton =
  "shadow-block flex h-[52px] flex-1 cursor-pointer items-center justify-center rounded border-2 font-mono text-[22px] font-bold";

/** The hero card's action panel for a signed-in viewer on someone else's profile: give, or change/remove what they gave. */
export function GivePanel({ ctx, title }: { ctx: GiveContext; title: string }) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const { existing } = ctx;

  return (
    <>
      {existing ? (
        <div key="given" className="flex animate-fade-in flex-col gap-3">
          <h2 className="m-0 text-base font-bold [overflow-wrap:anywhere]">Reputation you gave {ctx.target.username}</h2>
          <div className="flex items-start gap-2.5">
            <ValueChip value={existing.value} />
            <div className="flex min-w-0 flex-col gap-1">
              {existing.reason ? (
                <p className="m-0 text-sm leading-normal [overflow-wrap:anywhere]">{existing.reason}</p>
              ) : (
                <p className="m-0 text-sm text-muted italic">No reason given</p>
              )}
              <span className="text-xs text-muted">Given {existing.when}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen({ kind: "give", choice: existing.value === 1 ? -1 : 1 })}
              className="flex h-11 flex-auto cursor-pointer items-center justify-center gap-2 rounded border-2 border-field-line bg-surface px-3.5 text-sm font-semibold text-ink"
            >
              <LuPencil aria-hidden className="size-[15px]" />
              Change +1/−1
            </button>
            <button
              type="button"
              onClick={() => setOpen(ctx.suspension ? { kind: "give", choice: existing.value } : { kind: "remove" })}
              className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded border-2 border-neg-line bg-transparent px-3.5 text-sm font-semibold text-neg"
            >
              <LuTrash2 aria-hidden className="size-[15px]" />
              Remove
            </button>
          </div>
          <span className="text-xs leading-normal text-muted">
            You can give each Player only one +1 or −1. Changing it replaces this one.
          </span>
        </div>
      ) : (
        <div key="give" className="flex animate-fade-in flex-col gap-3">
          <h2 className="m-0 text-base font-bold [overflow-wrap:anywhere]">{title}</h2>
          <div className="flex gap-2.5">
            <button
              type="button"
              aria-label="Give +1 Reputation"
              onClick={() => setOpen({ kind: "give", choice: 1 })}
              className={`${bigButton} border-pos-line bg-pos-bg text-pos`}
            >
              +1
            </button>
            <button
              type="button"
              aria-label="Give −1 Reputation"
              onClick={() => setOpen({ kind: "give", choice: -1 })}
              className={`${bigButton} border-neg-line bg-neg-bg text-neg`}
            >
              −1
            </button>
          </div>
          {ctx.suspension ? (
            <span className="flex items-center gap-1.5 text-[13px] text-neg">
              <LuBan aria-hidden className="size-3.5" />
              An Admin suspended you from giving Reputation
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <LuClock aria-hidden className="size-3.5" />
              {Math.max(0, ctx.limit - ctx.usedToday)} of {ctx.limit} left to give today
            </span>
          )}
        </div>
      )}

      {open?.kind === "give" && <GiveDialog ctx={ctx} initialChoice={open.choice} onClose={close} />}
      {open?.kind === "remove" && <RemoveDialog ctx={ctx} onClose={close} />}
    </>
  );
}
