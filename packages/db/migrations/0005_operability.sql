CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key text NOT NULL,
  bucket timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count > 0),
  PRIMARY KEY (key, bucket)
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_bucket_idx ON rate_limit_buckets (bucket);
CREATE INDEX IF NOT EXISTS audit_logs_correlation_idx ON audit_logs (correlation_id) WHERE correlation_id IS NOT NULL;
