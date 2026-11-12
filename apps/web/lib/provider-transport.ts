import { sanitizeProviderMatch, type DeliveryProvider } from "./conversion-delivery";

export type DeliveryIntent = {
  event_id: string;
  event: string;
  occurred_at: string;
  value: number | null;
  currency: string | null;
  matching?: unknown;
};

export type ProviderTransport = {
  endpoint: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

/**
 * Build only known, documented provider payloads and fixed endpoints.
 * This function never sends a network request and never logs credentials.
 */
export function buildProviderTransport(input: {
  provider: DeliveryProvider;
  pixelId: string;
  token: string;
  pageUrl: string;
  event: DeliveryIntent;
  testCode?: string | null;
}): ProviderTransport | null {
  const { provider, pixelId, token, event } = input;
  const matching = sanitizeProviderMatch(event.matching);
  if (!matching || !token || token.length < 12) return null;
  if (!/^growthos_[0-9a-f-]{36}$/i.test(event.event_id)) return null;
  if (!Number.isFinite(Date.parse(event.occurred_at))) return null;
  const eventTime = Math.floor(Date.parse(event.occurred_at) / 1000);
  if (eventTime > Math.floor(Date.now() / 1000) + 300 ||
      eventTime < Math.floor(Date.now() / 1000) - 6 * 24 * 60 * 60) return null;
  if (event.value != null && (!Number.isFinite(event.value) || event.value < 0)) return null;
  if ((event.event === "Purchase" || event.event === "CompletePayment") &&
      (event.value === null || event.value <= 0 || !event.currency)) return null;
  if (event.currency != null && !/^[A-Z]{3}$/.test(event.currency)) return null;
  let safePageUrl: string;
  try {
    const url = new URL(input.pageUrl);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    url.search = "";
    url.hash = "";
    safePageUrl = url.toString();
  } catch { return null; }

  if (provider === "meta") {
    if (!/^\d{6,30}$/.test(pixelId) || !/^(Subscribe|Purchase|CompleteRegistration)$/.test(event.event)) return null;
    const userData: Record<string, unknown> = {
      external_id: [matching.externalIdSha256],
      client_user_agent: matching.clientUserAgent
    };
    if (matching.fbp) userData.fbp = matching.fbp;
    if (matching.fbc) userData.fbc = matching.fbc;
    const action: Record<string, unknown> = {
      event_name: event.event,
      event_time: eventTime,
      event_id: event.event_id,
      action_source: "website",
      event_source_url: safePageUrl,
      user_data: userData
    };
    if (event.value !== null && event.currency) action.custom_data = { value: event.value, currency: event.currency };
    return {
      endpoint: `https://graph.facebook.com/v25.0/${pixelId}/events`,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: { data: [action], ...(input.testCode ? { test_event_code: input.testCode } : {}) }
    };
  }

  if (provider === "tiktok") {
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(pixelId) ||
        !/^(Subscribe|CompletePayment|CompleteRegistration)$/.test(event.event)) return null;
    const user: Record<string, unknown> = {
      external_id: matching.externalIdSha256,
      user_agent: matching.clientUserAgent
    };
    if (matching.ttp) user.ttp = matching.ttp;
    if (matching.ttclid) user.ttclid = matching.ttclid;
    const action: Record<string, unknown> = {
      event: event.event,
      event_time: eventTime,
      event_id: event.event_id,
      user,
      page: { url: safePageUrl },
      ...(event.value !== null && event.currency
        ? { properties: { value: event.value, currency: event.currency } } : {})
    };
    return {
      endpoint: "https://business-api.tiktok.com/open_api/v1.3/event/track/",
      headers: { "Access-Token": token, "content-type": "application/json" },
      body: {
        event_source: "web", event_source_id: pixelId,
        data: [action], ...(input.testCode ? { test_event_code: input.testCode } : {})
      }
    };
  }

  return null;
}

export function providerAccepted(provider: DeliveryProvider, status: number, reply: unknown) {
  if (status < 200 || status >= 300 || !reply || typeof reply !== "object") return false;
  const value = reply as Record<string, unknown>;
  return provider === "meta"
    ? typeof value.events_received === "number" && value.events_received >= 1
    : value.code === 0;
}
