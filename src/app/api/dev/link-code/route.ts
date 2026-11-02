import { db } from "@/db";
import { issueLinkCode } from "@/server/auth";
import { findPlayerByName } from "@/server/players";

/**
 * Development only: stands in for the Link Server so you can sign in as any Java account.
 * GET /api/dev/link-code?username=Notch
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const username = new URL(request.url).searchParams.get("username") ?? "";
  const player = await findPlayerByName(db, username);
  if (!player) return Response.json({ error: `No Java Edition account called ${username}` }, { status: 404 });
  const { code, expiresAt } = await issueLinkCode(db, player);
  return Response.json({ username: player.username, code, expiresAt: expiresAt.toISOString() });
}
