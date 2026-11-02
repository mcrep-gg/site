"use client";

import { useSyncExternalStore } from "react";

// Motion's useReducedMotion reads the media query on the first client render, which the server can't
// know, so it breaks hydration. This reports false while hydrating, then the real preference.
const query = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
