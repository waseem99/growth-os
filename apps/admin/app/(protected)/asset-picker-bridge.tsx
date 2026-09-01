"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PickerAsset = { id: string; title: string | null; type: string; brandId: string; brandName: string; storageKey: string; altText: string | null };

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function AssetPickerBridge() {
  const [active, setActive] = useState<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const focus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.placeholder.includes("Asset UUID")) {
        setActive(target);
        setQuery("");
        setLoading(true);
        fetch("/api/assets", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Asset lookup failed"))).then((data: { assets: PickerAsset[] }) => setAssets(data.assets)).catch(() => setAssets([])).finally(() => setLoading(false));
      }
    };
    document.addEventListener("focusin", focus);
    return () => document.removeEventListener("focusin", focus);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets.slice(0, 30);
    return assets.filter((asset) => `${asset.title ?? ""} ${asset.brandName} ${asset.type} ${asset.id}`.toLowerCase().includes(q)).slice(0, 30);
  }, [assets, query]);

  if (!active) return null;
  return <div className="asset-picker-overlay" role="dialog" aria-label="Select asset" onMouseDown={(event) => event.preventDefault()}>
    <div className="asset-picker-head"><div><strong>Select Asset Library item</strong><span>The page stores the stable asset ID, not its Blob URL.</span></div><button type="button" onClick={() => setActive(null)}>×</button></div>
    <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets…" />
    <div className="asset-picker-results">{loading ? <p>Loading assets…</p> : visible.map((asset) => <button type="button" key={asset.id} onClick={() => { setReactInputValue(active, asset.id); setActive(null); }}><span className="asset-picker-thumb">{asset.type === "video" ? "VIDEO" : asset.type.toUpperCase()}</span><span><strong>{asset.title || "Untitled asset"}</strong><small>{asset.brandName} · {asset.type}</small><code>{asset.id}</code></span></button>)}</div>
    {!loading && visible.length === 0 ? <p>No matching assets. <Link href="/assets">Upload one in Asset Library.</Link></p> : null}
    <div className="asset-picker-foot"><button type="button" onClick={() => { setReactInputValue(active, ""); setActive(null); }}>Clear field</button><Link href="/assets" target="_blank" rel="noreferrer">Open Asset Library</Link></div>
  </div>;
}
