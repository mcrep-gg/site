import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { issueLinkCode } from "@/server/auth";
import { dashUuid, USERNAME_RE } from "@/server/players";

/**
 * Called by the Link Server when a Player runs /link. Only the Link Server holds LINK_SERVER_SECRET:
 * Participating Servers are untrusted and can never issue codes (ADR 0001).
 */
export async function POST(request: Request) {
  const secret = process.env.LINK_SERVER_SECRET;
  if (!secret) return Response.json({ error: "Link Server is not configured" }, { status: 503 });
  if (!matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { uuid?: unknown; username?: unknown } | null;
  let uuid: string;
  try {
    uuid = dashUuid(String(body?.uuid ?? ""));
  } catch {
    return Response.json({ error: "uuid must be a Minecraft UUID" }, { status: 400 });
  }
  const username = String(body?.username ?? "");
  if (!USERNAME_RE.test(username)) return Response.json({ error: "username is not a Java Edition username" }, { status: 400 });

  const { code, expiresAt } = await issueLinkCode(db, { uuid, username });
  return Response.json({ code, expiresAt: expiresAt.toISOString() });
}

function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
