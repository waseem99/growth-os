"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createLandingVariation } from "./actions";

type Page = { id: string; pageName: string; slug: string; brandId: string; brandName: string };
type Creative = { id: string; brandId: string; title: string | null; type: string };
type Campaign = { id: string; brandId: string; name: string };

export function NewVariationForm({ pages, creatives, campaigns }: {
  pages: Page[];
  creatives: Creative[];
  campaigns: Campaign[];
}) {
  const [pageId, setPageId] = useState("");
  const selectedPage = useMemo(() => pages.find((page) => page.id === pageId), [pages, pageId]);
  const brandId = selectedPage?.brandId;
  const availableCreatives = creatives.filter((asset) => brandId && asset.brandId === brandId);
  const availableCampaigns = campaigns.filter((campaign) => brandId && campaign.brandId === brandId);

  return <section className="settings-card" style={{ marginTop: 24 }}>
    <h2>New campaign variation</h2>
    <p>Select a product landing page first. Only that product’s campaigns and banners can be used.</p>
    <form action={createLandingVariation}>
      <div className="asset-upload-grid">
        <label>Product landing page
          <select name="pageId" required value={pageId} onChange={(event) => setPageId(event.target.value)}>
            <option value="" disabled>Select an existing page</option>
            {pages.map((page) => <option key={page.id} value={page.id}>
              {page.brandName} · /{page.slug} — {page.pageName}
            </option>)}
          </select>
        </label>
        <label>Banner parameter
          <input name="parameterKey" required maxLength={80} placeholder="ranchers" pattern="[A-Za-z0-9-]+" />
        </label>
        <label>Campaign (optional)
          <select key={pageId + "-campaign"} name="campaignId" defaultValue="" disabled={!brandId}>
            <option value="">Use page’s default campaign</option>
            {availableCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        </label>
        <label>Banner asset
          <select key={pageId + "-asset"} name="bannerAssetId" defaultValue="" disabled={!brandId}>
            <option value="">Keep default hero</option>
            {availableCreatives.map((asset) => <option key={asset.id} value={asset.id}>
              {asset.title ?? asset.id} ({asset.type})
            </option>)}
          </select>
        </label>
        <label>Headline override (optional)<input name="headline" maxLength={180} /></label>
        <label>Subheadline override (optional)<input name="subheadline" maxLength={500} /></label>
      </div>
      <p>Upload additional creative under <Link href="/assets">Ad Creative</Link>. Product ownership is rechecked server-side before saving.</p>
      <button className="primary-button" type="submit" disabled={!brandId}>Save draft variation</button>
    </form>
  </section>;
}
