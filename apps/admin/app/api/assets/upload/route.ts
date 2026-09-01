import { eq } from "drizzle-orm";
import { handleUpload } from "@vercel/blob/client";
import { brands, campaigns, getDatabase } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { assetTypeFromMime, validateAssetSize } from "@/lib/asset-references";

const allowedContentTypes = [
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml",
  "video/mp4", "video/webm", "video/quicktime"
];

type UploadPayload = { brandId?: string; campaignId?: string | null; mimeType?: string; fileSize?: number };

export async function POST(request: Request) {
  const body = await request.json();
  const result = await handleUpload({
    body: body as Parameters<typeof handleUpload>[0]["body"],
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const actor = await requirePermission("assets:manage");
      let payload: UploadPayload = {};
      try { payload = clientPayload ? JSON.parse(clientPayload) as UploadPayload : {}; } catch { throw new Error("INVALID_UPLOAD_METADATA"); }
      if (!payload.brandId || !payload.mimeType || typeof payload.fileSize !== "number") throw new Error("UPLOAD_METADATA_REQUIRED");
      const type = assetTypeFromMime(payload.mimeType);
      if (!type || !allowedContentTypes.includes(payload.mimeType) || !validateAssetSize(type, payload.fileSize)) throw new Error("UNSUPPORTED_ASSET");
      const { db, client } = getDatabase();
      try {
        const [brand] = await db.select({ id: brands.id, status: brands.status }).from(brands).where(eq(brands.id, payload.brandId)).limit(1);
        if (!brand || brand.status !== "active") throw new Error("BRAND_NOT_ACTIVE");
        if (payload.campaignId) {
          const [campaign] = await db.select({ brandId: campaigns.brandId }).from(campaigns).where(eq(campaigns.id, payload.campaignId)).limit(1);
          if (!campaign || campaign.brandId !== payload.brandId) throw new Error("CAMPAIGN_BRAND_MISMATCH");
        }
      } finally { await client.end(); }
      return {
        allowedContentTypes,
        maximumSizeInBytes: type === "video" ? 250 * 1024 * 1024 : 20 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ actorId: actor.id, brandId: payload.brandId })
      };
    },
    onUploadCompleted: async () => {
      // Registration is deliberately finalized by an authenticated server action after `head()` verifies the stored blob.
    }
  });
  return Response.json(result);
}
