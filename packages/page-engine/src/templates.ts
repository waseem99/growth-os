import type { PageDocument } from "./schema";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const skillupBlocks = (promotional: boolean): PageDocument["blocks"] => [
  { id: u(6001), type: "header", visible: true, logoAssetId: null, badge: "PREMIUM", trustText: "Trusted by learners across Pakistan" },
  { id: u(6002), type: "hero", visible: true, variant: promotional ? "promotional" : "clean", eyebrow: "", headline: "Learn AI skills through games", highlightedText: promotional ? "WIN" : "better learning", subheadline: promotional ? "Play, learn and unlock monthly rewards." : "Build practical skills through a game-first learning experience.", heroAssetId: null, backgroundAssetId: null, partnerLogoAssetId: null, promoHeadline: promotional ? "WIN Rancher's vouchers every month!" : "", promoSubheadline: promotional ? "Limited campaign reward for active subscribers." : "" },
  { id: u(6003), type: "benefits", visible: true, variant: "inline", items: [
    { id: u(6011), title: "Game khelo", text: "Learn AI skills through games", iconAssetId: null },
    { id: u(6012), title: "Skill seekho", text: "Build in-demand skills", iconAssetId: null },
    { id: u(6013), title: "Zyada kamao", text: "Boost career and earning potential", iconAssetId: null },
    { id: u(6014), title: "Learn anywhere", text: "Mobile-first learning", iconAssetId: null }
  ] },
  { id: u(6004), type: "form", visible: true, variant: "subscription", title: "Enter Your JazzCash Number", provider: "jazzcash", inputLabel: "JazzCash mobile number", placeholder: "03XX XXXXXXX", consentLabel: "I agree to SkillUp Terms and Conditions & Auto-Renewals", ctaLabel: "Pay Now", disclosure: "The current offer version supplies the initial and recurring subscription terms shown here." },
  { id: u(6005), type: "showcase", visible: true, title: "What You Can Learn", intro: "and much more", items: [
    { id: u(6021), title: "Freelancing & Remote Work", text: "Online kaam seekho aur earning shuru karo", iconAssetId: null },
    { id: u(6022), title: "Business & Entrepreneurship", text: "Apna business samjho aur grow karo", iconAssetId: null },
    { id: u(6023), title: "Marketing, Content & Growth", text: "Apna brand banao aur audience tak pahocho", iconAssetId: null },
    { id: u(6024), title: "Career & Employability", text: "Naukri ke liye skills seekho aur ready ho jao", iconAssetId: null }
  ] },
  { id: u(6006), type: "footer", visible: true, secureText: "Secure Payments · Powered by JazzCash", privacyText: "Aapka data safe hai · 100% Secure", supportText: "Help jab chahiye · 24/7 Support", legalText: "Continuing means you agree to the configured Terms and Conditions and Privacy Policy." }
];

export const skillupCleanReference: PageDocument = { schemaVersion: 1, templateKey: "subscription-acquisition", stylePreset: "clean-light", blocks: skillupBlocks(false) };
export const skillupRanchersReference: PageDocument = { schemaVersion: 1, templateKey: "subscription-acquisition", stylePreset: "campaign-dark", blocks: skillupBlocks(true) };

export const contentAcquisitionTemplate: PageDocument = { schemaVersion: 1, templateKey: "content-acquisition", stylePreset: "campaign-dark", blocks: [
  { id: u(6101), type: "header", visible: true, logoAssetId: null, badge: "", trustText: "" },
  { id: u(6102), type: "hero", visible: true, variant: "product", eyebrow: "Featured", headline: "Entertainment worth opening for", highlightedText: "", subheadline: "Lead with the campaign title, talent and strongest content hook.", heroAssetId: null, backgroundAssetId: null, partnerLogoAssetId: null, promoHeadline: "", promoSubheadline: "" },
  { id: u(6103), type: "showcase", visible: true, title: "Trending now", intro: "", items: [{ id: u(6111), title: "Featured content", text: "Replace with campaign content", iconAssetId: null }] },
  { id: u(6104), type: "cta", visible: true, title: "Start watching", body: "", ctaLabel: "Watch now", href: "#" },
  { id: u(6105), type: "footer", visible: true, secureText: "", privacyText: "Privacy protected", supportText: "Support available", legalText: "" }
] };

export const gameAcquisitionTemplate: PageDocument = { schemaVersion: 1, templateKey: "game-acquisition", stylePreset: "premium-purple", blocks: [
  { id: u(6201), type: "header", visible: true, logoAssetId: null, badge: "", trustText: "" },
  { id: u(6202), type: "hero", visible: true, variant: "product", eyebrow: "Play now", headline: "Your next game starts here", highlightedText: "", subheadline: "Fast, mobile-first game acquisition page.", heroAssetId: null, backgroundAssetId: null, partnerLogoAssetId: null, promoHeadline: "", promoSubheadline: "" },
  { id: u(6203), type: "benefits", visible: true, variant: "cards", items: [{ id: u(6211), title: "Instant play", text: "Get into the game quickly", iconAssetId: null }, { id: u(6212), title: "Rewards", text: "Campaign-specific reward messaging", iconAssetId: null }] },
  { id: u(6204), type: "gallery", visible: true, title: "Game preview", assets: [{ id: u(6221), assetId: null, alt: "Game screenshot" }] },
  { id: u(6205), type: "cta", visible: true, title: "Ready?", body: "", ctaLabel: "Play now", href: "#" },
  { id: u(6206), type: "footer", visible: true, secureText: "", privacyText: "Privacy protected", supportText: "Support available", legalText: "" }
] };

export const starterTemplates = [
  { key: "subscription-acquisition", name: "Subscription Acquisition", description: "Offer-led subscription conversion flow", document: skillupCleanReference },
  { key: "content-acquisition", name: "Content Acquisition", description: "Media/content subscription acquisition", document: contentAcquisitionTemplate },
  { key: "game-acquisition", name: "Game Acquisition", description: "Game/product acquisition", document: gameAcquisitionTemplate }
] as const;
