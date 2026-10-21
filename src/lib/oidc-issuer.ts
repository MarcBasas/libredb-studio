/**
 * An issuer as Studio compares it, in an import-free module, because both the governed sign-in rule
 * (src/lib/local-accounts.ts) and the bearer verifier the proxy loads (src/lib/oidc-bearer.ts) need the same answer,
 * and the proxy must not reach the governance state the first imports.
 *
 * Serialized by the URL parser, so the host's case and a default port read the same, with one trailing slash dropped,
 * because a bare-host issuer such as Auth0's ends in a slash that `OIDC_ISSUER` may leave out. Null when the value is
 * not a URL.
 */
export function comparableIssuer(value: string): string | null {
  const href = URL.parse(value)?.href;
  if (href === undefined) return null;
  return href.endsWith("/") ? href.slice(0, -1) : href;
}
