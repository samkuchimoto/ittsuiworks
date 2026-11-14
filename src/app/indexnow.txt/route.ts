import { INDEXNOW_KEY } from "@/lib/site";

/** The IndexNow key file: proves to Bing and the other IndexNow engines that the job announcements come from us. */
export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
