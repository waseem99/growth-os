import { deriveMetrics, type DerivedMetrics } from "@growth-os/analytics";
import { getDatabase } from "@growth-os/db";

export type AnalyticsFilters = {
  from: Date;
  to: Date;
  brandId?: string | null;
  campaignId?: string | null;
  pageId?: string | null;
  variantId?: string | null;
  creativeId?: string | null;
  platform?: string | null;
};

type EventSummaryRow = {
  landing_views: string;
  unique_sessions: string;
  cta_clicks: string;
  signup_starts: string;
  checkout_starts: string;
};
type ConversionSummaryRow = { signup_completes: string; purchases: string; subscriptions: string; revenue: string | null };
type BreakdownRow = { level: string; key: string; label: string; landing_views?: string; unique_sessions?: string; cta_clicks?: string; subscriptions?: string; revenue?: string | null };
type AttributionRow = { touch: "first" | "last"; source: string; conversions: string; revenue: string | null };
type CurrencyRow = { currency: string; revenue: string; conversions: string };

const n = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const text = (value: string | null | undefined) => value?.trim() || null;

function periodBounds(filters: AnalyticsFilters) {
  const duration = Math.max(1, filters.to.getTime() - filters.from.getTime());
  return { previousFrom: new Date(filters.from.getTime() - duration), previousTo: filters.from };
}

async function summarizePeriod(filters: AnalyticsFilters): Promise<DerivedMetrics> {
  const { client } = getDatabase();
  const brandId = text(filters.brandId);
  const campaignId = text(filters.campaignId);
  const pageId = text(filters.pageId);
  const variantId = text(filters.variantId);
  const creativeId = text(filters.creativeId);
  const platform = text(filters.platform);
  try {
    const [eventRows, conversionRows] = await Promise.all([
      client<EventSummaryRow[]>`
        SELECT
          count(*) FILTER (WHERE ae.event_name='landing_view')::text AS landing_views,
          count(DISTINCT ae.session_id) FILTER (WHERE ae.event_name='landing_view' AND ae.session_id IS NOT NULL)::text AS unique_sessions,
          count(*) FILTER (WHERE ae.event_name='cta_click')::text AS cta_clicks,
          count(*) FILTER (WHERE ae.event_name='signup_start')::text AS signup_starts,
          count(*) FILTER (WHERE ae.event_name='checkout_start')::text AS checkout_starts
        FROM analytics_events ae
        LEFT JOIN campaigns camp ON camp.id=ae.campaign_id
        WHERE ae.occurred_at >= ${filters.from} AND ae.occurred_at < ${filters.to}
          AND coalesce(ae.properties->>'testTraffic','false') <> 'true'
          AND (${brandId}::uuid IS NULL OR ae.brand_id=${brandId}::uuid)
          AND (${campaignId}::uuid IS NULL OR ae.campaign_id=${campaignId}::uuid)
          AND (${pageId}::uuid IS NULL OR ae.page_id=${pageId}::uuid)
          AND (${variantId}::uuid IS NULL OR ae.variant_id=${variantId}::uuid)
          AND (${creativeId}::text IS NULL OR ae.creative_id=${creativeId})
          AND (${platform}::text IS NULL OR camp.platform=${platform})`,
      client<ConversionSummaryRow[]>`
        SELECT
          count(*) FILTER (WHERE conv.event_name='signup_complete')::text AS signup_completes,
          count(*) FILTER (WHERE conv.event_name='purchase')::text AS purchases,
          count(*) FILTER (WHERE conv.event_name='subscription_started')::text AS subscriptions,
          coalesce(sum(conv.value),0)::text AS revenue
        FROM conversions conv
        LEFT JOIN campaigns camp ON camp.id=conv.campaign_id
        WHERE conv.occurred_at >= ${filters.from} AND conv.occurred_at < ${filters.to}
          AND coalesce(conv.properties->>'testTraffic','false') <> 'true'
          AND (${brandId}::uuid IS NULL OR conv.brand_id=${brandId}::uuid)
          AND (${campaignId}::uuid IS NULL OR conv.campaign_id=${campaignId}::uuid)
          AND (${pageId}::uuid IS NULL OR conv.page_id=${pageId}::uuid)
          AND (${variantId}::uuid IS NULL OR conv.variant_id=${variantId}::uuid)
          AND (${creativeId}::text IS NULL OR coalesce(conv.attribution #>> '{lastTouch,creativeId}', conv.attribution #>> '{firstTouch,creativeId}')=${creativeId})
          AND (${platform}::text IS NULL OR camp.platform=${platform})`
    ]);
    const events = eventRows[0];
    const conversions = conversionRows[0];
    return deriveMetrics({
      landingViews: n(events?.landing_views),
      uniqueSessions: n(events?.unique_sessions),
      ctaClicks: n(events?.cta_clicks),
      signupStarts: n(events?.signup_starts),
      signupCompletes: n(conversions?.signup_completes),
      checkoutStarts: n(events?.checkout_starts),
      purchases: n(conversions?.purchases),
      subscriptions: n(conversions?.subscriptions),
      revenue: n(conversions?.revenue)
    });
  } finally {
    await client.end();
  }
}

export type AnalyticsBreakdown = {
  level: string;
  key: string;
  label: string;
  landingViews: number;
  uniqueSessions: number;
  ctaClicks: number;
  subscriptions: number;
  revenue: number;
};

async function breakdown(filters: AnalyticsFilters): Promise<AnalyticsBreakdown[]> {
  const { client } = getDatabase();
  const brandId = text(filters.brandId);
  const campaignId = text(filters.campaignId);
  const pageId = text(filters.pageId);
  const variantId = text(filters.variantId);
  const creativeId = text(filters.creativeId);
  const platform = text(filters.platform);
  try {
    const [eventRows, conversionRows] = await Promise.all([
      client<BreakdownRow[]>`
        WITH filtered AS (
          SELECT ae.*, b.name AS brand_name, camp.name AS campaign_label, camp.platform, lp.name AS page_label, v.name AS variant_label
          FROM analytics_events ae
          LEFT JOIN brands b ON b.id=ae.brand_id
          LEFT JOIN campaigns camp ON camp.id=ae.campaign_id
          LEFT JOIN landing_pages lp ON lp.id=ae.page_id
          LEFT JOIN variants v ON v.id=ae.variant_id
          WHERE ae.occurred_at >= ${filters.from} AND ae.occurred_at < ${filters.to}
            AND coalesce(ae.properties->>'testTraffic','false') <> 'true'
            AND (${brandId}::uuid IS NULL OR ae.brand_id=${brandId}::uuid)
            AND (${campaignId}::uuid IS NULL OR ae.campaign_id=${campaignId}::uuid)
            AND (${pageId}::uuid IS NULL OR ae.page_id=${pageId}::uuid)
            AND (${variantId}::uuid IS NULL OR ae.variant_id=${variantId}::uuid)
            AND (${creativeId}::text IS NULL OR ae.creative_id=${creativeId})
            AND (${platform}::text IS NULL OR camp.platform=${platform})
        )
        SELECT 'brand' AS level, brand_id::text AS key, coalesce(brand_name,'Unknown brand') AS label,
          count(*) FILTER (WHERE event_name='landing_view')::text AS landing_views,
          count(DISTINCT session_id) FILTER (WHERE event_name='landing_view')::text AS unique_sessions,
          count(*) FILTER (WHERE event_name='cta_click')::text AS cta_clicks
        FROM filtered WHERE brand_id IS NOT NULL GROUP BY brand_id, brand_name
        UNION ALL
        SELECT 'campaign', campaign_id::text, coalesce(campaign_label,'Unknown campaign'),
          count(*) FILTER (WHERE event_name='landing_view')::text, count(DISTINCT session_id) FILTER (WHERE event_name='landing_view')::text, count(*) FILTER (WHERE event_name='cta_click')::text
        FROM filtered WHERE campaign_id IS NOT NULL GROUP BY campaign_id, campaign_label
        UNION ALL
        SELECT 'page', page_id::text, coalesce(page_label,'Unknown page'),
          count(*) FILTER (WHERE event_name='landing_view')::text, count(DISTINCT session_id) FILTER (WHERE event_name='landing_view')::text, count(*) FILTER (WHERE event_name='cta_click')::text
        FROM filtered WHERE page_id IS NOT NULL GROUP BY page_id, page_label
        UNION ALL
        SELECT 'variant', variant_id::text, coalesce(variant_label,'Unknown variant'),
          count(*) FILTER (WHERE event_name='landing_view')::text, count(DISTINCT session_id) FILTER (WHERE event_name='landing_view')::text, count(*) FILTER (WHERE event_name='cta_click')::text
        FROM filtered WHERE variant_id IS NOT NULL GROUP BY variant_id, variant_label
        UNION ALL
        SELECT 'creative', creative_id, creative_id,
          count(*) FILTER (WHERE event_name='landing_view')::text, count(DISTINCT session_id) FILTER (WHERE event_name='landing_view')::text, count(*) FILTER (WHERE event_name='cta_click')::text
        FROM filtered WHERE creative_id IS NOT NULL GROUP BY creative_id`,
      client<BreakdownRow[]>`
        WITH filtered AS (
          SELECT conv.*, b.name AS brand_name, camp.name AS campaign_label, camp.platform, lp.name AS page_label, v.name AS variant_label,
            coalesce(conv.attribution #>> '{lastTouch,creativeId}', conv.attribution #>> '{firstTouch,creativeId}') AS creative_key
          FROM conversions conv
          LEFT JOIN brands b ON b.id=conv.brand_id
          LEFT JOIN campaigns camp ON camp.id=conv.campaign_id
          LEFT JOIN landing_pages lp ON lp.id=conv.page_id
          LEFT JOIN variants v ON v.id=conv.variant_id
          WHERE conv.occurred_at >= ${filters.from} AND conv.occurred_at < ${filters.to}
            AND coalesce(conv.properties->>'testTraffic','false') <> 'true'
            AND (${brandId}::uuid IS NULL OR conv.brand_id=${brandId}::uuid)
            AND (${campaignId}::uuid IS NULL OR conv.campaign_id=${campaignId}::uuid)
            AND (${pageId}::uuid IS NULL OR conv.page_id=${pageId}::uuid)
            AND (${variantId}::uuid IS NULL OR conv.variant_id=${variantId}::uuid)
            AND (${creativeId}::text IS NULL OR coalesce(conv.attribution #>> '{lastTouch,creativeId}', conv.attribution #>> '{firstTouch,creativeId}')=${creativeId})
            AND (${platform}::text IS NULL OR camp.platform=${platform})
        )
        SELECT 'brand' AS level, brand_id::text AS key, coalesce(brand_name,'Unknown brand') AS label,
          count(*) FILTER (WHERE event_name='subscription_started')::text AS subscriptions, coalesce(sum(value),0)::text AS revenue
        FROM filtered WHERE brand_id IS NOT NULL GROUP BY brand_id, brand_name
        UNION ALL
        SELECT 'campaign', campaign_id::text, coalesce(campaign_label,'Unknown campaign'), count(*) FILTER (WHERE event_name='subscription_started')::text, coalesce(sum(value),0)::text
        FROM filtered WHERE campaign_id IS NOT NULL GROUP BY campaign_id, campaign_label
        UNION ALL
        SELECT 'page', page_id::text, coalesce(page_label,'Unknown page'), count(*) FILTER (WHERE event_name='subscription_started')::text, coalesce(sum(value),0)::text
        FROM filtered WHERE page_id IS NOT NULL GROUP BY page_id, page_label
        UNION ALL
        SELECT 'variant', variant_id::text, coalesce(variant_label,'Unknown variant'), count(*) FILTER (WHERE event_name='subscription_started')::text, coalesce(sum(value),0)::text
        FROM filtered WHERE variant_id IS NOT NULL GROUP BY variant_id, variant_label
        UNION ALL
        SELECT 'creative', creative_key, creative_key, count(*) FILTER (WHERE event_name='subscription_started')::text, coalesce(sum(value),0)::text
        FROM filtered WHERE creative_key IS NOT NULL GROUP BY creative_key`
    ]);
    const map = new Map<string, AnalyticsBreakdown>();
    for (const row of eventRows) map.set(`${row.level}:${row.key}`, { level: row.level, key: row.key, label: row.label, landingViews: n(row.landing_views), uniqueSessions: n(row.unique_sessions), ctaClicks: n(row.cta_clicks), subscriptions: 0, revenue: 0 });
    for (const row of conversionRows) {
      const id = `${row.level}:${row.key}`;
      const current = map.get(id) ?? { level: row.level, key: row.key, label: row.label, landingViews: 0, uniqueSessions: 0, ctaClicks: 0, subscriptions: 0, revenue: 0 };
      current.subscriptions = n(row.subscriptions);
      current.revenue = n(row.revenue);
      map.set(id, current);
    }
    return [...map.values()].sort((a, b) => b.landingViews - a.landingViews || b.subscriptions - a.subscriptions);
  } finally {
    await client.end();
  }
}

async function attribution(filters: AnalyticsFilters) {
  const { client } = getDatabase();
  const brandId = text(filters.brandId);
  const campaignId = text(filters.campaignId);
  const pageId = text(filters.pageId);
  const variantId = text(filters.variantId);
  const platform = text(filters.platform);
  try {
    return await client<AttributionRow[]>`
      WITH filtered AS (
        SELECT conv.*, camp.platform
        FROM conversions conv LEFT JOIN campaigns camp ON camp.id=conv.campaign_id
        WHERE conv.occurred_at >= ${filters.from} AND conv.occurred_at < ${filters.to}
          AND coalesce(conv.properties->>'testTraffic','false') <> 'true'
          AND (${brandId}::uuid IS NULL OR conv.brand_id=${brandId}::uuid)
          AND (${campaignId}::uuid IS NULL OR conv.campaign_id=${campaignId}::uuid)
          AND (${pageId}::uuid IS NULL OR conv.page_id=${pageId}::uuid)
          AND (${variantId}::uuid IS NULL OR conv.variant_id=${variantId}::uuid)
          AND (${platform}::text IS NULL OR camp.platform=${platform})
      )
      SELECT 'first' AS touch, coalesce(attribution #>> '{firstTouch,source}','(direct)') AS source, count(*)::text AS conversions, coalesce(sum(value),0)::text AS revenue FROM filtered GROUP BY source
      UNION ALL
      SELECT 'last', coalesce(attribution #>> '{lastTouch,source}','(direct)'), count(*)::text, coalesce(sum(value),0)::text FROM filtered GROUP BY coalesce(attribution #>> '{lastTouch,source}','(direct)')
      ORDER BY touch, conversions DESC`;
  } finally { await client.end(); }
}

async function currencyTotals(filters: AnalyticsFilters) {
  const { client } = getDatabase();
  const brandId = text(filters.brandId);
  const campaignId = text(filters.campaignId);
  const pageId = text(filters.pageId);
  const variantId = text(filters.variantId);
  const platform = text(filters.platform);
  try {
    return await client<CurrencyRow[]>`
      SELECT coalesce(conv.currency,'UNSPECIFIED') AS currency, coalesce(sum(conv.value),0)::text AS revenue, count(*) FILTER (WHERE conv.value IS NOT NULL)::text AS conversions
      FROM conversions conv LEFT JOIN campaigns camp ON camp.id=conv.campaign_id
      WHERE conv.occurred_at >= ${filters.from} AND conv.occurred_at < ${filters.to}
        AND coalesce(conv.properties->>'testTraffic','false') <> 'true'
        AND (${brandId}::uuid IS NULL OR conv.brand_id=${brandId}::uuid)
        AND (${campaignId}::uuid IS NULL OR conv.campaign_id=${campaignId}::uuid)
        AND (${pageId}::uuid IS NULL OR conv.page_id=${pageId}::uuid)
        AND (${variantId}::uuid IS NULL OR conv.variant_id=${variantId}::uuid)
        AND (${platform}::text IS NULL OR camp.platform=${platform})
      GROUP BY conv.currency ORDER BY revenue DESC`;
  } finally { await client.end(); }
}

export async function getAnalyticsReport(filters: AnalyticsFilters) {
  const bounds = periodBounds(filters);
  const [current, previous, rows, attributionRows, currencies] = await Promise.all([
    summarizePeriod(filters),
    summarizePeriod({ ...filters, from: bounds.previousFrom, to: bounds.previousTo }),
    breakdown(filters),
    attribution(filters),
    currencyTotals(filters)
  ]);
  return {
    current,
    previous,
    breakdown: rows,
    attribution: attributionRows.map((row) => ({ touch: row.touch, source: row.source, conversions: n(row.conversions), revenue: n(row.revenue) })),
    currencies: currencies.map((row) => ({ currency: row.currency, revenue: n(row.revenue), conversions: n(row.conversions) })),
    previousFrom: bounds.previousFrom,
    previousTo: bounds.previousTo
  };
}
