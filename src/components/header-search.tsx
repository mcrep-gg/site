"use client";

import Form from "next/form";
import { usePathname } from "next/navigation";
import { LuSearch } from "react-icons/lu";

/** The header's username search. Hidden on Home, which has its own big search box. */
export function HeaderSearch() {
  if (usePathname() === "/") return null;
  return (
    <Form action="/" role="search" className="ml-3 hidden h-10 flex-[0_1_340px] items-center gap-2 rounded border-2 border-line-strong bg-surface px-3 sm:flex">
      <LuSearch aria-hidden className="size-4 text-muted" />
      <input
        type="search"
        name="q"
        aria-label="Search Players by username"
        placeholder="Search a username"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent font-mono text-sm font-medium text-ink outline-none"
      />
    </Form>
  );
}
