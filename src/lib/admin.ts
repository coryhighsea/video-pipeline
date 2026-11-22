/**
 * /admin is behind basic auth (src/proxy.ts), but browsers resend basic-auth credentials on cross-site
 * form posts. Every state-changing admin endpoint must also check the request came from this site.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
