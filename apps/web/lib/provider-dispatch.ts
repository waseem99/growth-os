import type { DeliveryProvider } from "./conversion-delivery";
import { providerAccepted, type ProviderTransport } from "./provider-transport";

export type DispatchOutcome = {
  accepted: boolean;
  errorCode: string | null;
  terminal: boolean;
};

/**
 * A provider request may only target the official, hard-coded API origin.
 * Redirects are explicitly rejected so server-side credentials cannot be
 * forwarded to a different host. No sensitive response bodies are logged.
 */
export async function sendProviderRequest(
  provider: DeliveryProvider,
  request: ProviderTransport,
  send: typeof fetch = fetch
): Promise<DispatchOutcome> {
  const metaEndpoint = /^https:\/\/graph\.facebook\.com\/v[0-9]+\.[0-9]+\/[0-9]{6,30}\/events$/;
  const tiktokEndpoint = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
  if (provider === "meta" ? !metaEndpoint.test(request.endpoint) : request.endpoint !== tiktokEndpoint) {
    return { accepted: false, errorCode: "PROVIDER_ENDPOINT_REJECTED", terminal: true };
  }
  try {
    const response = await send(request.endpoint, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000)
    });
    const reply: unknown = await response.json().catch(() => null);
    if (providerAccepted(provider, response.status, reply)) {
      return { accepted: true, errorCode: null, terminal: false };
    }
    const terminal = response.status === 401 || response.status === 403 ||
      (response.status >= 400 && response.status < 500 && response.status !== 429);
    return {
      accepted: false,
      errorCode: response.status === 401 || response.status === 403
        ? "PROVIDER_AUTH_REJECTED" : `PROVIDER_RESPONSE_${response.status}`,
      terminal
    };
  } catch {
    return { accepted: false, errorCode: "PROVIDER_TRANSPORT_ERROR", terminal: false };
  }
}
