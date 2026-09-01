import type { ReactNode } from "react";
import type { BrandRenderTheme, OfferSnapshot, PageBlock, PageDocument } from "./schema";

export type PageRendererProps = { document: PageDocument; theme?: BrandRenderTheme; offer?: OfferSnapshot; resolveAsset?: (assetId: string) => string | undefined };

function Media({ id, alt, resolveAsset }: { id?: string | null; alt: string; resolveAsset?: (id: string) => string | undefined }) {
  if (!id) return null;
  const src = resolveAsset?.(id);
  if (!src) return <span className="go-media-placeholder" data-asset-id={id} aria-label={alt}>{alt || "Media"}</span>;
  return <img className="go-media" src={src} alt={alt} loading="lazy" />;
}

const money = (value: string | null | undefined, currency: string) => value == null ? "" : `${currency} ${Number(value).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

function Block({ block, offer, resolveAsset }: { block: PageBlock; offer?: OfferSnapshot; resolveAsset?: PageRendererProps["resolveAsset"] }): ReactNode {
  if (!block.visible) return null;
  switch (block.type) {
    case "header": return <header className="go-header"><Media id={block.logoAssetId} alt="Brand logo" resolveAsset={resolveAsset} /><strong>{block.badge}</strong><span>{block.trustText}</span></header>;
    case "hero": return <section className={`go-hero go-hero--${block.variant}`}><div><span className="go-kicker">{block.eyebrow}</span><h1>{block.headline}</h1>{block.highlightedText && <strong className="go-highlight">{block.highlightedText}</strong>}<p>{block.subheadline}</p>{block.promoHeadline && <div className="go-promo"><b>{block.promoHeadline}</b><span>{block.promoSubheadline}</span></div>}</div><div className="go-hero-media"><Media id={block.heroAssetId} alt="Campaign hero" resolveAsset={resolveAsset} /><Media id={block.partnerLogoAssetId} alt="Campaign partner" resolveAsset={resolveAsset} /></div></section>;
    case "benefits": return <section className={`go-items go-items--${block.variant}`}>{block.items.map((x) => <article key={x.id}><Media id={x.iconAssetId} alt="" resolveAsset={resolveAsset} /><b>{x.title}</b><span>{x.text}</span></article>)}</section>;
    case "showcase": case "socialProof": case "steps": case "comparison": return <section className="go-section"><h2>{"title" in block ? block.title : ""}</h2>{"intro" in block && <p>{block.intro}</p>}<div className="go-card-grid">{block.items.map((x) => <article key={x.id}><Media id={"iconAssetId" in x ? x.iconAssetId : null} alt="" resolveAsset={resolveAsset} /><h3>{x.title}</h3><p>{x.text}</p></article>)}</div></section>;
    case "pricing": return <section className="go-section go-pricing"><h2>{block.title}</h2><p>{block.body}</p><strong>{offer?.recurringAmount ? `${money(offer.recurringAmount, offer.currency)} / ${offer.billingInterval ?? "period"}` : "Offer configured at publish time"}</strong><a href="#checkout">{block.ctaLabel}</a></section>;
    case "stats": return <section className="go-stats">{block.items.map((x) => <div key={x.id}><b>{x.value}</b><span>{x.label}</span></div>)}</section>;
    case "gallery": return <section className="go-section"><h2>{block.title}</h2><div className="go-gallery">{block.assets.map((x) => <Media key={x.id} id={x.assetId} alt={x.alt} resolveAsset={resolveAsset} />)}</div></section>;
    case "video": return <section className="go-section"><h2>{block.title}</h2><Media id={block.posterAssetId ?? block.assetId} alt={block.caption || "Video"} resolveAsset={resolveAsset} /><p>{block.caption}</p></section>;
    case "faq": return <section className="go-section"><h2>{block.title}</h2>{block.items.map((x) => <details key={x.id}><summary>{x.question}</summary><p>{x.answer}</p></details>)}</section>;
    case "form": return <section className="go-checkout" id="checkout"><h2>{block.title}</h2><label>{block.inputLabel}<input inputMode="tel" placeholder={block.placeholder} /></label><label className="go-consent"><input type="checkbox" /> {block.consentLabel}</label><button type="button">{block.ctaLabel}</button><div className="go-offer-note">{offer?.initialAmount && <b>Start for {money(offer.initialAmount, offer.currency)}. </b>}{offer?.recurringAmount && <span>{offer.trialDays ? `After ${offer.trialDays} day${offer.trialDays === 1 ? "" : "s"}, ` : ""}{money(offer.recurringAmount, offer.currency)}/{offer.billingInterval ?? "period"}{offer.autoRenew ? " auto-renews." : "."}</span>}<p>{block.disclosure}</p></div></section>;
    case "cta": return <section className="go-section go-cta"><h2>{block.title}</h2><p>{block.body}</p><a href={block.href}>{block.ctaLabel}</a></section>;
    case "stickyCta": return <a className="go-sticky" href={block.href}>{block.label}</a>;
    case "footer": return <footer className="go-footer"><div><span>{block.secureText}</span><span>{block.privacyText}</span><span>{block.supportText}</span></div><small>{block.legalText}</small></footer>;
  }
}

export function PageRenderer({ document, theme = {}, offer, resolveAsset }: PageRendererProps) {
  const style = { "--go-primary": theme.primary ?? "#6236ff", "--go-secondary": theme.secondary ?? "#17131f", "--go-bg": theme.background ?? "#fff", "--go-text": theme.text ?? "#15111f", "--go-radius": theme.radius ?? "16px", "--go-font": theme.fontFamily ?? "Inter, system-ui, sans-serif" } as React.CSSProperties;
  return <div className={`go-page go-preset--${document.stylePreset}`} style={style}>{document.blocks.map((block) => <Block key={block.id} block={block} offer={offer} resolveAsset={resolveAsset} />)}</div>;
}
