import { pageDocumentSchema, type PageDocument } from "@growth-os/page-engine";

export type AssetReference = { assetId: string; fieldPath: string };
export type AssetMetadata = {
  pathname?: string;
  originalName?: string;
  tags?: string[];
  campaignId?: string | null;
  platform?: string | null;
  creativeId?: string | null;
  uploadedBy?: string;
};

const isAssetKey = (key: string) => key === "assetId" || key.endsWith("AssetId");

export function collectAssetReferences(document: PageDocument): AssetReference[] {
  const references: AssetReference[] = [];
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (isAssetKey(key) && typeof child === "string") references.push({ assetId: child, fieldPath: childPath });
      else walk(child, childPath);
    }
  };
  walk(document, "");
  return references;
}

function transformAssetIds(value: unknown, transform: (assetId: string) => string | null, key?: string): unknown {
  if (key && isAssetKey(key) && typeof value === "string") return transform(value);
  if (Array.isArray(value)) return value.map((entry) => transformAssetIds(entry, transform));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, transformAssetIds(childValue, transform, childKey)]));
  }
  return value;
}

export function replaceAssetReference(document: PageDocument, oldAssetId: string, newAssetId: string): PageDocument {
  return pageDocumentSchema.parse(transformAssetIds(document, (assetId) => assetId === oldAssetId ? newAssetId : assetId));
}

export function clearAssetReferences(document: PageDocument): PageDocument {
  return pageDocumentSchema.parse(transformAssetIds(document, () => null));
}

export function parseAssetMetadata(value: unknown): AssetMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  return {
    pathname: typeof data.pathname === "string" ? data.pathname : undefined,
    originalName: typeof data.originalName === "string" ? data.originalName : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : [],
    campaignId: typeof data.campaignId === "string" ? data.campaignId : null,
    platform: typeof data.platform === "string" ? data.platform : null,
    creativeId: typeof data.creativeId === "string" ? data.creativeId : null,
    uploadedBy: typeof data.uploadedBy === "string" ? data.uploadedBy : undefined
  };
}

export function normalizeTags(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

export function assetTypeFromMime(mime: string): "image" | "video" | "gif" | "svg" | null {
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

export function validateAssetSize(type: "image" | "video" | "gif" | "svg", bytes: number) {
  const limit = type === "video" ? 250 * 1024 * 1024 : 20 * 1024 * 1024;
  return bytes > 0 && bytes <= limit;
}
