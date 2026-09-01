import { desc, eq } from "drizzle-orm";
import { assets, brands, getDatabase } from "@growth-os/db";
import { requireGrowthUser } from "@/lib/user-access";

export async function GET(request: Request) {
  await requireGrowthUser();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const { db, client } = getDatabase();
  try {
    const rows = await db.select({ id: assets.id, title: assets.title, type: assets.type, brandId: assets.brandId, brandName: brands.name, storageKey: assets.storageKey, altText: assets.altText })
      .from(assets).innerJoin(brands, eq(assets.brandId, brands.id)).orderBy(desc(assets.createdAt)).limit(200);
    const filtered = q ? rows.filter((asset) => `${asset.title ?? ""} ${asset.brandName} ${asset.type} ${asset.id}`.toLowerCase().includes(q)) : rows;
    return Response.json({ assets: filtered.slice(0, 80) });
  } finally { await client.end(); }
}
