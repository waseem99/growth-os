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

export function AssetUpload({ brands, campaigns, initialBrandId = "", initialCampaignId = "", initialPlatform = "" }: { brands: AssetBrandOption[]; campaigns: AssetCampaignOption[]; initialBrandId?: string; initialCampaignId?: string; initialPlatform?: string }) {
  const router = useRouter();
  const initialBrand = brands.some((brand) => brand.id === initialBrandId) ? initialBrandId : brands[0]?.id ?? "";
  const [brandId, setBrandId] = useState(initialBrand);
  const [campaignId, setCampaignId] = useState(campaigns.some((campaign) => campaign.id === initialCampaignId && campaign.brandId === initialBrand) ? initialCampaignId : "");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [tags, setTags] = useState("");
  const [platform, setPlatform] = useState(initialPlatform);
  const [creativeId, setCreativeId] = useState("");
  const [adHeadline, setAdHeadline] = useState("");
  const [adPrimaryText, setAdPrimaryText] = useState("");
  const [adCta, setAdCta] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const compatibleCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.brandId === brandId), [campaigns, brandId]);

  const submit = () => startTransition(async () => {
    if (!file || !brandId) { setMessage("Choose a product and file."); return; }
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
        adHeadline,
        adPrimaryText,
        adCta,
        ...dimensions
      });
      setMessage("Ad creative uploaded. You can now create a matching page from the campaign.");
      setFile(null); setTitle(""); setAltText(""); setTags(""); setCreativeId(""); setAdHeadline(""); setAdPrimaryText(""); setAdCta("");
      router.push(`/assets/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    }
  });

  return <section className="asset-upload-card">
    <div><p className="eyebrow">Ad creative</p><h2>Upload the exact Meta/TikTok creative</h2><p>Keep the ad visual and copy here so the matching landing page can start from the same message.</p></div>
    <div className="asset-upload-grid">
      <label>Product<select value={brandId} onChange={(event) => { setBrandId(event.target.value); setCampaignId(""); }}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
      <label>Campaign<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">No campaign</option>{compatibleCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
      <label className="asset-file">Ad image/video<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, "")); }} /></label>
      <label>Internal title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} /></label>
      <label>Ad headline<input value={adHeadline} onChange={(event) => setAdHeadline(event.target.value)} maxLength={240} placeholder="The headline people see in the ad" /></label>
      <label>Primary ad text<textarea value={adPrimaryText} onChange={(event) => setAdPrimaryText(event.target.value)} maxLength={700} placeholder="Main Meta/TikTok message" /></label>
      <label>CTA label<input value={adCta} onChange={(event) => setAdCta(event.target.value)} maxLength={80} placeholder="Learn more / Subscribe / Get offer" /></label>
      <label>Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={300} placeholder="Describe meaningful images" /></label>
      <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="hero, ramadan, meta" /></label>
      <label>Platform<input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="Meta / TikTok" /></label>
      <label>Ad / creative ID<input value={creativeId} onChange={(event) => setCreativeId(event.target.value)} /></label>
    </div>
    <div className="asset-upload-actions"><button className="primary-button" type="button" disabled={isPending || !file || !brandId} onClick={submit}>{isPending ? "Uploading…" : "Upload ad creative"}</button>{message && <span>{message}</span>}</div>
  </section>;
}
