export type MetricCounts = {
  landingViews: number;
  uniqueSessions: number;
  ctaClicks: number;
  signupStarts: number;
  signupCompletes: number;
  checkoutStarts: number;
  purchases: number;
  subscriptions: number;
  revenue: number;
};

export type DerivedMetrics = MetricCounts & {
  ctaRate: number;
  subscriptionConversionRate: number;
  revenuePerVisitor: number;
};

const safeRate = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : 0;

export function deriveMetrics(counts: MetricCounts): DerivedMetrics {
  return {
    ...counts,
    ctaRate: safeRate(counts.ctaClicks, counts.landingViews),
    subscriptionConversionRate: safeRate(counts.subscriptions, counts.uniqueSessions),
    revenuePerVisitor: safeRate(counts.revenue, counts.uniqueSessions)
  };
}

export function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

export function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
