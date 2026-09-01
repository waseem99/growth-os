import { chooseVariant, experimentVariantsSchema } from "@growth-os/experiments";
import { getDatabase } from "@growth-os/db";

export const EXPERIMENT_VISITOR_COOKIE = "growthos_visitor";

type ExperimentRow = {
  experiment_id: string;
  experiment_name: string;
  campaign_id: string | null;
  variant_id: string;
  variant_name: string;
  allocation: number;
  is_control: boolean;
  version_id: string;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  currency: string | null;
  initial_amount: string | null;
  recurring_amount: string | null;
  billing_interval: string | null;
  trial_days: number | null;
  auto_renew: boolean | null;
};

export type ExperimentResolution = {
  experimentId: string;
  experimentName: string;
  campaignId: string | null;
  variantId: string;
  variantName: string;
  isControl: boolean;
  versionId: string;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  offer?: {
    currency: string;
    initialAmount: string | null;
    recurringAmount: string | null;
    billingInterval: string | null;
    trialDays: number | null;
    autoRenew: boolean;
  };
};

export async function resolveExperimentVariant(pageId: string, visitorKey: string, forcedVariantId?: string | null): Promise<ExperimentResolution | null> {
  const { client } = getDatabase();
  try {
    const rows = forcedVariantId
      ? await client<ExperimentRow[]>`
          WITH selected AS (
            SELECT e.id, e.name, e.campaign_id
            FROM experiments e
            JOIN variants forced ON forced.experiment_id=e.id
            WHERE e.page_id=${pageId}::uuid AND forced.id=${forcedVariantId}::uuid
            ORDER BY e.created_at DESC
            LIMIT 1
          )
          SELECT
            selected.id::text AS experiment_id,
            selected.name AS experiment_name,
            selected.campaign_id::text AS campaign_id,
            v.id::text AS variant_id,
            v.name AS variant_name,
            v.allocation,
            v.is_control,
            pv.id::text AS version_id,
            pv.content,
            pv.seo,
            ov.currency,
            ov.initial_amount::text AS initial_amount,
            ov.recurring_amount::text AS recurring_amount,
            ov.billing_interval,
            ov.trial_days,
            ov.auto_renew
          FROM selected
          JOIN variants v ON v.experiment_id=selected.id
          JOIN page_versions pv ON pv.id=v.page_version_id AND pv.page_id=${pageId}::uuid
          LEFT JOIN offer_versions ov ON ov.id=pv.offer_version_id
          ORDER BY v.created_at, v.id`
      : await client<ExperimentRow[]>`
          WITH active AS (
            SELECT e.id, e.name, e.campaign_id
            FROM experiments e
            WHERE e.page_id=${pageId}::uuid
              AND e.status='running'
              AND (e.starts_at IS NULL OR e.starts_at <= now())
              AND (e.ends_at IS NULL OR e.ends_at > now())
            ORDER BY e.starts_at DESC NULLS LAST, e.created_at DESC
            LIMIT 1
          )
          SELECT
            active.id::text AS experiment_id,
            active.name AS experiment_name,
            active.campaign_id::text AS campaign_id,
            v.id::text AS variant_id,
            v.name AS variant_name,
            v.allocation,
            v.is_control,
            pv.id::text AS version_id,
            pv.content,
            pv.seo,
            ov.currency,
            ov.initial_amount::text AS initial_amount,
            ov.recurring_amount::text AS recurring_amount,
            ov.billing_interval,
            ov.trial_days,
            ov.auto_renew
          FROM active
          JOIN variants v ON v.experiment_id=active.id
          JOIN page_versions pv ON pv.id=v.page_version_id AND pv.page_id=${pageId}::uuid
          LEFT JOIN offer_versions ov ON ov.id=pv.offer_version_id
          ORDER BY v.created_at, v.id`;
    if (rows.length < 2) return null;

    const parsed = experimentVariantsSchema.safeParse(rows.map((row) => ({
      id: row.variant_id,
      name: row.variant_name,
      pageVersionId: row.version_id,
      allocation: row.allocation,
      isControl: row.is_control
    })));
    if (!parsed.success) return null;

    const forced = forcedVariantId ? rows.find((row) => row.variant_id === forcedVariantId) : null;
    const chosenInput = forced ?? chooseVariant(parsed.data, visitorKey, rows[0]!.experiment_id);
    const chosen = rows.find((row) => row.variant_id === chosenInput.id);
    if (!chosen) return null;
    return {
      experimentId: chosen.experiment_id,
      experimentName: chosen.experiment_name,
      campaignId: chosen.campaign_id,
      variantId: chosen.variant_id,
      variantName: chosen.variant_name,
      isControl: chosen.is_control,
      versionId: chosen.version_id,
      content: chosen.content,
      seo: chosen.seo,
      offer: chosen.currency ? {
        currency: chosen.currency,
        initialAmount: chosen.initial_amount,
        recurringAmount: chosen.recurring_amount,
        billingInterval: chosen.billing_interval,
        trialDays: chosen.trial_days,
        autoRenew: chosen.auto_renew ?? false
      } : undefined
    };
  } finally {
    await client.end();
  }
}
