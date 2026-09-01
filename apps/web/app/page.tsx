import { getRuntimeConfig } from "@growth-os/config";

export default function RendererHome() {
  const config = getRuntimeConfig();

  return (
    <main>
      <section>
        <p className="eyebrow">GrowthOS renderer · {config.environment}</p>
        <h1>Public landing-page engine ready.</h1>
        <p>
          This app will resolve brand, domain, campaign and published page versions without loading admin-only code.
        </p>
      </section>
    </main>
  );
}
