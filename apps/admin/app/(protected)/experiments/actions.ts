"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { experimentVariantsSchema } from "@growth-os/experiments";
import { getDatabase } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";

const clean = (value: FormDataEntryValue | null, max = 240) => String(value ?? "").trim().slice(0, max);
const number = (value: FormDataEntryValue | null) => Number(clean(value, 12));

type ExperimentRow = { id: string; page_id: string; campaign_id: string | null; status: "draft" | "running" | "paused" | "ended" };
type VariantRow = { id: string; name: string; page_version_id: string; allocation: number; is_control: boolean; version_page_id: string };

export async function createExperiment(formData: FormData) {
  await requirePermission("campaigns:manage");
  const name = clean(formData.get("name"), 160);
  const pageId = clean(formData.get("pageId"), 80);
  if (!name || !pageId) throw new Error("EXPERIMENT_INPUT_REQUIRED");
  const { client } = getDatabase();
  let id = "";
  try {
    const [page] = await client<{ id: string; campaign_id: string | null }[]>`SELECT id::text AS id, campaign_id::text AS campaign_id FROM landing_pages WHERE id=${pageId}::uuid AND status='draft' LIMIT 1`;
    if (!page) throw new Error("EXPERIMENT_PAGE_NOT_FOUND");
    const [created] = await client<{ id: string }[]>`INSERT INTO experiments (page_id, campaign_id, name, status) VALUES (${pageId}::uuid, ${page.campaign_id}::uuid, ${name}, 'draft') RETURNING id::text AS id`;
    if (!created) throw new Error("EXPERIMENT_CREATE_FAILED");
    id = created.id;
  } finally {
    await client.end();
  }
  redirect(`/experiments/${id}`);
}

export async function addExperimentVariant(formData: FormData) {
  await requirePermission("campaigns:manage");
  const experimentId = clean(formData.get("experimentId"), 80);
  const pageVersionId = clean(formData.get("pageVersionId"), 80);
  const name = clean(formData.get("name"), 120);
  const allocation = number(formData.get("allocation"));
  const isControl = formData.get("isControl") === "on";
  if (!experimentId || !pageVersionId || !name || !Number.isInteger(allocation) || allocation < 0 || allocation > 100) throw new Error("INVALID_VARIANT_INPUT");
  const { client } = getDatabase();
  try {
    const [experiment] = await client<ExperimentRow[]>`SELECT id::text AS id, page_id::text AS page_id, campaign_id::text AS campaign_id, status FROM experiments WHERE id=${experimentId}::uuid LIMIT 1`;
    if (!experiment || experiment.status !== "draft") throw new Error("EXPERIMENT_VARIANTS_LOCKED");
    const [version] = await client<{ id: string }[]>`SELECT id::text AS id FROM page_versions WHERE id=${pageVersionId}::uuid AND page_id=${experiment.page_id}::uuid LIMIT 1`;
    if (!version) throw new Error("VARIANT_VERSION_PAGE_MISMATCH");
    if (isControl) await client`UPDATE variants SET is_control=false WHERE experiment_id=${experimentId}::uuid`;
    await client`INSERT INTO variants (experiment_id, page_version_id, name, allocation, is_control) VALUES (${experimentId}::uuid, ${pageVersionId}::uuid, ${name}, ${allocation}, ${isControl})`;
  } finally {
    await client.end();
  }
  revalidatePath(`/experiments/${experimentId}`);
}

export async function removeExperimentVariant(formData: FormData) {
  await requirePermission("campaigns:manage");
  const experimentId = clean(formData.get("experimentId"), 80);
  const variantId = clean(formData.get("variantId"), 80);
  const { client } = getDatabase();
  try {
    const [experiment] = await client<ExperimentRow[]>`SELECT id::text AS id, page_id::text AS page_id, campaign_id::text AS campaign_id, status FROM experiments WHERE id=${experimentId}::uuid LIMIT 1`;
    if (!experiment || experiment.status !== "draft") throw new Error("EXPERIMENT_VARIANTS_LOCKED");
    await client`DELETE FROM variants WHERE id=${variantId}::uuid AND experiment_id=${experimentId}::uuid`;
  } finally { await client.end(); }
  revalidatePath(`/experiments/${experimentId}`);
}

export async function saveExperimentAllocation(formData: FormData) {
  await requirePermission("campaigns:manage");
  const experimentId = clean(formData.get("experimentId"), 80);
  const controlId = clean(formData.get("controlId"), 80);
  const { client } = getDatabase();
  try {
    const [experiment] = await client<ExperimentRow[]>`SELECT id::text AS id, page_id::text AS page_id, campaign_id::text AS campaign_id, status FROM experiments WHERE id=${experimentId}::uuid LIMIT 1`;
    if (!experiment || experiment.status !== "draft") throw new Error("EXPERIMENT_VARIANTS_LOCKED");
    const rows = await client<VariantRow[]>`SELECT v.id::text AS id, v.name, v.page_version_id::text AS page_version_id, v.allocation, v.is_control, pv.page_id::text AS version_page_id FROM variants v JOIN page_versions pv ON pv.id=v.page_version_id WHERE v.experiment_id=${experimentId}::uuid ORDER BY v.created_at`;
    const proposed = rows.map((row) => ({
      id: row.id,
      name: row.name,
      pageVersionId: row.page_version_id,
      allocation: number(formData.get(`allocation:${row.id}`)),
      isControl: row.id === controlId
    }));
    const parsed = experimentVariantsSchema.safeParse(proposed);
    if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
    if (rows.some((row) => row.version_page_id !== experiment.page_id)) throw new Error("VARIANT_VERSION_PAGE_MISMATCH");
    await client.begin(async (tx) => {
      for (const variant of parsed.data) await tx`UPDATE variants SET allocation=${variant.allocation}, is_control=${variant.isControl} WHERE id=${variant.id}::uuid AND experiment_id=${experimentId}::uuid`;
    });
  } finally { await client.end(); }
  revalidatePath(`/experiments/${experimentId}`);
}

export async function updateExperimentStatus(formData: FormData) {
  await requirePermission("campaigns:manage");
  const experimentId = clean(formData.get("experimentId"), 80);
  const action = clean(formData.get("action"), 30);
  if (!experimentId || !["start", "pause", "end"].includes(action)) throw new Error("INVALID_EXPERIMENT_ACTION");
  const { client } = getDatabase();
  try {
    const [experiment] = await client<ExperimentRow[]>`SELECT id::text AS id, page_id::text AS page_id, campaign_id::text AS campaign_id, status FROM experiments WHERE id=${experimentId}::uuid LIMIT 1`;
    if (!experiment) throw new Error("EXPERIMENT_NOT_FOUND");
    if (action === "start") {
      if (!["draft", "paused"].includes(experiment.status)) throw new Error("EXPERIMENT_CANNOT_START");
      const rows = await client<VariantRow[]>`SELECT v.id::text AS id, v.name, v.page_version_id::text AS page_version_id, v.allocation, v.is_control, pv.page_id::text AS version_page_id FROM variants v JOIN page_versions pv ON pv.id=v.page_version_id WHERE v.experiment_id=${experimentId}::uuid ORDER BY v.created_at`;
      const parsed = experimentVariantsSchema.safeParse(rows.map((row) => ({ id: row.id, name: row.name, pageVersionId: row.page_version_id, allocation: row.allocation, isControl: row.is_control })));
      if (!parsed.success || rows.some((row) => row.version_page_id !== experiment.page_id)) throw new Error("EXPERIMENT_VARIANTS_INVALID");
      const [other] = await client<{ id: string }[]>`SELECT id::text AS id FROM experiments WHERE page_id=${experiment.page_id}::uuid AND status='running' AND id<>${experimentId}::uuid LIMIT 1`;
      if (other) throw new Error("PAGE_ALREADY_HAS_RUNNING_EXPERIMENT");
      await client`UPDATE experiments SET status='running', starts_at=coalesce(starts_at, now()), ends_at=NULL, updated_at=now() WHERE id=${experimentId}::uuid`;
    } else if (action === "pause") {
      if (experiment.status !== "running") throw new Error("EXPERIMENT_NOT_RUNNING");
      await client`UPDATE experiments SET status='paused', updated_at=now() WHERE id=${experimentId}::uuid`;
    } else {
      if (!["running", "paused"].includes(experiment.status)) throw new Error("EXPERIMENT_CANNOT_END");
      await client`UPDATE experiments SET status='ended', ends_at=now(), updated_at=now() WHERE id=${experimentId}::uuid`;
    }
  } finally { await client.end(); }
  revalidatePath(`/experiments/${experimentId}`);
  revalidatePath("/experiments");
}
