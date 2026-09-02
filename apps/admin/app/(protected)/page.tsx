import Link from "next/link";
import { getRuntimeConfig } from "@growth-os/config";
import { requireGrowthUser } from "@/lib/user-access";

export default async function AdminHome() {
  const config = getRuntimeConfig();
  const user = await requireGrowthUser();
  const isAdmin = user.role === "owner" || user.role === "admin";
  const steps = [
    { number: "01", title: isAdmin ? "Set up each product once" : "Choose the product", body: isAdmin ? "Add the product and one primary acquisition domain. This is one-time setup, not a campaign task." : "Use a product that has already been configured.", href: isAdmin ? "/brands" : "/campaigns", cta: isAdmin ? "Products & domains" : "Campaigns" },
    { number: "02", title: "Create the campaign", body: "Choose product, Meta/TikTok and the campaign goal. Tracking details can stay optional until you need them.", href: "/campaigns", cta: "Create campaign" },
    { number: "03", title: "Upload the exact ad", body: "Save the image/video plus headline, primary ad text and CTA so GrowthOS has the exact campaign message.", href: "/assets", cta: "Upload ad creative" },
    { number: "04", title: "Create the matching page", body: "Start from the campaign. The latest ad visual and saved ad copy seed the landing-page hero and CTA automatically.", href: "/campaigns", cta: "Campaign workspace" },
    { number: "05", title: "Preview, publish, review", body: "The page uses the product's default verified domain. Preview, publish, then view campaign results in Analytics.", href: "/analytics", cta: "View results" }
  ];

  return (
    <main className="shell operator-home">
      <section className="operator-hero">
        <div>
          <p className="eyebrow">GrowthOS · {config.environment}</p>
          <h1>Ad → matching landing page → results.</h1>
          <p>For normal campaign work, DNS stays out of the way. Configure each product once, then work from Campaigns.</p>
        </div>
        <Link className="primary-button operator-create" href="/campaigns">Start campaign</Link>
      </section>

      <section className="quick-start" aria-labelledby="quick-start-heading">
        <div className="section-heading"><p className="eyebrow">Normal workflow</p><h2 id="quick-start-heading">Five simple steps</h2></div>
        <div className="quick-start-grid">
          {steps.map((step) => (
            <article className="quick-step" key={step.number}>
              <span>{step.number}</span><h3>{step.title}</h3><p>{step.body}</p><Link href={step.href}>{step.cta} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="operator-secondary">
        <div><strong>Products</strong><span>Brand defaults + one acquisition hostname per product.</span></div>
        <div><strong>Campaigns</strong><span>Your main workspace for Meta/TikTok launches.</span></div>
        <div><strong>Ad creative</strong><span>Exact visual and ad message used to seed matching pages.</span></div>
        <div><strong>Landing Pages</strong><span>Edit, preview, publish and version campaign pages.</span></div>
        <div><strong>Analytics</strong><span>Compare visits, CTA activity and conversions by campaign/page/creative.</span></div>
      </section>
    </main>
  );
}
