"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { REASON_MAX, REPLY_MAX, REPORT_DETAILS_MAX, type GiveError, type ReplyError, type ReportError } from "@/lib/rules";
import { getViewer } from "@/lib/viewer";
import { getPlayer } from "@/server/players";
import { createReport, deleteReply, giveReputation, removeReputation, saveReply, toggleReaction, type ReactResult } from "@/server/reputation";
import type { ActionResult } from "@/components/profile/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIGN_IN = "Sign in with your Minecraft account first.";
const GONE = "This +1 or −1 no longer exists. It may have been changed or removed.";

const GIVE_ERRORS: Record<GiveError, string> = {
  not_linked: SIGN_IN,
  self: "You can't give yourself Reputation.",
  suspended: "Staff suspended you from giving Reputation.",
  limit_reached: "No Reputation left to give today. Your daily limit resets at 00:00 UTC.",
  reason_required: "A −1 needs a reason. Say what happened so other Players can judge.",
  reason_too_long: `Keep the reason to ${REASON_MAX} characters or fewer.`,
};

const REPLY_ERRORS: Record<ReplyError | "not_found", string> = {
  not_receiver: "You can only write a Reply on Reputation you received.",
  empty: "Write your Reply first.",
  too_long: `Keep your Reply to ${REPLY_MAX} characters or fewer.`,
  not_found: GONE,
};

const REPORT_ERRORS: Record<ReportError | "not_found" | "already_reported" | "not_linked", string> = {
  bad_category: "Pick what's wrong with this Reputation.",
  details_required: "Add details for Staff when you pick Something else.",
  details_too_long: `Keep the details to ${REPORT_DETAILS_MAX} characters or fewer.`,
  not_found: GONE,
  already_reported: "You already reported this +1 or −1. You can report each one once.",
  not_linked: SIGN_IN,
};

const REACT_ERRORS: Record<Extract<ReactResult, { ok: false }>["error"], string> = {
  bad_emoji: "You can't react with that.",
  not_linked: SIGN_IN,
  suspended: "Staff suspended you, so you can't react right now.",
  not_found: GONE,
};

const fail = (message: string): ActionResult => ({ status: "error", message });

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/** Gives, or changes, the viewer's +1/−1 on a Player. The giver is always the signed-in viewer. */
export async function giveAction(receiverUuid: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGN_IN);
  if (!UUID_RE.test(receiverUuid) || !(await getPlayer(db, receiverUuid))) return fail("That Player couldn't be found.");

  const raw = text(formData, "value");
  const value = raw === "1" ? 1 : raw === "-1" ? -1 : null;
  if (value === null) return fail("Pick +1 or −1.");

  const result = await giveReputation(db, {
    giverUuid: viewer.uuid,
    receiverUuid,
    value,
    reason: text(formData, "reason"),
  });
  if (!result.ok) {
    // The profile shows the limit and Suspension, so refresh it to match what the server just said.
    if (result.error === "limit_reached" || result.error === "suspended") refresh();
    return fail(GIVE_ERRORS[result.error]);
  }
  refresh();
  return { status: "ok" };
}

/** Takes back the viewer's +1/−1 on a Player. */
export async function removeAction(receiverUuid: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGN_IN);
  if (!UUID_RE.test(receiverUuid)) return fail("That Player couldn't be found.");

  const result = await removeReputation(db, { giverUuid: viewer.uuid, receiverUuid });
  refresh();
  if (!result.ok) {
    return fail(
      result.error === "suspended"
        ? "Staff suspended you from giving Reputation, so you can't remove it right now."
        : "There's no Reputation from you to remove. It may already be gone.",
    );
  }
  return { status: "ok" };
}

/** Writes, edits (intent=save) or deletes (intent=delete) the viewer's Reply on a +1/−1 they received. */
export async function replyAction(reputationId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGN_IN);
  if (!UUID_RE.test(reputationId)) return fail(GONE);

  if (text(formData, "intent") === "delete") {
    const ok = await deleteReply(db, { viewerUuid: viewer.uuid, reputationId });
    if (!ok) return fail(REPLY_ERRORS.not_receiver);
    refresh();
    return { status: "ok", deleted: true };
  }

  const reply = text(formData, "text");
  const result = await saveReply(db, { viewerUuid: viewer.uuid, reputationId, text: reply });
  if (!result.ok) return fail(REPLY_ERRORS[result.error]);
  refresh();
  return { status: "ok", text: reply.trim() };
}

/** Asks Staff to review a +1/−1. */
export async function reportAction(reputationId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGN_IN);
  if (!UUID_RE.test(reputationId)) return fail(GONE);

  const result = await createReport(db, {
    reporterUuid: viewer.uuid,
    reputationId,
    category: text(formData, "category"),
    details: text(formData, "details"),
  });
  if (!result.ok) {
    if (result.error === "already_reported") refresh();
    return fail(REPORT_ERRORS[result.error]);
  }
  refresh();
  return { status: "ok" };
}

/** Adds the viewer's emoji reaction to a +1/−1, or takes it back if they already added it. */
export async function reactAction(reputationId: string, emoji: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail(SIGN_IN);
  if (!UUID_RE.test(reputationId)) return fail(GONE);

  const result = await toggleReaction(db, { playerUuid: viewer.uuid, reputationId, emoji });
  refresh();
  if (!result.ok) return fail(REACT_ERRORS[result.error]);
  return { status: "ok" };
}
