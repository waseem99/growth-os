"use client";

import { useMemo, useState } from "react";

export function VariationLinkBuilder({ baseUrl, parameter, packages }: {
  baseUrl: string;
  parameter: string;
  packages: Array<{ code: string }>;
}) {
  const [source, setSource] = useState("meta");
  const [packageCode, setPackageCode] = useState(packages[0]?.code ?? "");
  const link = useMemo(() => {
    const url = new URL(baseUrl);
    url.searchParams.set("parameter", parameter);
    if (packageCode) url.searchParams.set("package", packageCode);
    url.searchParams.set("utm_source", source);
    return url.toString();
  }, [baseUrl, parameter, packageCode, source]);
  return <div>
    <strong>Campaign link generator</strong>
    <div className="asset-upload-grid">
      <label>Source<select value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="meta">Meta</option><option value="tiktok">TikTok</option>
        <option value="google">Google</option><option value="organic">Organic</option>
      </select></label>
      <label>Package<select value={packageCode} onChange={(e) => setPackageCode(e.target.value)}>
        <option value="">Default page offer</option>
        {packages.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
      </select></label>
    </div>
    <label>Generated URL<input value={link} readOnly onFocus={(event) => event.target.select()} /></label>
    <a href={link} target="_blank" rel="noreferrer">Open published variation</a>
  </div>;
}
