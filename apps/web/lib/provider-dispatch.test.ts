import { describe, expect, it, vi } from "vitest";
import { sendProviderRequest } from "./provider-dispatch";
import type { ProviderTransport } from "./provider-transport";

const meta: ProviderTransport = {
  endpoint: "https://graph.facebook.com/v25.0/123456789012/events",
  headers: { authorization: "Bearer secret-for-test-only" },
  body: { data: [{ event_id: "growthos_00000000-0000-4000-8000-000000000001" }] }
};
const tiktok: ProviderTransport = {
  endpoint: "https://business-api.tiktok.com/open_api/v1.3/event/track/",
  headers: { "Access-Token": "secret-for-test-only" },
  body: { event_source: "web", data: [{ event_id: "growthos_00000000-0000-4000-8000-000000000001" }] }
};

function mockResponse(status: number, body: unknown) {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" }
  }));
}

describe("bounded provider dispatch", () => {
  it("accepts only an acknowledged Meta event, with redirects explicitly denied", async () => {
    const send = mockResponse(200, { events_received: 1 });
    await expect(sendProviderRequest("meta", meta, send)).resolves.toEqual({
      accepted: true, errorCode: null, terminal: false
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[1]).toMatchObject({
      method: "POST", redirect: "error", cache: "no-store",
      headers: meta.headers
    });
    expect(JSON.parse(String(send.mock.calls[0]?.[1]?.body))).toEqual(meta.body);
  });

  it("does not assume HTTP 200 means TikTok accepted the conversion", async () => {
    const rejected = await sendProviderRequest("tiktok", tiktok, mockResponse(200, {
      code: 40002, message: "reject"
    }));
    expect(rejected).toEqual({ accepted: false, errorCode: "PROVIDER_RESPONSE_200", terminal: false });
    const accepted = await sendProviderRequest("tiktok", tiktok, mockResponse(200, { code: 0 }));
    expect(accepted.accepted).toBe(true);
  });

  it.each([
    [401, true, "PROVIDER_AUTH_REJECTED"],
    [403, true, "PROVIDER_AUTH_REJECTED"],
    [400, true, "PROVIDER_RESPONSE_400"],
    [429, false, "PROVIDER_RESPONSE_429"],
    [500, false, "PROVIDER_RESPONSE_500"]
  ] as const)("classifies HTTP %i for correct retry behavior", async (status, terminal, errorCode) => {
    const result = await sendProviderRequest("meta", meta, mockResponse(status, { error: {} }));
    expect(result).toMatchObject({ accepted: false, errorCode, terminal });
  });

  it("handles provider network failures without leaking credentials", async () => {
    const failing = vi.fn<typeof fetch>().mockRejectedValue(new Error("Bearer secret-for-test-only"));
    const result = await sendProviderRequest("meta", meta, failing);
    expect(result).toEqual({ accepted: false, errorCode: "PROVIDER_TRANSPORT_ERROR", terminal: false });
    expect(JSON.stringify(result)).not.toContain("secret-for-test-only");
  });

  it("blocks non-provider URLs before any outbound request", async () => {
    const send = mockResponse(200, { events_received: 1 });
    const unsafe = { ...meta, endpoint: "https://attacker.example/steal" };
    const result = await sendProviderRequest("meta", unsafe, send);
    expect(result).toEqual({ accepted: false, errorCode: "PROVIDER_ENDPOINT_REJECTED", terminal: true });
    expect(send).not.toHaveBeenCalled();
  });
});
