"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  assetUsages,
  assets,
  campaigns,
  domains,
  getDatabase,
  landingPages,
  pagePublications,
  pageVersions
} from "@growth-os/db";
import { pageDocumentSchema, pageSeoSchema } from "@growth-os/page-engine";
import { requirePermission } from "@/lib/user-access";
import { collectAssetReferences } from "@/lib/asset-references";
import { validatePublishInput } from "@/lib/publish-validation";

type ActionResult = { ok: true; message: string; versionId?: string; revision?: number } | { ok: false; error: string; findings?: Array<{ path: string; message: string }> };

const asJson = (value: unknown) => value as Record<string, unknown>;

export async function saveSeoDraft(input: { pageId: string; expectedRevision: number; seo: unknown }): Promise<ActionResult> {
  const actor = await requirePermission("pages:manage");
  const parsed = pageSeoSchema.safeParse(input.seo);
  if (!parsed.success) return { ok: false, error: "SEO validation failed", findings: parsed.error.issues.map((issue) => ({ path: `seo.${issue.path.join(".")}`, message: issue.message })) };
  const { db, client } = getDatabase();
  try {
    const [saved] = await db.update(landingPages).set({ draftSeo: asJson(parsed.data), draftRevision: input.expectedRevision + 1, updatedAt: new Date(), updatedBy: actor.id })
      .where(and(eq(landingPages.id, input.pageId), eq(landingPages.draftRevision, input.expectedRevision))).returning({ revision: landingPages.draftRevision });
    if (!saved) return { ok: false, error: "This page changed elsewhere. Reload before saving SEO." };
    revalidatePath(`/pages/${input.pageId}`);
    revalidatePath(`/pages/${input.pageId}/publishing`);
    return { ok: true, message: "SEO draft saved.", revision: saved.revision };
  } finally { await client.end(); }
}

export async function publishPage(input: { pageId: string; expectedRevision: number; publishNote?: string }): Promise<ActionResult> {
  const actor = await requirePermission("pages:manage");
  const { db, client } = getDatabase();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.pageId}))`);
      const [page] = await tx.select({
        id: landingPages.id,
        brandId: landingPages.brandId,
        domainId: landingPages.domainId,
        campaignId: landingPages.campaignId,
        content: landingPages.draftContent,
        seo: landingPages.draftSeo,
        revision: landingPages.draftRevision,
        status: landingPages.status
      }).from(landingPages).where(eq(landingPages.id, input.pageId)).limit(1);
      if (!page) return { ok: false as const, error: "Page not found." };
      if (page.status === "archived") return { ok: false as const, error: "Archived pages cannot be published." };
      if (page.revision !== input.expectedRevision) return { ok: false as const, error: "Draft changed after this publish screen loaded. Reload and review before publishing." };

      let domainVerified = true;
      if (page.domainId) {
        const [domain] = await tx.select({ status: domains.status, brandId: domains.brandId }).from(domains).where(eq(domains.id, page.domainId)).limit(1);
        domainVerified = Boolean(domain && domain.status === "verified" && domain.brandId === page.brandId);
      }
      const seoProbe = pageSeoSchema.safeParse(page.seo);
      const invalidAssets = await (async () => {
        const doc = pageDocumentSchema.safeParse(page.content);
        if (!doc.success) return [];
        const socialAssetId = seoProbe.success ? seoProbe.data.socialAssetId : null;
        const ids = [...new Set([...collectAssetReferences(doc.data).map((reference) => reference.assetId), ...(socialAssetId ? [socialAssetId] : [])])];
        if (!ids.length) return [];
        const rows = await tx.select({ id: assets.id, brandId: assets.brandId }).from(assets).where(inArray(assets.id, ids));
        const valid = new Set(rows.filter((asset) => asset.brandId === page.brandId).map((asset) => asset.id));
        return ids.filter((id) => !valid.has(id));
      })();
      const validation = validatePublishInput({ document: page.content, seo: page.seo, domainRequired: Boolean(page.domainId), domainVerified, invalidAssetIds: invalidAssets });
      if (!validation.ok) return { ok: false as const, error: "Publication validation failed.", findings: validation.findings };

      const [latest] = await tx.select({ number: pageVersions.versionNumber }).from(pageVersions).where(eq(pageVersions.pageId, page.id)).orderBy(desc(pageVersions.versionNumber)).limit(1);
      const [campaign] = page.campaignId ? await tx.select({ offerVersionId: campaigns.offerVersionId }).from(campaigns).where(eq(campaigns.id, page.campaignId)).limit(1) : [];
      const [version] = await tx.insert(pageVersions).values({
        pageId: page.id,
        offerVersionId: campaign?.offerVersionId ?? null,
        versionNumber: (latest?.number ?? 0) + 1,
        schemaVersion: validation.document.schemaVersion,
        content: asJson(validation.document),
        seo: asJson(validation.seo),
        publishNote: input.publishNote?.trim().slice(0, 500) || null,
        createdBy: actor.id
      }).returning({ id: pageVersions.id, number: pageVersions.versionNumber });
      if (!version) throw new Error("VERSION_CREATE_FAILED");

      await tx.insert(pagePublications).values({ pageId: page.id, versionId: version.id, publishedAt: new Date(), publishedBy: actor.id })
        .onConflictDoUpdate({ target: pagePublications.pageId, set: { versionId: version.id, publishedAt: new Date(), publishedBy: actor.id } });
      await tx.update(landingPages).set({ draftRevision: page.revision + 1, updatedAt: new Date(), updatedBy: actor.id })
        .where(and(eq(landingPages.id, page.id), eq(landingPages.draftRevision, page.revision)));

      const references = collectAssetReferences(validation.document);
      if (validation.seo.socialAssetId) references.push({ assetId: validation.seo.socialAssetId, fieldPath: "seo.socialAssetId" });
      if (references.length) await tx.insert(assetUsages).values(references.map((reference) => ({ assetId: reference.assetId, entityType: "page_version", entityId: version.id, fieldPath: reference.fieldPath }))).onConflictDoNothing();

      revalidatePath(`/pages/${page.id}`);
      revalidatePath(`/pages/${page.id}/publishing`);
      revalidatePath("/pages");
      return { ok: true as const, message: `Published version ${version.number}.`, versionId: version.id, revision: page.revision + 1 };
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Publish failed." };
  } finally { await client.end(); }
}

export async function rollbackPage(input: { pageId: string; versionId: string; expectedCurrentVersionId: string | null }): Promise<ActionResult> {
  const actor = await requirePermission("pages:manage");
  const { db, client } = getDatabase();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.pageId}))`);
      const [target] = await tx.select({ id: pageVersions.id, number: pageVersions.versionNumber }).from(pageVersions).where(and(eq(pageVersions.id, input.versionId), eq(pageVersions.pageId, input.pageId))).limit(1);
      if (!target) return { ok: false as const, error: "Target version does not belong to this page." };
      const [current] = await tx.select({ versionId: pagePublications.versionId }).from(pagePublications).where(eq(pagePublications.pageId, input.pageId)).limit(1);
      if ((current?.versionId ?? null) !== input.expectedCurrentVersionId) return { ok: false as const, error: "Published version changed elsewhere. Reload before rolling back." };
      await tx.insert(pagePublications).values({ pageId: input.pageId, versionId: target.id, publishedAt: new Date(), publishedBy: actor.id })
        .onConflictDoUpdate({ target: pagePublications.pageId, set: { versionId: target.id, publishedAt: new Date(), publishedBy: actor.id } });
      revalidatePath(`/pages/${input.pageId}/publishing`);
      return { ok: true as const, message: `Rolled back to version ${target.number}.`, versionId: target.id };
    });
  } finally { await client.end(); }
}

export async function unpublishPage(input: { pageId: string; expectedCurrentVersionId: string }): Promise<ActionResult> {
  await requirePermission("pages:manage");
  const { db, client } = getDatabase();
  try {
    const [deleted] = await db.delete(pagePublications).where(and(eq(pagePublications.pageId, input.pageId), eq(pagePublications.versionId, input.expectedCurrentVersionId))).returning({ pageId: pagePublications.pageId });
    if (!deleted) return { ok: false, error: "Published version changed elsewhere. Reload before unpublishing." };
    revalidatePath(`/pages/${input.pageId}/publishing`);
    revalidatePath("/pages");
    return { ok: true, message: "Page unpublished. Public resolution will return not found." };
  } finally { await client.end(); }
}
