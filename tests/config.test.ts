import { describe, expect, it } from "vitest";
import { getRuntimeConfig } from "../packages/config/src/index";

describe("runtime configuration", () => {
  it("uses development by default", () => {
    expect(getRuntimeConfig({} as NodeJS.ProcessEnv)).toEqual({ environment: "development" });
  });

  it("rejects malformed public URLs", () => {
    expect(() =>
      getRuntimeConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_WEB_URL: "not-a-url"
      } as NodeJS.ProcessEnv)
    ).toThrow();
  });
});
