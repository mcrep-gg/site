"use client";

import { useState } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
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
      {copied ? <LuCheck aria-hidden className="size-3.5 text-pos" /> : <LuCopy aria-hidden className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
