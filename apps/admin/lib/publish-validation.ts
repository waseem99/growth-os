import { pageDocumentSchema, pageSeoSchema, type PageDocument, type PageSeo } from "@growth-os/page-engine";

export type PublishValidationInput = {
  document: unknown;
  seo: unknown;
  domainRequired: boolean;
  domainVerified: boolean;
  invalidAssetIds?: string[];
};

export type PublishFinding = { path: string; message: string };

export function validatePublishInput(input: PublishValidationInput):
  | { ok: true; document: PageDocument; seo: PageSeo }
  | { ok: false; findings: PublishFinding[] } {
  const findings: PublishFinding[] = [];
  const page = pageDocumentSchema.safeParse(input.document);
  if (!page.success) findings.push(...page.error.issues.map((issue) => ({ path: `content.${issue.path.join(".")}`, message: issue.message })));
  const seo = pageSeoSchema.safeParse(input.seo);
  if (!seo.success) findings.push(...seo.error.issues.map((issue) => ({ path: `seo.${issue.path.join(".")}`, message: issue.message })));
  if (input.domainRequired && !input.domainVerified) findings.push({ path: "domain", message: "Assigned domain must be verified before publishing." });
  for (const assetId of input.invalidAssetIds ?? []) findings.push({ path: "assets", message: `Asset ${assetId} is missing or belongs to another brand.` });
  if (findings.length || !page.success || !seo.success) return { ok: false, findings };
  return { ok: true, document: page.data, seo: seo.data };
}
