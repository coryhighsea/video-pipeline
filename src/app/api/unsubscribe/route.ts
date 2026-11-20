import { unsubscribe } from "@/lib/leads";

export const dynamic = "force-dynamic";

/**
 * POST only: used by mail clients' one-click button (RFC 8058, token in the query string) and by the
 * confirm button on /unsubscribe (token in the form body). GET is deliberately unsupported so link
 * scanners can't unsubscribe people by prefetching the link.
 */
export async function POST(req: Request) {
  const queryToken = new URL(req.url).searchParams.get("t");
  if (queryToken) {
    return new Response(null, { status: unsubscribe(queryToken) ? 200 : 404 });
  }
  const form = await req.formData().catch(() => null);
  const t = form?.get("t");
  const ok = unsubscribe(typeof t === "string" ? t : null);
  // Relative Location so it works behind the reverse proxy.
  return new Response(null, { status: 303, headers: { Location: `/unsubscribe?done=${ok ? 1 : 0}` } });
}
