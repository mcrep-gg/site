"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { SUSPENSION_LENGTHS, SUSPENSION_REASON_MAX } from "@/lib/admin";
import { getAdmin } from "@/lib/viewer";
import { adminRemoveReputation, liftSuspension, resolveReport, suspendPlayer, type SuspendError } from "@/server/admin";
import type { ActionResult } from "@/components/profile/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

const NOT_ADMIN = "Only Admins can do that. Sign in again with an Admin account.";
const GONE = "This +1 or −1 no longer exists. The giver may have changed or removed it.";

const SUSPEND_ERRORS: Record<SuspendError, string> = {
  not_found: "That Player couldn't be found.",
  self: "You can't suspend yourself.",
  reason_required: "Write a reason. The Player sees it on their Settings page.",
  reason_too_long: `Keep the reason to ${SUSPENSION_REASON_MAX} characters or fewer.`,
  until_past: "Pick how long the Suspension lasts.",
  already_suspended: "This Player is already suspended. Lift that Suspension first to change it.",
};

const fail = (message: string): ActionResult => ({ status: "error", message });

/** Dismisses a Report (keeping the Reputation) or removes the reported Reputation. Both close every open Report on it. */
export async function resolveReportAction(reportId: string, decision: "dismiss" | "remove"): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return fail(NOT_ADMIN);
  if (!UUID_RE.test(reportId) || (decision !== "dismiss" && decision !== "remove")) return fail("That Report couldn't be found.");

  const result = await resolveReport(db, { reportId, adminUuid: admin.uuid, decision });
  refresh();
  if (!result.ok) {
    if (result.error === "gone") return fail(`${GONE} Dismiss the Report instead.`);
    if (result.error === "already_resolved") return fail("Another Admin already resolved this Report.");
    return fail("That Report couldn't be found.");
  }
  return { status: "ok" };
}

/** Removes any +1/−1, whoever gave it. */
export async function removeReputationAction(reputationId: string): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return fail(NOT_ADMIN);
  if (!UUID_RE.test(reputationId)) return fail(GONE);

  const result = await adminRemoveReputation(db, { reputationId, adminUuid: admin.uuid });
  refresh();
  return result.ok ? { status: "ok" } : fail(GONE);
}

export async function suspendAction(playerUuid: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return fail(NOT_ADMIN);
  if (!UUID_RE.test(playerUuid)) return fail(SUSPEND_ERRORS.not_found);

  const reason = formData.get("reason");
  const length = formData.get("length");
  if (typeof length !== "string" || !Object.hasOwn(SUSPENSION_LENGTHS, length)) return fail(SUSPEND_ERRORS.until_past);
  const until = length === "forever" ? null : new Date(Date.now() + Number(length) * DAY_MS);

  const result = await suspendPlayer(db, {
    playerUuid,
    adminUuid: admin.uuid,
    reason: typeof reason === "string" ? reason : "",
    until,
  });
  if (!result.ok) {
    if (result.error === "already_suspended") refresh();
    return fail(SUSPEND_ERRORS[result.error]);
  }
  refresh();
  return { status: "ok" };
}

export async function liftSuspensionAction(suspensionId: number): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return fail(NOT_ADMIN);
  if (!Number.isSafeInteger(suspensionId)) return fail("That Suspension couldn't be found.");

  const lifted = await liftSuspension(db, { suspensionId, adminUuid: admin.uuid });
  refresh();
  return lifted ? { status: "ok" } : fail("This Suspension already ended.");
}
