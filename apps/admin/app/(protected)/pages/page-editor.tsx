"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BLOCK_TYPES,
  PageRenderer,
  pageDocumentSchema,
  type BlockType,
  type BrandRenderTheme,
  type PageBlock,
  type PageDocument
} from "@growth-os/page-engine";
import { duplicatePage, savePageDraft } from "./actions";
import styles from "./page-editor.module.css";

type EditorInitial = {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  campaignId: string | null;
  conversionGoal: string;
  revision: number;
  status: "draft" | "archived";
  document: PageDocument;
};

type BrandOption = { id: string; name: string };
type CampaignOption = { id: string; brandId: string; name: string; status: string };

const blockLabel = (type: BlockType) => type.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
const uuid = () => crypto.randomUUID();

function createBlock(type: BlockType): PageBlock {
  const base = { id: uuid(), version: 1 as const, visible: true };
  const item = (title: string) => ({ id: uuid(), title, text: "", iconAssetId: null });
  switch (type) {
    case "header": return { ...base, type, logoAssetId: null, badge: "", trustText: "" };
    case "hero": return { ...base, type, variant: "clean", eyebrow: "", headline: "New campaign headline", highlightedText: "", subheadline: "", heroAssetId: null, backgroundAssetId: null, partnerLogoAssetId: null, promoHeadline: "", promoSubheadline: "" };
    case "benefits": return { ...base, type, variant: "inline", items: [item("Benefit")] };
    case "showcase": return { ...base, type, title: "Showcase", intro: "", items: [item("Item")] };
    case "socialProof": return { ...base, type, title: "Proof", items: [item("Proof point")] };
    case "steps": return { ...base, type, title: "How it works", items: [item("Step one"), item("Step two")] };
    case "pricing": return { ...base, type, title: "Choose your plan", body: "", ctaLabel: "Continue" };
    case "comparison": return { ...base, type, title: "Compare", items: [item("Option one"), item("Option two")] };
    case "stats": return { ...base, type, items: [{ id: uuid(), value: "1", label: "Metric" }] };
    case "gallery": return { ...base, type, title: "Gallery", assets: [{ id: uuid(), assetId: null, alt: "" }] };
    case "video": return { ...base, type, title: "Video", assetId: null, posterAssetId: null, caption: "" };
    case "faq": return { ...base, type, title: "Frequently asked questions", items: [{ id: uuid(), question: "Question", answer: "Answer" }] };
    case "form": return { ...base, type, variant: "lead", title: "Get started", provider: "generic", inputLabel: "Mobile number", placeholder: "", consentLabel: "", ctaLabel: "Continue", disclosure: "" };
    case "cta": return { ...base, type, title: "Ready?", body: "", ctaLabel: "Continue", href: "#" };
    case "stickyCta": return { ...base, type, label: "Continue", href: "#" };
    case "footer": return { ...base, type, secureText: "", privacyText: "", supportText: "", legalText: "" };
  }
}

function TextField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className={styles.field}><span>{label}</span>{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function AssetField({ label, value, onChange }: { label: string; value?: string | null; onChange: (value: string | null) => void }) {
  return <label className={styles.field}><span>{label}</span><input value={value ?? ""} onChange={(event) => onChange(event.target.value.trim() || null)} placeholder="Asset UUID (Asset Library picker follows)" /></label>;
}

type StandardItem = { id: string; title: string; text: string; iconAssetId?: string | null };
function StandardItemsEditor({ items, onChange }: { items: StandardItem[]; onChange: (items: StandardItem[]) => void }) {
  return <div className={styles.nestedList}>{items.map((item, index) => <div className={styles.nestedCard} key={item.id}>
    <TextField label={`Item ${index + 1} title`} value={item.title} onChange={(title) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, title } : entry))} />
    <TextField label="Text" value={item.text} multiline onChange={(text) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, text } : entry))} />
    <AssetField label="Icon asset" value={item.iconAssetId} onChange={(iconAssetId) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, iconAssetId } : entry))} />
    <button type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Remove item</button>
  </div>)}<button type="button" onClick={() => onChange([...items, { id: uuid(), title: "New item", text: "", iconAssetId: null }])}>+ Add item</button></div>;
}

function BlockFields({ block, onChange }: { block: PageBlock; onChange: (block: PageBlock) => void }) {
  switch (block.type) {
    case "header": return <><AssetField label="Logo asset" value={block.logoAssetId} onChange={(logoAssetId) => onChange({ ...block, logoAssetId })} /><TextField label="Badge" value={block.badge} onChange={(badge) => onChange({ ...block, badge })} /><TextField label="Trust text" value={block.trustText} onChange={(trustText) => onChange({ ...block, trustText })} /></>;
    case "hero": return <><label className={styles.field}><span>Hero layout</span><select value={block.variant} onChange={(event) => onChange({ ...block, variant: event.target.value as typeof block.variant })}><option value="clean">Clean</option><option value="promotional">Promotional</option><option value="product">Product</option><option value="minimal">Minimal</option></select></label><TextField label="Eyebrow" value={block.eyebrow} onChange={(eyebrow) => onChange({ ...block, eyebrow })} /><TextField label="Headline" value={block.headline} onChange={(headline) => onChange({ ...block, headline })} /><TextField label="Highlighted text" value={block.highlightedText} onChange={(highlightedText) => onChange({ ...block, highlightedText })} /><TextField label="Subheadline" value={block.subheadline} multiline onChange={(subheadline) => onChange({ ...block, subheadline })} /><AssetField label="Hero asset" value={block.heroAssetId} onChange={(heroAssetId) => onChange({ ...block, heroAssetId })} /><AssetField label="Background asset" value={block.backgroundAssetId} onChange={(backgroundAssetId) => onChange({ ...block, backgroundAssetId })} /><AssetField label="Partner logo" value={block.partnerLogoAssetId} onChange={(partnerLogoAssetId) => onChange({ ...block, partnerLogoAssetId })} /><TextField label="Promo headline" value={block.promoHeadline} onChange={(promoHeadline) => onChange({ ...block, promoHeadline })} /><TextField label="Promo subheadline" value={block.promoSubheadline} onChange={(promoSubheadline) => onChange({ ...block, promoSubheadline })} /></>;
    case "benefits": return <><label className={styles.field}><span>Layout</span><select value={block.variant} onChange={(event) => onChange({ ...block, variant: event.target.value as typeof block.variant })}><option value="inline">Inline</option><option value="cards">Cards</option><option value="icons">Icons</option></select></label><StandardItemsEditor items={block.items} onChange={(items) => onChange({ ...block, items })} /></>;
    case "showcase": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><TextField label="Intro" value={block.intro} multiline onChange={(intro) => onChange({ ...block, intro })} /><StandardItemsEditor items={block.items} onChange={(items) => onChange({ ...block, items })} /></>;
    case "socialProof": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><StandardItemsEditor items={block.items} onChange={(items) => onChange({ ...block, items })} /></>;
    case "steps": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><StandardItemsEditor items={block.items} onChange={(items) => onChange({ ...block, items })} /></>;
    case "comparison": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><StandardItemsEditor items={block.items} onChange={(items) => onChange({ ...block, items })} /></>;
    case "pricing": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><TextField label="Body" value={block.body} multiline onChange={(body) => onChange({ ...block, body })} /><TextField label="CTA label" value={block.ctaLabel} onChange={(ctaLabel) => onChange({ ...block, ctaLabel })} /></>;
    case "stats": return <div className={styles.nestedList}>{block.items.map((item, index) => <div className={styles.nestedCard} key={item.id}><TextField label={`Metric ${index + 1} value`} value={item.value} onChange={(value) => onChange({ ...block, items: block.items.map((entry) => entry.id === item.id ? { ...entry, value } : entry) })} /><TextField label="Label" value={item.label} onChange={(label) => onChange({ ...block, items: block.items.map((entry) => entry.id === item.id ? { ...entry, label } : entry) })} /><button type="button" onClick={() => onChange({ ...block, items: block.items.filter((entry) => entry.id !== item.id) })}>Remove metric</button></div>)}<button type="button" onClick={() => onChange({ ...block, items: [...block.items, { id: uuid(), value: "1", label: "Metric" }] })}>+ Add metric</button></div>;
    case "gallery": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><div className={styles.nestedList}>{block.assets.map((item, index) => <div className={styles.nestedCard} key={item.id}><AssetField label={`Image ${index + 1}`} value={item.assetId} onChange={(assetId) => onChange({ ...block, assets: block.assets.map((entry) => entry.id === item.id ? { ...entry, assetId } : entry) })} /><TextField label="Alt text" value={item.alt} onChange={(alt) => onChange({ ...block, assets: block.assets.map((entry) => entry.id === item.id ? { ...entry, alt } : entry) })} /><button type="button" onClick={() => onChange({ ...block, assets: block.assets.filter((entry) => entry.id !== item.id) })}>Remove image</button></div>)}<button type="button" onClick={() => onChange({ ...block, assets: [...block.assets, { id: uuid(), assetId: null, alt: "" }] })}>+ Add image</button></div></>;
    case "video": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><AssetField label="Video asset" value={block.assetId} onChange={(assetId) => onChange({ ...block, assetId })} /><AssetField label="Poster asset" value={block.posterAssetId} onChange={(posterAssetId) => onChange({ ...block, posterAssetId })} /><TextField label="Caption" value={block.caption} multiline onChange={(caption) => onChange({ ...block, caption })} /></>;
    case "faq": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><div className={styles.nestedList}>{block.items.map((item, index) => <div className={styles.nestedCard} key={item.id}><TextField label={`Question ${index + 1}`} value={item.question} onChange={(question) => onChange({ ...block, items: block.items.map((entry) => entry.id === item.id ? { ...entry, question } : entry) })} /><TextField label="Answer" value={item.answer} multiline onChange={(answer) => onChange({ ...block, items: block.items.map((entry) => entry.id === item.id ? { ...entry, answer } : entry) })} /><button type="button" onClick={() => onChange({ ...block, items: block.items.filter((entry) => entry.id !== item.id) })}>Remove FAQ</button></div>)}<button type="button" onClick={() => onChange({ ...block, items: [...block.items, { id: uuid(), question: "Question", answer: "Answer" }] })}>+ Add FAQ</button></div></>;
    case "form": return <><label className={styles.field}><span>Form type</span><select value={block.variant} onChange={(event) => onChange({ ...block, variant: event.target.value as typeof block.variant })}><option value="lead">Lead</option><option value="subscription">Subscription</option></select></label><label className={styles.field}><span>Provider</span><select value={block.provider} onChange={(event) => onChange({ ...block, provider: event.target.value as typeof block.provider })}><option value="generic">Generic</option><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option></select></label><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><TextField label="Input label" value={block.inputLabel} onChange={(inputLabel) => onChange({ ...block, inputLabel })} /><TextField label="Placeholder" value={block.placeholder} onChange={(placeholder) => onChange({ ...block, placeholder })} /><TextField label="Consent" value={block.consentLabel} multiline onChange={(consentLabel) => onChange({ ...block, consentLabel })} /><TextField label="CTA label" value={block.ctaLabel} onChange={(ctaLabel) => onChange({ ...block, ctaLabel })} /><TextField label="Disclosure" value={block.disclosure} multiline onChange={(disclosure) => onChange({ ...block, disclosure })} /></>;
    case "cta": return <><TextField label="Title" value={block.title} onChange={(title) => onChange({ ...block, title })} /><TextField label="Body" value={block.body} multiline onChange={(body) => onChange({ ...block, body })} /><TextField label="CTA label" value={block.ctaLabel} onChange={(ctaLabel) => onChange({ ...block, ctaLabel })} /><TextField label="Destination" value={block.href} onChange={(href) => onChange({ ...block, href })} /></>;
    case "stickyCta": return <><TextField label="Label" value={block.label} onChange={(label) => onChange({ ...block, label })} /><TextField label="Destination" value={block.href} onChange={(href) => onChange({ ...block, href })} /></>;
    case "footer": return <><TextField label="Secure payment text" value={block.secureText} onChange={(secureText) => onChange({ ...block, secureText })} /><TextField label="Privacy text" value={block.privacyText} onChange={(privacyText) => onChange({ ...block, privacyText })} /><TextField label="Support text" value={block.supportText} onChange={(supportText) => onChange({ ...block, supportText })} /><TextField label="Legal text" value={block.legalText} multiline onChange={(legalText) => onChange({ ...block, legalText })} /></>;
  }
}

export function PageEditor({ initial, brands, campaigns, theme, recoveredInvalidDraft }: { initial: EditorInitial; brands: BrandOption[]; campaigns: CampaignOption[]; theme: BrandRenderTheme; recoveredInvalidDraft: boolean }) {
  const router = useRouter();
  const [document, setDocument] = useState(initial.document);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [brandId, setBrandId] = useState(initial.brandId);
  const [campaignId, setCampaignId] = useState(initial.campaignId ?? "");
  const [conversionGoal, setConversionGoal] = useState(initial.conversionGoal);
  const [revision, setRevision] = useState(initial.revision);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [newBlockType, setNewBlockType] = useState<BlockType>("benefits");
  const [message, setMessage] = useState(recoveredInvalidDraft ? "The stored draft was invalid; a minimal recovery document is loaded. Save to repair it." : "");
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);
  const [isPending, startTransition] = useTransition();
  const [duplicateBrand, setDuplicateBrand] = useState(initial.brandId);
  const [duplicateCampaign, setDuplicateCampaign] = useState(initial.campaignId ?? "");

  const compatibleCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.brandId === brandId), [campaigns, brandId]);
  const duplicateCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.brandId === duplicateBrand), [campaigns, duplicateBrand]);
  const touch = () => setDirty(true);
  const replaceBlock = (updated: PageBlock) => { setDocument((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === updated.id ? updated : block) })); touch(); };
  const moveBlock = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= document.blocks.length) return;
    const blocks = [...document.blocks];
    const [block] = blocks.splice(index, 1);
    if (!block) return;
    blocks.splice(nextIndex, 0, block);
    setDocument({ ...document, blocks }); touch();
  };

  const save = () => startTransition(async () => {
    setMessage("Saving…"); setIssues([]);
    const local = pageDocumentSchema.safeParse(document);
    if (!local.success) {
      setMessage("Fix validation errors before saving.");
      setIssues(local.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
      return;
    }
    const result = await savePageDraft({ id: initial.id, expectedRevision: revision, name, slug, brandId, campaignId: campaignId || null, conversionGoal, document: local.data });
    if (!result.ok) { setMessage(result.error); setIssues(result.issues ?? []); return; }
    setRevision(result.revision); setDirty(false); setMessage(`Saved revision ${result.revision}.`); router.refresh();
  });

  const duplicate = () => startTransition(async () => {
    setMessage("Duplicating…");
    try {
      const result = await duplicatePage({ sourceId: initial.id, targetBrandId: duplicateBrand, targetCampaignId: duplicateCampaign || null });
      router.push(`/pages/${result.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not duplicate page");
    }
  });

  return <main className={styles.editorShell}>
    <header className={styles.editorTopbar}>
      <div><span className={styles.kicker}>Page editor · r{revision}</span><input className={styles.titleInput} value={name} onChange={(event) => { setName(event.target.value); touch(); }} /></div>
      <div className={styles.topActions}><span className={dirty ? styles.unsaved : styles.saved}>{dirty ? "Unsaved changes" : "Saved"}</span><button type="button" disabled={isPending || initial.status === "archived"} onClick={save}>{isPending ? "Working…" : "Save draft"}</button></div>
    </header>

    {message && <div className={styles.message}>{message}</div>}
    {issues.length > 0 && <div className={styles.validation}><strong>Validation issues</strong>{issues.map((issue, index) => <div key={`${issue.path}-${index}`}><code>{issue.path || "page"}</code> {issue.message}</div>)}</div>}

    <div className={styles.workspace}>
      <aside className={styles.controls}>
        <section className={styles.panel}>
          <h2>Page settings</h2>
          <TextField label="URL slug" value={slug} onChange={(value) => { setSlug(value); touch(); }} />
          <label className={styles.field}><span>Brand</span><select value={brandId} onChange={(event) => { setBrandId(event.target.value); setCampaignId(""); touch(); }}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className={styles.field}><span>Campaign</span><select value={campaignId} onChange={(event) => { setCampaignId(event.target.value); touch(); }}><option value="">No campaign</option>{compatibleCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
          <TextField label="Conversion goal" value={conversionGoal} onChange={(value) => { setConversionGoal(value); touch(); }} />
          <label className={styles.field}><span>Style preset</span><select value={document.stylePreset} onChange={(event) => { setDocument({ ...document, stylePreset: event.target.value as PageDocument["stylePreset"] }); touch(); }}><option value="clean-light">Clean light</option><option value="premium-purple">Premium purple</option><option value="campaign-dark">Campaign dark</option><option value="promotion">Promotion</option><option value="minimal">Minimal</option></select></label>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>Blocks</h2><span>{document.blocks.length}</span></div>
          {document.blocks.map((block, index) => <details className={styles.blockCard} key={block.id} open={index < 2}>
            <summary><span>{index + 1}. {blockLabel(block.type)}</span><em>{block.visible ? "Visible" : "Hidden"}</em></summary>
            <div className={styles.blockActions}><button type="button" disabled={index === 0} onClick={() => moveBlock(index, -1)}>↑</button><button type="button" disabled={index === document.blocks.length - 1} onClick={() => moveBlock(index, 1)}>↓</button><button type="button" onClick={() => replaceBlock({ ...block, visible: !block.visible } as PageBlock)}>{block.visible ? "Hide" : "Show"}</button><button type="button" disabled={document.blocks.length === 1} onClick={() => { setDocument({ ...document, blocks: document.blocks.filter((entry) => entry.id !== block.id) }); touch(); }}>Delete</button></div>
            <BlockFields block={block} onChange={replaceBlock} />
          </details>)}
          <div className={styles.addBlock}><select value={newBlockType} onChange={(event) => setNewBlockType(event.target.value as BlockType)}>{BLOCK_TYPES.map((type) => <option key={type} value={type}>{blockLabel(type)}</option>)}</select><button type="button" onClick={() => { setDocument({ ...document, blocks: [...document.blocks, createBlock(newBlockType)] }); touch(); }}>+ Add block</button></div>
        </section>

        <section className={styles.panel}>
          <h2>Duplicate</h2>
          <p>Create an independent draft with fresh block IDs.</p>
          <label className={styles.field}><span>Target brand</span><select value={duplicateBrand} onChange={(event) => { setDuplicateBrand(event.target.value); setDuplicateCampaign(""); }}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className={styles.field}><span>Target campaign</span><select value={duplicateCampaign} onChange={(event) => setDuplicateCampaign(event.target.value)}><option value="">No campaign</option>{duplicateCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
          <button type="button" disabled={isPending} onClick={duplicate}>Duplicate page</button>
        </section>
      </aside>

      <section className={styles.previewColumn}>
        <div className={styles.previewToolbar}><div><strong>Live draft preview</strong><span>Same shared renderer used by public pages</span></div><div><button className={device === "desktop" ? styles.activeDevice : ""} type="button" onClick={() => setDevice("desktop")}>Desktop</button><button className={device === "mobile" ? styles.activeDevice : ""} type="button" onClick={() => setDevice("mobile")}>Mobile</button></div></div>
        <div className={`${styles.previewCanvas} ${device === "mobile" ? styles.mobile : styles.desktop}`}><PageRenderer document={document} theme={theme} /></div>
      </section>
    </div>
  </main>;
}
