import type { Reaction, Value } from "@/lib/rules";

/** One +1/−1 a Player received, shaped for the client: dates already formatted on the server. */
export type EntryView = {
  id: string;
  value: Value;
  reason: string | null;
  when: string;
  giver: { uuid: string; username: string };
  reply: { text: string; when: string } | null;
  /** The viewer gave this one. */
  mine: boolean;
  /** The viewer already reported this one. */
  reported: boolean;
  /** Emoji reactions, in picker order. Empty when there are none. */
  reactions: ReactionView[];
};

export type ReactionView = { emoji: Reaction; count: number; mine: boolean };

/** One +1/−1 a Player gave, shaped for the client. */
export type GivenView = {
  id: string;
  value: Value;
  reason: string | null;
  when: string;
  receiver: { uuid: string; username: string };
  reply: { text: string; when: string } | null;
};

/** What the give/change/remove dialogs need to know about the viewer and the Player they are viewing. */
export type GiveContext = {
  target: { uuid: string; username: string };
  viewerName: string;
  existing: { value: Value; reason: string | null; when: string; hasReply: boolean } | null;
  usedToday: number;
  limit: number;
  newPlayerDaysLeft: number;
  /** e.g. "7 h 42 min" until 00:00 UTC. */
  resetsIn: string;
  suspension: { reason: string; until: string | null } | null;
};

/** Result of a Server Action, read with useActionState. */
export type ActionResult =
  | { status: "idle" }
  | { status: "ok"; text?: string; deleted?: boolean }
  | { status: "error"; message: string };

export const IDLE: ActionResult = { status: "idle" };
