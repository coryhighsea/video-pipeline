import { createHash } from "node:crypto";
import { experiment, type Variant } from "@/config/funnel";
import { secret } from "@/lib/db";

/**
 * Cookie-free A/B assignment. The visitor id is a salted hash of IP + user agent, so nothing is
 * stored on the device and the raw IP is never saved. The salt is a per-deployment secret kept in
 * the DB, so the hash can't be reversed from the public source.
 *
 * Trade-off: someone whose IP or browser changes may land in the other variant on a later visit.
 */
export function visitorHash(ip: string, userAgent: string): string {
  return createHash("sha256")
    .update(`${secret("ab_salt")}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

/** Deterministic weighted bucket for this visitor in the current experiment. */
export function variantFor(visitorId: string): Variant {
  const h = createHash("sha256").update(`${experiment.id}|${visitorId}`).digest();
  const total = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
  let roll = (h.readUInt32BE(0) / 2 ** 32) * total;
  for (const v of experiment.variants) {
    roll -= v.weight;
    if (roll < 0) return v;
  }
  return experiment.variants[0];
}
