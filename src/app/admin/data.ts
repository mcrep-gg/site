import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { getAdmin, getModerator } from "@/lib/viewer";
import { overview } from "@/server/admin";

/** The signed-in Admin or Staff, or a 404 for everyone else. Every dashboard page calls this before reading anything. */
export async function requireModerator() {
  const moderator = await getModerator();
  if (!moderator) notFound();
  return moderator;
}

/** The signed-in Admin, or a 404 for everyone else, Staff included. For the pages that manage ranks. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}

/** Shared by the layout's nav badge and the Overview page, so one request counts once. */
export const getOverview = cache(() => overview(db));
