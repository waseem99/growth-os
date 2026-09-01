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
        <p>Build, publish and optimize controlled multi-brand acquisition pages from one internal operating system.</p>
      </section>
      <section className="grid" aria-label="GrowthOS modules">
        {modules.map((module) => <article className="card" key={module}><span>P0</span><h2>{module}</h2></article>)}
      </section>
    </main>
  );
}
