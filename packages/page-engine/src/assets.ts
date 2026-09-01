import { pageDocumentSchema, type PageDocument } from "./schema";

const isAssetKey = (key: string) => key === "assetId" || key.endsWith("AssetId");

function clear(value: unknown, key?: string): unknown {
  if (key && isAssetKey(key) && typeof value === "string") return null;
  if (Array.isArray(value)) return value.map((entry) => clear(entry));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, clear(childValue, childKey)]));
  return value;
}

export function clearAssetReferences(document: PageDocument): PageDocument {
  return pageDocumentSchema.parse(clear(document));
}
