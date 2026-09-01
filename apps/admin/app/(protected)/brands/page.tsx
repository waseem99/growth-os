import Link from "next/link";
import { asc } from "drizzle-orm";
import { brands, getDatabase } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { createBrand } from "./actions";

export default async function BrandsPage() {
  await requirePermission("brands:manage");
  const { db, client } = getDatabase();
  const rows = await db.select({ id: brands.id, name: brands.name, slug: brands.slug, status: brands.status, theme: brands.theme }).from(brands).orderBy(asc(brands.name)).finally(async () => client.end());

  return (
    <main className="shell compact-shell">
      <section className="section-heading"><p className="eyebrow">Multi-brand</p><h1>Brands & products</h1><p>Add products here rather than creating new applications. Brand identity and public domain resolution stay configuration-driven.</p></section>
      <form className="brand-create" action={createBrand}>
        <input name="name" placeholder="Brand name" required />
        <input name="slug" placeholder="brand-slug" pattern="[a-z0-9-]+" required />
        <input type="hidden" name="primary" value="#6236ff" /><input type="hidden" name="secondary" value="#17131f" /><input type="hidden" name="background" value="#ffffff" /><input type="hidden" name="text" value="#15111f" /><input type="hidden" name="fontFamily" value="Inter, system-ui, sans-serif" /><input type="hidden" name="radius" value="16px" />
        <button className="primary-button" type="submit">Add brand</button>
      </form>
      <div className="brand-grid">
        {rows.map((brand) => {
          const theme = brand.theme as Record<string, string>;
          return <Link className="brand-card" href={`/brands/${brand.id}`} key={brand.id} style={{ borderTopColor: theme.primary || "#6236ff" }}><span>{brand.status}</span><h2>{brand.name}</h2><code>{brand.slug}</code></Link>;
        })}
      </div>
    </main>
  );
}
