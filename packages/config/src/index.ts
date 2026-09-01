import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().optional(),
  NEXT_PUBLIC_WEB_URL: z.string().url().optional()
});

export type RuntimeConfig = {
  environment: "development" | "test" | "production";
  adminUrl?: string;
  webUrl?: string;
};

export function getRuntimeConfig(source: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = environmentSchema.parse(source);

  return {
    environment: parsed.NODE_ENV,
    ...(parsed.NEXT_PUBLIC_ADMIN_URL ? { adminUrl: parsed.NEXT_PUBLIC_ADMIN_URL } : {}),
    ...(parsed.NEXT_PUBLIC_WEB_URL ? { webUrl: parsed.NEXT_PUBLIC_WEB_URL } : {})
  };
}
