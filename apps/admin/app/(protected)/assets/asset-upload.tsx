"use client";

import { useMemo, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { registerAsset } from "./actions";

export type AssetBrandOption = { id: string; name: string };
export type AssetCampaignOption = { id: string; brandId: string; name: string };

async function imageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return { width: null, height: null };
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read image dimensions"));
      image.src = objectUrl;
    });
    return { width: image.naturalWidth || null, height: image.naturalHeight || null };
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function AssetUpload({ brands, campaigns }: { brands: AssetBrandOption[]; campaigns: AssetCampaignOption[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [tags, setTags] = useState("");
  const [platform, setPlatform] = useState("");
  const [creativeId, setCreativeId] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const compatibleCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.brandId === brandId), [campaigns, brandId]);

  const submit = () => startTransition(async () => {
    if (!file || !brandId) { setMessage("Choose a brand and file."); return; }
    setMessage("Uploading…");
    try {
      const dimensions = await imageDimensions(file);
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/assets/upload",
        clientPayload: JSON.stringify({ brandId, campaignId: campaignId || null, mimeType: file.type, fileSize: file.size })
      });
      const result = await registerAsset({
        blobUrl: blob.url,
        brandId,
        campaignId: campaignId || null,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        title,
        altText,
        tags,
        platform,
        creativeId,
        ...dimensions
      });
      setMessage("Asset uploaded.");
      setFile(null); setTitle(""); setAltText(""); setTags(""); setPlatform(""); setCreativeId("");
      router.push(`/assets/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    }
  });

  return <section className="asset-upload-card">
    <div><p className="eyebrow">New asset</p><h2>Upload campaign creative</h2><p>Images/GIF/SVG up to 20 MB; video up to 250 MB. Uploads go directly to approved Blob storage.</p></div>
    <div className="asset-upload-grid">
      <label>Brand<select value={brandId} onChange={(event) => { setBrandId(event.target.value); setCampaignId(""); }}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
      <label>Campaign<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">No campaign</option>{compatibleCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
      <label className="asset-file">File<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, "")); }} /></label>
      <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} /></label>
      <label>Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={300} placeholder="Describe meaningful images" /></label>
      <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="hero, ramadan, meta" /></label>
      <label>Platform<input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="Meta / Google / TikTok" /></label>
      <label>Creative ID<input value={creativeId} onChange={(event) => setCreativeId(event.target.value)} /></label>
    </div>
    <div className="asset-upload-actions"><button className="primary-button" type="button" disabled={isPending || !file || !brandId} onClick={submit}>{isPending ? "Working…" : "Upload asset"}</button>{message && <span>{message}</span>}</div>
  </section>;
}
