"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LuCircleAlert, LuX } from "react-icons/lu";
import { SkinHead } from "@/components/skin-head";
import { ValueChip } from "@/components/reputation";
import type { EntryView } from "./types";

/**
 * A modal built on the native <dialog>: centered on wider screens, a bottom sheet on phones.
 * Mount it only while open; it opens itself on mount, and Escape, the backdrop and Close all call onClose.
 */
export function Dialog({ labelledBy, onClose, children }: { labelledBy: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    // No close() in cleanup: it fires a "close" event later, which would shut the dialog again after
    // Strict Mode's remount. Unmounting removes the element, and that takes it out of the top layer.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // Close on a backdrop click, but not when a text selection drag merely ends outside the panel.
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
      }}
      className="m-auto animate-dialog-in max-h-[calc(100dvh-48px)] w-[calc(100%-48px)] max-w-[480px] overflow-y-auto rounded-md border-2 border-line-strong bg-surface p-0 text-ink shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop:bg-backdrop/80 max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:animate-sheet-in max-sm:rounded-b-none max-sm:border-b-0 backdrop:animate-fade-in"
    >
      <div aria-hidden className="flex justify-center pt-2.5 sm:hidden">
        <span className="h-1 w-10 rounded-sm bg-field-line" />
      </div>
      {children}
    </dialog>
  );
}

export function DialogHeader({
  id,
  title,
  subtitle,
  icon,
  onClose,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  icon: ReactNode;
  onClose: () => void;
}) {
  return (
    <header className="flex items-center gap-3.5 border-b-2 border-line-soft px-5 py-[18px]">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 id={id} className="m-0 text-lg font-bold">
          {title}
        </h2>
        {subtitle}
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:text-ink"
      >
        <LuX aria-hidden className="size-5" />
      </button>
    </header>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <footer className="flex flex-wrap justify-end gap-2.5 border-t-2 border-line-soft bg-surface-2 px-5 py-4">{children}</footer>;
}

export const buttonSecondary =
  "press flex h-12 cursor-pointer items-center justify-center gap-2 rounded border-2 border-line-strong bg-transparent px-[18px] text-[15px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60";

export const buttonPrimary =
  "press shadow-block flex h-12 cursor-pointer items-center justify-center gap-2 rounded border-0 bg-accent px-[22px] text-[15px] font-bold text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-faint disabled:shadow-none";

/** A Server Action's error, announced to screen readers. */
export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="m-0 flex animate-enter items-start gap-2.5 rounded border-2 border-neg-line bg-neg-bg px-3.5 py-3 text-sm leading-normal text-[#ffd9d9]">
      <LuCircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-neg" />
      {message}
    </p>
  );
}

/** "12 / 280" under a textarea. */
export function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className="shrink-0 font-mono text-xs font-medium text-muted">
      {value.length} / {max}
    </span>
  );
}

export const textareaClass =
  "w-full resize-y rounded border-2 border-field-line bg-page px-3.5 py-3 text-[15px] leading-normal text-ink outline-none focus-visible:border-accent";

/** The +1/−1 a dialog is about, as shown in the Reply and Report dialogs. */
export function EntryCard({ entry, children }: { entry: EntryView; children?: ReactNode }) {
  return (
    <div className="flex gap-3 rounded border-2 border-line bg-surface-2 p-3.5">
      <SkinHead uuid={entry.giver.uuid} username={entry.giver.username} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <ValueChip value={entry.value} />
          <span className="font-mono text-sm font-semibold [overflow-wrap:anywhere]">{entry.giver.username}</span>
          <span className="text-xs text-muted">{entry.when}</span>
        </div>
        {entry.reason ? (
          <p className="m-0 text-[15px] leading-normal text-ink">{entry.reason}</p>
        ) : (
          <p className="m-0 text-sm text-muted italic">No reason given</p>
        )}
        {children}
      </div>
    </div>
  );
}
