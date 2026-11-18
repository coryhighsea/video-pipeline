import { experiment, type Variant } from "@/config/funnel";

export const VISITOR_COOKIE = "vid";
export const VARIANT_COOKIE = "abv";

/** Cookie value format: `<experimentId>:<variantId>`. */
export function parseVariantCookie(value: string | undefined): Variant | null {
  if (!value) return null;
  const [expId, variantId] = value.split(":");
  if (expId !== experiment.id) return null;
  return experiment.variants.find((v) => v.id === variantId) ?? null;
}

export function pickVariant(): Variant {
  const total = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
  let roll = Math.random() * total;
  for (const v of experiment.variants) {
    roll -= v.weight;
    if (roll < 0) return v;
  }
  return experiment.variants[0];
}

export function variantCookieValue(v: Variant): string {
  return `${experiment.id}:${v.id}`;
}
