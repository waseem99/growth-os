import Link from "next/link";
import { getRuntimeConfig } from "@growth-os/config";
import { requireGrowthUser } from "@/lib/user-access";

export default async function AdminHome() {
  const config = getRuntimeConfig();
  const user = await requireGrowthUser();
  const isAdmin = user.role === "owner" || user.role === "admin";
  const steps = [
    {
      number: "01",
      title: isAdmin ? "Set up the brand + domain" : "Choose the brand",
      body: isAdmin ? "Create the product once, then attach its public hostname and brand defaults." : "Use an active brand that an administrator has already configured for you.",
      href: isAdmin ? "/brands" : "/pages",
      cta: isAdmin ? "Open Brands & Domains" : "Open Landing Pages"
    },
    { number: "02", title: "Create the landing page", body: "Choose the brand, template and optional campaign. Then edit copy, sections and assets.", href: "/pages", cta: "Open Landing Pages" },
    { number: "03", title: "Preview and publish", body: "Preview the exact draft, validate it, then publish an immutable version when it is ready.", href: "/pages", cta: "Manage Pages" }
  ];

  return (
    <main className="shell operator-home">
      <section className="operator-hero">
        <div>
          <p className="eyebrow">GrowthOS · {config.environment}</p>
          <h1>Your landing-page workspace.</h1>
          <p>Most of the time you only need three things: set up the brand/domain, create the page, then preview and publish it.</p>
        </div>
        <Link className="primary-button operator-create" href="/pages">Create landing page</Link>
      </section>

      <section className="quick-start" aria-labelledby="quick-start-heading">
        <div className="section-heading"><p className="eyebrow">Normal workflow</p><h2 id="quick-start-heading">Start here</h2></div>
        <div className="quick-start-grid">
          {steps.map((step) => (
            <article className="quick-step" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <Link href={step.href}>{step.cta} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="operator-secondary">
        <div><strong>Campaigns</strong><span>Use when you want TikTok/Meta/Google tracking, UTMs or offer attribution.</span></div>
        <div><strong>Assets</strong><span>Upload and reuse campaign images/videos across pages.</span></div>
        <div><strong>Analytics</strong><span>Review visits, CTA activity and conversion performance after traffic starts.</span></div>
        <div><strong>More</strong><span>Experiments, AI, integrations, users and audit tools live here when you need them.</span></div>
      </section>
    </main>
  );
}
