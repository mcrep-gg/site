import { connection } from "next/server";
import { newestFeed } from "@/components/home/feed";

/** The Home feed's newest Reputation. The page polls this to stay live. */
export async function GET() {
  await connection();
  return Response.json(await newestFeed(), { headers: { "cache-control": "no-store" } });
}
