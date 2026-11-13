"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { brands, getDatabase, offers, offerVersions, productPackages } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { writeAudit } from "@/lib/audit";

const codePattern = /^[a-z0-9]([a-z0-9_-]{0,62}[a-z0-9])?$/;
const pricePattern = /^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/;
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function createProductPackage(form: FormData) {
  const actor = await requirePermission("campaigns:manage");
  const brandId = text(form, "brandId");
  const code = text(form, "packageCode").toLowerCase();
  const name = text(form, "name").slice(0, 160);
  const price = text(form, "price");
  const recurring = text(form, "kind") === "recurring";
  const billingInterval = recurring ? text(form, "billingInterval") : null;
  const currency = text(form, "currency").toUpperCase();
  if (!codePattern.test(code) || !name || !pricePattern.test(price) || Number(price) <= 0) {
    throw new Error("INVALID_PACKAGE_CONFIGURATION");
  }
  if (!["PKR", "USD"].includes(currency)) throw new Error("UNSUPPORTED_PACKAGE_CURRENCY");
  if (recurring && !["day", "week", "month", "year"].includes(billingInterval ?? "")) {
    throw new Error("INVALID_BILLING_INTERVAL");
  }

  const { db, client } = getDatabase();
  let packageId = "";
  try {
    await db.transaction(async (tx) => {
      const [brand] = await tx.select({ id: brands.id }).from(brands).where(and(eq(brands.id, brandId), eq(brands.status, "active"))).limit(1);
      if (!brand) throw new Error("INVALID_PACKAGE_PRODUCT");
      const [offer] = await tx.insert(offers).values({ brandId, name, slug: `package-${code}` }).returning({ id: offers.id });
      if (!offer) throw new Error("PACKAGE_OFFER_CREATE_FAILED");
      const [version] = await tx.insert(offerVersions).values({
        offerId: offer.id, versionNumber: 1, currency,
        initialAmount: recurring ? null : price,
        recurringAmount: recurring ? price : null,
        billingInterval, createdBy: actor.id
      }).returning({ id: offerVersions.id });
      if (!version) throw new Error("PACKAGE_VERSION_CREATE_FAILED");
      const [record] = await tx.insert(productPackages).values({
        brandId, packageCode: code, offerVersionId: version.id, status: "draft", createdBy: actor.id
      }).returning({ id: productPackages.id });
      if (!record) throw new Error("PACKAGE_CODE_CREATE_FAILED");
      packageId = record.id;
    });
  } finally {
    await client.end();
  }
  await writeAudit({ actorUserId: actor.id, action: "product_package.created", entityType: "product_package", entityId: packageId, after: { brandId, code, currency, price, recurring, billingInterval, status: "draft" } });
  revalidatePath("/packages");
}

export async function setProductPackageStatus(form: FormData) {
  const actor = await requirePermission("campaigns:manage");
  const id = text(form, "id");
  const requested = text(form, "status");
  if (!["active", "draft", "archived"].includes(requested)) throw new Error("INVALID_PACKAGE_STATUS");
  const status = requested as "active" | "draft" | "archived";
  const { db, client } = getDatabase();
  let prior: string | null = null;
  try {
    const [record] = await db.select({ id: productPackages.id, status: productPackages.status }).from(productPackages).where(eq(productPackages.id, id)).limit(1);
    if (!record) throw new Error("PACKAGE_NOT_FOUND");
    prior = record.status;
    await db.update(productPackages).set({ status, updatedAt: new Date() }).where(eq(productPackages.id, id));
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "product_package.status_updated", entityType: "product_package", entityId: id, before: { status: prior }, after: { status } });
  revalidatePath("/packages");
}
