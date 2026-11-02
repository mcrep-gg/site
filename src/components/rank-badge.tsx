import type { IconType } from "react-icons";
import { LuCrown, LuGem, LuShield } from "react-icons/lu";
import { RANK_LABELS, type Rank } from "@/lib/ranks";

const STYLES: Record<Rank, { icon: IconType; className: string; title: string }> = {
  admin: { icon: LuCrown, className: "border-admin-line bg-admin-bg text-admin", title: "Admin: runs mcrep.gg" },
  staff: { icon: LuShield, className: "border-staff-line bg-staff-bg text-staff", title: "Staff: reviews Reports and keeps Reputation fair" },
  pro: { icon: LuGem, className: "border-pro-line bg-pro-bg text-pro", title: "Pro: supports mcrep.gg" },
};

const SIZES = {
  md: { badge: "h-[26px] gap-[5px] px-2 text-xs", icon: "size-[13px]" },
  sm: { badge: "h-5 gap-1 px-1.5 text-[11px]", icon: "size-[11px]" },
} as const;

/** A Player's Admin, Staff or Pro badge. Renders nothing for Players without a rank. */
export function RankBadge({ rank, size = "md" }: { rank: Rank | null; size?: keyof typeof SIZES }) {
  if (!rank) return null;
  const { icon: Icon, className, title } = STYLES[rank];
  const s = SIZES[size];
  return (
    <span title={title} className={`inline-flex shrink-0 items-center rounded-[3px] border font-bold whitespace-nowrap ${s.badge} ${className}`}>
      <Icon aria-hidden className={s.icon} />
      {RANK_LABELS[rank]}
    </span>
  );
}
