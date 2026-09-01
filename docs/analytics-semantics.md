# GrowthOS analytics semantics

## Time
All event and conversion timestamps are stored as PostgreSQL `timestamptz` and treated as UTC. The admin dashboard accepts UTC calendar days. The selected end day is inclusive in the UI and converted to an exclusive next-day UTC boundary in SQL. Previous-period comparison uses the immediately preceding equivalent duration.

## Funnel metrics
- **Landing views**: count of `landing_view` analytics events.
- **Unique sessions**: distinct non-null `session_id` values among `landing_view` events.
- **CTA clicks**: count of `cta_click` analytics events.
- **CTA rate**: CTA clicks / landing views. Zero when there are no landing views.
- **Signup starts**: count of `signup_start` analytics events.
- **Signup completions**: count of `signup_complete` conversion records.
- **Checkout starts**: count of `checkout_start` analytics events.
- **Purchases**: count of `purchase` conversion records.
- **Subscriptions**: count of `subscription_started` conversion records.
- **Subscription conversion rate**: subscriptions / unique landing sessions. Zero when there are no unique landing sessions.
- **Revenue/value**: sum of conversion `value` only within the same currency. The dashboard never presents a cross-currency sum as one financial KPI.
- **Revenue per visitor**: revenue / unique landing sessions and is only shown when the filtered result contains one currency.

## Attribution
First-touch and last-touch reports read the persisted attribution envelope attached to downstream conversion records. `(direct)` represents a missing source. Creative breakdown uses the analytics event `creative_id` and the conversion attribution creative identifier.

## Performance
P0 uses bounded, indexed SQL aggregation directly over `analytics_events` and `conversions`; it does not load raw streams into the admin process. This keeps the implementation operationally simple for the expected initial volume. Issue #27 tracks optional rollups/materialization if observed production scale requires them.

## Integrity
CI seeds one deterministic SkillUp acquisition path (`landing_view` → `cta_click` → `signup_start` → `checkout_start` → `subscription_started`) and database verification reconciles the source rows and PKR value before a change can merge.
