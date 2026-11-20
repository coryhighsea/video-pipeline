import { cookies } from "next/headers";
import { experiment, type Variant } from "@/config/funnel";
import { CONSENT_COOKIE, VARIANT_COOKIE, VISITOR_COOKIE, parseVariantCookie } from "@/lib/experiment";

export type Consent = "yes" | "no" | null;

/**
 * The visitor's A/B identity. Without cookie consent there is no visitor id, the
 * default variant is shown, and nothing counts toward the experiment.
 */
export async function currentVisitor(): Promise<{
  consent: Consent;
  visitorId: string | null;
  variant: Variant;
  inExperiment: boolean;
}> {
  const jar = await cookies();
  const raw = jar.get(CONSENT_COOKIE)?.value;
  const consent: Consent = raw === "yes" || raw === "no" ? raw : null;
  const visitorId = consent === "yes" ? (jar.get(VISITOR_COOKIE)?.value ?? null) : null;
  const assigned = consent === "yes" ? parseVariantCookie(jar.get(VARIANT_COOKIE)?.value) : null;
  return {
    consent,
    visitorId,
    variant: assigned ?? experiment.variants.find((v) => v.id === experiment.defaultVariant) ?? experiment.variants[0],
    inExperiment: Boolean(visitorId && assigned),
  };
}
