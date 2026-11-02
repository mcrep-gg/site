"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/** One name from the history, its date already formatted on the server. */
export type PastNameView = { name: string; when: string };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const ENTER = { duration: 0.18, ease: EASE_OUT };
const EXIT = { duration: 0.1, ease: EASE_OUT };

/** The little arrow next to a Player's name that lists the names they had before, like Steam's. */
export function NameHistory({ username, names }: { username: string; names: PastNameView[] }) {
  const reduceMotion = useReducedMotion();
  const id = useId();
  const panelId = `${id}-panel`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hidden = { opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.95)" };
  const leaving = { opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.97)", transition: EXIT };

  return (
    <div
      ref={rootRef}
      // Not positioned itself, so the panel lines up with the name's block rather than the arrow.
      className="ml-2 inline-flex align-middle"
      onBlur={(e) => {
        // Tabbing away closes it, but moving focus inside the panel doesn't.
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Past names of ${username}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 cursor-pointer touch-manipulation items-center justify-center rounded border-2 border-line-strong bg-surface-3 p-0 text-muted hover:text-ink aria-expanded:text-ink"
      >
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={18}
          aria-hidden
          className={`transition-[rotate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <Panel id={panelId} initial={hidden} exit={leaving}>
            <p className="m-0 px-2.5 pt-1.5 pb-2 text-xs font-bold tracking-[0.08em] text-muted uppercase">Also known as</p>
            <ol className="m-0 flex list-none flex-col p-0">
              {names.map((n, i) => (
                <li key={`${n.name}-${i}`} className="flex items-baseline justify-between gap-4 rounded-[3px] px-2.5 py-1.5">
                  <span className={`font-mono text-sm font-semibold [overflow-wrap:anywhere] ${i === 0 ? "text-ink" : "text-ink-2"}`}>{n.name}</span>
                  <span className="shrink-0 text-xs text-muted">{n.when}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({
  id,
  initial,
  exit,
  children,
}: {
  id: string;
  initial: { opacity: number; transform: string };
  exit: { opacity: number; transform: string; transition: typeof EXIT };
  children: React.ReactNode;
}) {
  // A closing panel stops taking pointer input at once, so it never blocks the next click while it fades.
  const isPresent = useIsPresent();
  return (
    <motion.div
      id={id}
      initial={initial}
      animate={{ opacity: 1, transform: "scale(1)" }}
      exit={exit}
      transition={ENTER}
      // Grows out of the trigger's corner, not its own center.
      style={{ transformOrigin: "top left" }}
      className={`absolute top-full left-0 z-50 mt-2 w-60 rounded-md border-2 border-line-strong bg-surface p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${
        isPresent ? "" : "pointer-events-none"
      }`}
    >
      {children}
    </motion.div>
  );
}
