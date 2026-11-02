"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { LuSmilePlus } from "react-icons/lu";
import { reactAction } from "@/app/player/[name]/actions";
import { REACTION_KEYS, REACTIONS, type Reaction } from "@/lib/rules";
import type { ReactionView } from "./types";

const pill = "inline-flex items-center gap-1.5 rounded border-2 px-2 text-sm font-semibold tabular-nums";
const pillOn = "border-accent-line bg-accent-bg text-accent";
const pillOff = "border-line bg-surface-2 text-ink-2";

/** The viewer's reaction flipped: counts change straight away, then the server's numbers replace them. */
function toggle(list: ReactionView[], emoji: Reaction): ReactionView[] {
  const found = list.find((r) => r.emoji === emoji);
  if (!found) {
    return [...list, { emoji, count: 1, mine: true }].sort((a, b) => REACTION_KEYS.indexOf(a.emoji) - REACTION_KEYS.indexOf(b.emoji));
  }
  const next = { emoji, count: found.count + (found.mine ? -1 : 1), mine: !found.mine };
  return list.map((r) => (r.emoji === emoji ? next : r)).filter((r) => r.count > 0);
}

/**
 * The emoji reactions on one +1/−1. Signed-in Players can tap a reaction to add or take back theirs,
 * or pick a new one; everyone else just sees the counts.
 */
export function ReactionBar({ reputationId, reactions, canReact }: { reputationId: string; reactions: ReactionView[]; canReact: boolean }) {
  const [shown, flip] = useOptimistic(reactions, toggle);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  if (!canReact) return <ReactionCounts reactions={reactions} />;

  const react = (emoji: Reaction) => {
    setPicking(false);
    setError(null);
    startTransition(async () => {
      flip(emoji);
      const result = await reactAction(reputationId, emoji);
      if (result.status === "error") setError(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((r) => (
          <button
            key={r.emoji}
            type="button"
            aria-pressed={r.mine}
            aria-label={`${REACTIONS[r.emoji].label}: ${r.count}`}
            title={r.mine ? "Take back your reaction" : `React with ${REACTIONS[r.emoji].label}`}
            onClick={() => react(r.emoji)}
            className={`${pill} h-9 cursor-pointer ${r.mine ? pillOn : `${pillOff} hover:border-line-strong`}`}
          >
            <span aria-hidden>{REACTIONS[r.emoji].emoji}</span>
            <span aria-hidden>{r.count}</span>
          </button>
        ))}
        <Picker open={picking} setOpen={setPicking} onPick={react} mine={shown.filter((r) => r.mine).map((r) => r.emoji)} />
      </div>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-neg">
          {error}
        </p>
      )}
    </div>
  );
}

/** Read-only reaction counts, for signed-out visitors and the Home feed. */
export function ReactionCounts({ reactions }: { reactions: { emoji: Reaction; count: number }[] }) {
  if (reactions.length === 0) return null;
  return (
    <ul aria-label="Reactions" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {reactions.map((r) => (
        <li key={r.emoji} className={`${pill} h-7 ${pillOff}`} aria-label={`${REACTIONS[r.emoji].label}: ${r.count}`}>
          <span aria-hidden>{REACTIONS[r.emoji].emoji}</span>
          <span aria-hidden>{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** The "add a reaction" button and the row of emoji it opens. Closes on Escape or a click outside. */
function Picker({
  open,
  setOpen,
  onPick,
  mine,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onPick: (emoji: Reaction) => void;
  mine: Reaction[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    // Opens inline, not floating: the entry list clips anything that overflows it.
    <div ref={ref} className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Add a reaction"
        title="Add a reaction"
        onClick={() => setOpen(!open)}
        className={`${pill} h-9 cursor-pointer ${open ? "border-line-strong bg-surface-3 text-ink" : "border-transparent bg-transparent text-muted hover:text-ink"}`}
      >
        <LuSmilePlus aria-hidden className="size-[18px]" />
      </button>
      {open && (
        <div
          role="group"
          aria-label="Pick a reaction"
          className="flex gap-0.5 rounded-md border-2 border-line-strong bg-surface-2 p-0.5"
        >
          {REACTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={mine.includes(key)}
              aria-label={REACTIONS[key].label}
              title={REACTIONS[key].label}
              onClick={() => onPick(key)}
              className={`flex size-10 cursor-pointer items-center justify-center rounded text-xl hover:bg-surface-3 ${
                mine.includes(key) ? "bg-accent-bg" : "bg-transparent"
              }`}
            >
              <span aria-hidden>{REACTIONS[key].emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
