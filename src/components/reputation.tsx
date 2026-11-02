import { formatNet, type Value } from "@/lib/rules";

const netColor = { pos: "text-pos", neg: "text-neg", zero: "text-zero" } as const;

/** Net Reputation with both counts, e.g. "+12 (15 / 3)". Never color alone: the sign is always shown. */
export function NetReputation({
  positive,
  negative,
  size = "md",
}: {
  positive: number;
  negative: number;
  size?: "sm" | "md" | "lg";
}) {
  const f = formatNet(positive, negative);
  const netSize = { sm: "text-base", md: "text-4xl", lg: "text-6xl" }[size];
  const countSize = { sm: "text-xs", md: "text-base", lg: "text-xl" }[size];
  return (
    <span className="inline-flex items-baseline gap-2" aria-label={`Net Reputation ${f.net}, ${positive} positive, ${negative} negative`}>
      <span className={`font-pixel leading-none font-bold ${netSize} ${netColor[f.sign]}`}>{f.net}</span>
      <span className={`font-mono font-medium text-ink-2 ${countSize}`}>{f.counts}</span>
    </span>
  );
}

/** The +1 / −1 chip shown on each entry. */
export function ValueChip({ value }: { value: Value }) {
  return value === 1 ? (
    <span className="inline-flex h-6 items-center rounded-[3px] border border-pos-line bg-pos-bg px-[7px] font-mono text-[13px] font-bold text-pos">
      +1
    </span>
  ) : (
    <span className="inline-flex h-6 items-center rounded-[3px] border border-neg-line bg-neg-bg px-[7px] font-mono text-[13px] font-bold text-neg">
      {"−1"}
    </span>
  );
}
