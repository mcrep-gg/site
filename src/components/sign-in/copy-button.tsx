"use client";

import { useState } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";

export function CopyButton({ text, label }: { text: string; label: string }) {
  // null until the first copy, so the icon only pops when it actually swaps.
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex h-10 items-center gap-1.5 rounded-[3px] bg-surface-3 px-3 text-[13px] font-semibold text-ink"
    >
      {copied ? (
        <LuCheck key="check" aria-hidden className="size-3.5 animate-pop text-pos" />
      ) : (
        <LuCopy key="copy" aria-hidden className={`size-3.5 ${copied === false ? "animate-pop" : ""}`} />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
