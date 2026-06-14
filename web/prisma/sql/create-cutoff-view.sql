-- Rankings use coarse MS/OMS buckets. Finder uses full profile matching in live SQL.
-- Run via: npm run db:refresh-stats

DROP MATERIALIZED VIEW IF EXISTS college_cutoff_stats;

CREATE MATERIALIZED VIEW college_cutoff_stats AS
SELECT
  ac.course,
  ac.year,
  me.college_id,
  me.college_name,
  me.division_id,
  me.division_name,
  me.university_name,
  me.category,
  CASE
    WHEN me.candidature_type = 'OMS' THEN 'OMS'
    ELSE 'MS'
  END AS candidature_group,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY me.merit_percentile) AS cutoff_percentile,
  MAX(me.merit_percentile) AS top_percentile,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY me.merit_percentile) AS median_percentile,
  COUNT(*)::int AS waitlist_count
FROM merit_entries me
INNER JOIN admission_cycles ac ON ac.id = me.cycle_id
WHERE me.merit_percentile >= 0
  AND me.merit_percentile <= 100
GROUP BY
  ac.course,
  ac.year,
  me.college_id,
  me.college_name,
  me.division_id,
  me.division_name,
  me.university_name,
  me.category,
  CASE
    WHEN me.candidature_type = 'OMS' THEN 'OMS'
    ELSE 'MS'
  END;

CREATE UNIQUE INDEX college_cutoff_stats_pkey
  ON college_cutoff_stats (course, year, college_id, division_id, category, candidature_group);

CREATE INDEX college_cutoff_stats_search_idx
  ON college_cutoff_stats (course, category, candidature_group, cutoff_percentile DESC);

CREATE INDEX college_cutoff_stats_rank_idx
  ON college_cutoff_stats (course, category, candidature_group, median_percentile DESC);

CREATE INDEX IF NOT EXISTS merit_entries_profile_idx
  ON merit_entries (
    cycle_id,
    category,
    candidature_type,
    differently_abled_ph,
    orphan,
    ex_servicemen
  );
