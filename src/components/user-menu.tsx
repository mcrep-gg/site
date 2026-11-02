"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ArrowDown01Icon, DashboardSquare01Icon, Logout03Icon, Settings01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { signOut } from "@/app/sign-in/actions";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SkinHead } from "./skin-head";

// Adapted from ui lab's dropdown menu (https://lab.xevrion.dev/lab/dropdown-menu): it also opens on hover.

type Item = { label: string; icon: IconSvgElement; href?: string } | { type: "separator" };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Enters over 180ms; leaves in 100ms with a smaller scale change, so closing never holds the eye.
const ENTER = { duration: 0.18, ease: EASE_OUT };
const EXIT = { duration: 0.1, ease: EASE_OUT };
// Letters typed within this window extend the search instead of restarting.
const TYPEAHEAD_RESET = 500;
// Grace period after the pointer leaves, so a diagonal move towards the menu doesn't close it.
const HOVER_CLOSE_DELAY = 150;

// "none" is a hover open: focus stays where it was, e.g. in the search box.
type FocusTarget = "first" | "last" | "menu" | "none";

export function UserMenu({ uuid, username, showAdmin = false }: { uuid: string; username: string; showAdmin?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const id = useId();
  const triggerId = `${id}-trigger`;
  const menuId = `${id}-menu`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const focusTarget = useRef<FocusTarget>("menu");
  const lastPointerType = useRef("");
  // True while the press that started on the trigger is still held, so releasing it over an item picks it.
  const pressFromTrigger = useRef(false);
  const typeahead = useRef({ query: "", timer: 0 });
  const closeTimer = useRef(0);

  const items: Item[] = [
    { label: "Profile", icon: UserIcon, href: `/player/${encodeURIComponent(username)}` },
    { label: "Settings", icon: Settings01Icon, href: "/settings" },
    ...(showAdmin ? [{ label: "Admin", icon: DashboardSquare01Icon, href: "/admin" }] : []),
    { type: "separator" },
    { label: "Sign out", icon: Logout03Icon },
  ];
  const actionable = items.flatMap((item, i) => ("type" in item ? [] : [i]));

  const focusItem = (index: number) => {
    itemRefs.current[index]?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const target = focusTarget.current;
    if (target === "first") focusItem(actionable[0]);
    else if (target === "last") focusItem(actionable[actionable.length - 1]);
    else if (target === "menu") menuRef.current?.focus({ preventScroll: true });
    // Only when the menu opens; the item list is static while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const state = typeahead.current;
    const timer = closeTimer;
    return () => {
      clearTimeout(state.timer);
      clearTimeout(timer.current);
    };
  }, []);

  const openMenu = (target: FocusTarget) => {
    clearTimeout(closeTimer.current);
    focusTarget.current = target;
    setActive(-1);
    setOpen(true);
  };

  const close = (returnFocus: boolean) => {
    clearTimeout(closeTimer.current);
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  // Every way of picking an item ends in a click, so links navigate like links and Sign out runs its action.
  const activate = (index: number) => itemRefs.current[index]?.click();

  const move = (step: number) => {
    const at = actionable.indexOf(active);
    const from = at === -1 ? (step > 0 ? -1 : 0) : at;
    const next = (from + step + actionable.length) % actionable.length;
    focusItem(actionable[next]);
  };

  const search = (char: string) => {
    const state = typeahead.current;
    clearTimeout(state.timer);
    state.query += char.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.query = "";
    }, TYPEAHEAD_RESET);

    // Pressing the same letter repeatedly cycles through its matches.
    const repeated = [...state.query].every((c) => c === state.query[0]);
    const query = repeated ? state.query[0] : state.query;
    const at = actionable.indexOf(active);
    const start = repeated ? at + 1 : Math.max(at, 0);
    for (let n = 0; n < actionable.length; n++) {
      const index = actionable[(start + n) % actionable.length];
      const item = items[index];
      if (!("type" in item) && item.label.toLowerCase().startsWith(query)) {
        focusItem(index);
        return;
      }
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        return;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        return;
      case "Home":
        e.preventDefault();
        focusItem(actionable[0]);
        return;
      case "End":
        e.preventDefault();
        focusItem(actionable[actionable.length - 1]);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (active !== -1) activate(active);
        return;
      case "Escape":
        e.preventDefault();
        close(true);
        return;
      case "Tab":
        // Focus moves on to the next control as usual; the menu just gets out of the way.
        close(false);
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) search(e.key);
  };

  // Both states pass the same keys, so Motion never keeps a stale transform.
  const hidden = { opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.95)" };
  const leaving = { opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.97)", transition: EXIT };

  return (
    <div
      ref={rootRef}
      className="relative inline-flex shrink-0"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        clearTimeout(closeTimer.current);
        if (!open) openMenu("none");
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        closeTimer.current = window.setTimeout(() => close(false), HOVER_CLOSE_DELAY);
      }}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-label={`Account menu, ${username}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onPointerDown={(e) => {
          lastPointerType.current = e.pointerType;
          // Touch opens on click instead, so a scroll that starts on the trigger doesn't pop the menu.
          if (e.pointerType !== "mouse" || e.button !== 0 || e.ctrlKey) return;
          // Keeps focus off the trigger; hovering has already opened the menu.
          e.preventDefault();
          pressFromTrigger.current = true;
          const release = () => {
            pressFromTrigger.current = false;
          };
          // Window listeners run after React's, so an item's pointerup still sees the flag set.
          window.addEventListener("pointerup", release, { once: true });
          window.addEventListener("pointercancel", release, { once: true });
          if (!open) openMenu("menu");
        }}
        onClick={() => {
          const pointer = lastPointerType.current;
          lastPointerType.current = "";
          // Mouse presses were handled on pointerdown. This covers touch and assistive tech.
          if (pointer === "mouse") return;
          if (open) close(false);
          else openMenu(pointer ? "menu" : "first");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            openMenu("first");
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            openMenu("last");
          }
        }}
        className="flex h-11 cursor-pointer touch-manipulation items-center gap-2 rounded border-2 border-line-strong bg-surface py-0 pr-2 pl-[7px] font-mono text-sm font-semibold text-ink select-none"
      >
        <SkinHead uuid={uuid} username={username} size={26} />
        <span className="hidden sm:inline">{username}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          aria-hidden
          className={`text-muted transition-[rotate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <Panel
            ref={menuRef}
            id={menuId}
            labelledBy={triggerId}
            initial={hidden}
            exit={leaving}
            onKeyDown={onMenuKeyDown}
            onPointerLeave={(e) => {
              if (e.pointerType === "touch" || active === -1) return;
              // Parks focus on the menu so the highlight clears but arrow keys keep working.
              menuRef.current?.focus({ preventScroll: true });
              setActive(-1);
            }}
            onBlur={(e) => {
              // Covers clicking outside, tabbing away and leaving the window.
              if (!rootRef.current?.contains(e.relatedTarget as Node | null)) close(false);
            }}
          >
            {items.map((item, i) => {
              if ("type" in item) return <div key={`separator-${i}`} role="separator" className="-mx-1 my-1 h-0.5 bg-line-strong" />;
              const highlighted = active === i;
              const props = {
                ref: (el: HTMLElement | null) => {
                  itemRefs.current[i] = el;
                },
                role: "menuitem",
                tabIndex: -1,
                onFocus: () => setActive(i),
                onPointerMove: (e: React.PointerEvent) => {
                  if (e.pointerType === "touch" || highlighted) return;
                  focusItem(i);
                },
                onPointerUp: () => {
                  if (pressFromTrigger.current) activate(i);
                },
                // No transition on the highlight: it moves on every hover, so any easing reads as lag.
                className: `flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[3px] border-0 bg-transparent px-2.5 text-left font-sans text-sm font-semibold no-underline outline-hidden select-none hover:text-ink ${
                  highlighted ? "bg-surface-3 text-ink" : "text-ink-2"
                }`,
              };
              const content = (
                <>
                  <HugeiconsIcon icon={item.icon} size={18} aria-hidden className={`shrink-0 ${highlighted ? "text-accent" : "text-muted"}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                </>
              );
              return item.href ? (
                <Link key={item.label} href={item.href} {...props} onClick={() => close(false)}>
                  {content}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  {...props}
                  onClick={() => {
                    close(false);
                    startTransition(async () => {
                      await signOut();
                      router.refresh();
                    });
                  }}
                >
                  {content}
                </button>
              );
            })}
          </Panel>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({
  ref,
  id,
  labelledBy,
  initial,
  exit,
  onKeyDown,
  onPointerLeave,
  onBlur,
  children,
}: {
  ref: React.Ref<HTMLDivElement>;
  id: string;
  labelledBy: string;
  initial: { opacity: number; transform: string };
  exit: { opacity: number; transform: string; transition: typeof EXIT };
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onBlur: (e: React.FocusEvent) => void;
  children: React.ReactNode;
}) {
  // A closing menu stops taking pointer input at once, so it never blocks the next click while it fades.
  const isPresent = useIsPresent();
  return (
    <motion.div
      ref={ref}
      id={id}
      role="menu"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      initial={initial}
      animate={{ opacity: 1, transform: "scale(1)" }}
      exit={exit}
      transition={ENTER}
      onKeyDown={onKeyDown}
      onPointerLeave={onPointerLeave}
      onBlur={onBlur}
      // Grows out of the trigger's corner, not its own center.
      style={{ transformOrigin: "top right" }}
      // The ::before strip bridges the gap under the trigger, so hovering across it keeps the menu open.
      className={`absolute top-full right-0 z-50 mt-1.5 w-52 rounded-md border-2 border-line-strong bg-surface p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] outline-hidden before:absolute before:inset-x-0 before:-top-2 before:h-2 ${
        isPresent ? "" : "pointer-events-none"
      }`}
    >
      {children}
    </motion.div>
  );
}
