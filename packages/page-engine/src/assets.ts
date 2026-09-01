import { pageDocumentSchema, type PageDocument } from "./schema";

const isAssetKey = (key: string) => key === "assetId" || key.endsWith("AssetId");

function clear(value: unknown, key?: string): unknown {
  if (key && isAssetKey(key) && typeof value === "string") return null;
  if (Array.isArray(value)) return value.map((entry) => clear(entry));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, clear(childValue, childKey)]));
  return value;
}

function collect(value: unknown, ids: Set<string>, key?: string) {
  if (key && isAssetKey(key) && typeof value === "string") { ids.add(value); return; }
  if (Array.isArray(value)) { for (const entry of value) collect(entry, ids); return; }
  if (value && typeof value === "object") for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) collect(childValue, ids, childKey);
}

export function clearAssetReferences(document: PageDocument): PageDocument {
  return pageDocumentSchema.parse(clear(document));
}

export function collectAssetIds(document: PageDocument): string[] {
  const ids = new Set<string>();
  collect(document, ids);
  return [...ids];
}
