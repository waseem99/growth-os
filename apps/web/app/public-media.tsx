import Image from "next/image";
import type { MediaRenderInput } from "@growth-os/page-engine";
import type { PublicAsset } from "../lib/page-assets";

export function renderPublicMedia(assetMap: Map<string, PublicAsset>) {
  return function GrowthPublicMedia({ assetId, alt, className, loading }: MediaRenderInput) {
    const asset = assetMap.get(assetId);
    if (!asset) return <span className="go-media-placeholder" data-asset-id={assetId}>{alt || "Media unavailable"}</span>;
    if (asset.type === "video") return <video className={className} controls playsInline preload="metadata" aria-label={alt || asset.altText || "Campaign video"}><source src={asset.url} type={asset.mimeType} /></video>;
    return <Image
      className={className}
      src={asset.url}
      alt={alt || asset.altText || ""}
      width={asset.width ?? 1200}
      height={asset.height ?? 800}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
      loading={loading}
      fetchPriority={loading === "eager" ? "high" : "auto"}
      unoptimized={asset.type === "gif" || asset.type === "svg"}
    />;
  };
}
