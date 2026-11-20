import { confirmSubscription } from "@/lib/leads";

export const dynamic = "force-dynamic";

/** POST only (the button on /confirm), so link scanners prefetching the email link can't confirm on someone's behalf. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const t = form?.get("t");
  const ok = confirmSubscription(typeof t === "string" ? t : null);
  // Relative Location so it works behind the reverse proxy.
  return new Response(null, { status: 303, headers: { Location: `/confirm?done=${ok ? 1 : 0}` } });
}
