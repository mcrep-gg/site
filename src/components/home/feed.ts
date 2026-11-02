import "server-only";
import { db } from "@/db";
import type { Reaction, Value } from "@/lib/rules";
import { newestReputation, reactionsFor } from "@/server/reputation";
import { timeAgo } from "@/components/profile/format";

/** How many entries the Home feed shows. */
const FEED_LENGTH = 8;

/** One row of the Home feed, with its time already formatted so server and client text match. */
export type FeedItem = {
  id: string;
  value: Value;
  reason: string | null;
  when: string;
  giver: { uuid: string; username: string };
  receiver: { uuid: string; username: string };
  reactions: { emoji: Reaction; count: number }[];
};

/** The newest Reputation given by anyone. Reads the clock: call it at request time only. */
export async function newestFeed(): Promise<FeedItem[]> {
  const now = new Date();
  const entries = await newestReputation(db, FEED_LENGTH);
  const reactions = await reactionsFor(db, entries.map((e) => e.id), null);
  return entries.map(({ createdAt, ...e }) => ({
    ...e,
    when: timeAgo(createdAt, now),
    reactions: (reactions.get(e.id) ?? []).map(({ emoji, count }) => ({ emoji, count })),
  }));
}
