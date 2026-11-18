import { cookies } from "next/headers";
import { experiment, type Variant } from "@/config/funnel";
import { VARIANT_COOKIE, VISITOR_COOKIE, parseVariantCookie } from "@/lib/experiment";

export async function currentVisitor(): Promise<{ visitorId: string | null; variant: Variant }> {
  const jar = await cookies();
  return {
    visitorId: jar.get(VISITOR_COOKIE)?.value ?? null,
    variant: parseVariantCookie(jar.get(VARIANT_COOKIE)?.value) ?? experiment.variants[0],
  };
}
