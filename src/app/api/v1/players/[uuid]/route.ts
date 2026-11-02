import { db } from "@/db";
import { getPlayer, dashUuid } from "@/server/players";
import { totalsFor } from "@/server/reputation";

/**
 * Public, read-only Reputation for one Player, for the plugin on Participating Servers.
 * Servers never write (ADR 0002), so this needs no key.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/v1/players/[uuid]">) {
  let uuid: string;
  try {
    uuid = dashUuid((await ctx.params).uuid);
  } catch {
    return Response.json({ error: "Not a Minecraft UUID" }, { status: 400 });
  }
  const player = await getPlayer(db, uuid);
  const { positive, negative } = player ? await totalsFor(db, uuid) : { positive: 0, negative: 0 };
  return Response.json(
    { uuid, username: player?.username ?? null, positive, negative, net: positive - negative },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
