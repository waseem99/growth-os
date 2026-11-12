/**
 * Resolve an administrator-configured destination for a product's own checkout.
 * URL query values never choose the destination or determine the payable price.
 * The downstream product server must validate the package code and its amount.
 */
export function approvedCheckoutDestination(
  brandDefaults: unknown,
  packageId: string | null,
  packageCode: string | null
): string | null {
  if (!brandDefaults || typeof brandDefaults !== "object") return null;
  const value = (brandDefaults as Record<string, unknown>).subscriptionUrl;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const dest = new URL(value);
    if (dest.protocol !== "https:" || dest.username || dest.password || !dest.hostname || dest.hash) return null;
    if (dest.hostname === "localhost" || dest.hostname.endsWith(".localhost")) return null;
    if (packageId) dest.searchParams.set("growthos_package_id", packageId);
    if (packageCode) dest.searchParams.set("growthos_package_code", packageCode);
    return dest.toString();
  } catch {
    return null;
  }
}
