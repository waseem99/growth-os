import { getRuntimeConfig } from "@growth-os/config";

const modules = [
  "Brands & domains",
  "Campaigns & offers",
  "Landing pages",
  "Assets",
  "Experiments",
  "Analytics",
  "AI assistant"
];

export default function AdminHome() {
  const config = getRuntimeConfig();

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">GrowthOS · {config.environment}</p>
        <h1>Acquisition operations, without developer bottlenecks.</h1>
        <p>
          The admin surface is isolated from the public renderer. Product workflows will be added issue-by-issue against the P0 backlog.
        </p>
      </section>
      <section className="grid" aria-label="Planned modules">
        {modules.map((module) => (
          <article className="card" key={module}>
            <span>Foundation</span>
            <h2>{module}</h2>
          </article>
        ))}
      </section>
    </main>
  );
}
