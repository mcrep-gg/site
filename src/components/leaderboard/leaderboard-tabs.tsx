"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const TABS = [
  { id: "highest", label: "Highest" },
  { id: "lowest", label: "Lowest" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PILL = { type: "spring", duration: 0.35, bounce: 0.15 } as const;

/**
 * Both lists side by side on wider screens. Below `md` the lists become tabs and only the chosen one shows.
 * The lists are rendered on the server and passed in.
 */
export function LeaderboardTabs({ highest, lowest }: { highest: ReactNode; lowest: ReactNode }) {
  const [tab, setTab] = useState<TabId>("highest");
  const reduceMotion = useReducedMotion();
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ highest: null, lowest: null });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  }

  const panels: Record<TabId, ReactNode> = { highest, lowest };

  return (
    <>
      <div
        role="tablist"
        aria-label="Leaderboard lists"
        onKeyDown={onKeyDown}
        className="flex gap-1 rounded-md border-2 border-line bg-surface p-1 md:hidden"
      >
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`leaderboard-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`leaderboard-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.id)}
              className="relative flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border-0 bg-transparent text-sm font-bold text-ink"
            >
              {on && (
                <motion.span
                  layoutId="leaderboard-tab"
                  aria-hidden
                  transition={reduceMotion ? { duration: 0 } : PILL}
                  className="absolute inset-0 rounded bg-ink"
                />
              )}
              {/* Difference blending turns the label dark exactly where the pill is under it, even mid-slide. */}
              <span className="relative mix-blend-difference">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {TABS.map((t) => (
          <div
            key={t.id}
            id={`leaderboard-panel-${t.id}`}
            className={`min-w-0 flex-[1_1_400px] ${tab === t.id ? "" : "max-md:hidden"}`}
          >
            {panels[t.id]}
          </div>
        ))}
      </div>
    </>
  );
}
