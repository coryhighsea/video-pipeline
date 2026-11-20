import { headers } from "next/headers";
import type { Variant } from "@/config/funnel";
import { variantFor, visitorHash } from "@/lib/experiment";

/** Client IP as seen by the reverse proxy (Coolify/Traefik sets X-Forwarded-For). */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** The visitor's A/B identity, derived from the request. No cookies involved. */
export async function currentVisitor(): Promise<{ visitorId: string; variant: Variant }> {
  const h = await headers();
  const visitorId = visitorHash(clientIp(h), h.get("user-agent") ?? "");
  return { visitorId, variant: variantFor(visitorId) };
}
