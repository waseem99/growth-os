CREATE UNIQUE INDEX IF NOT EXISTS experiments_one_running_per_page_uidx
  ON experiments(page_id)
  WHERE status = 'running';

CREATE UNIQUE INDEX IF NOT EXISTS variants_experiment_page_version_uidx
  ON variants(experiment_id, page_version_id);
