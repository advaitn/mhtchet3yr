-- Rankings materialized view — allotment data only (no merit-list fallback).
-- All CAP rounds are combined per year (GROUP BY omits phase) so MIN(merit_marks)
-- captures the true admission floor across the entire season.
--
-- Semantics:
--   cutoff_percentile  = MIN(merit_marks)  → lowest admitted score (real floor)
--   median_percentile  = P50 of admitted   → centre of admitted class
--   top_percentile     = MAX(merit_marks)  → highest admitted score
--   p25_percentile     = P25 of admitted   → lower comfortable zone
--
-- Run via: npm run db:refresh-stats

DROP MATERIALIZED VIEW IF EXISTS college_cutoff_stats;

CREATE MATERIALIZED VIEW college_cutoff_stats AS

WITH allot_typed AS (
  SELECT
    ae.course,
    ae.year,
    ae.college_id,
    ae.college_name,
    ae.division_id,
    ae.division_name,
    ae.university_name,
    ae.merit_marks::float AS merit_marks,
    CASE
      -- Exclude demographic sub-allocations: PH / Orphan / Defence / NRI-converted.
      -- These use separate eligibility criteria and distort the open category floor.
      WHEN ae.allotted_type LIKE '%-PH%'
        OR ae.allotted_type LIKE '%-OrPHan%'
        OR ae.allotted_type LIKE '%-Defence%'
        OR ae.allotted_type LIKE '%(NRI%'                                   THEN NULL
      WHEN ae.allotted_type LIKE 'OPEN-EWS%'                              THEN 'OPEN-EWS'
      WHEN ae.allotted_type LIKE 'OPEN%'                                   THEN 'OPEN'
      WHEN ae.allotted_type LIKE 'SC%'                                     THEN 'SC'
      WHEN ae.allotted_type LIKE 'ST%'                                     THEN 'ST'
      WHEN ae.allotted_type LIKE 'OBC%'                                    THEN 'OBC'
      WHEN ae.allotted_type LIKE 'SEBC%'                                   THEN 'SEBC'
      WHEN ae.allotted_type LIKE 'SBC%'                                    THEN 'SBC'
      WHEN ae.allotted_type LIKE 'NT 1%' OR ae.allotted_type LIKE 'NT1%'  THEN 'NT 1 (NT-B)'
      WHEN ae.allotted_type LIKE 'NT 2%' OR ae.allotted_type LIKE 'NT2%'  THEN 'NT 2 (NT-C)'
      WHEN ae.allotted_type LIKE 'NT 3%' OR ae.allotted_type LIKE 'NT3%'  THEN 'NT 3 (NT-D)'
      WHEN ae.allotted_type LIKE 'DT / VJ%' OR
           ae.allotted_type LIKE 'DT/VJ%'                                  THEN 'DT / VJ'
    END AS category,
    -- MS/MH/OMS — excludes NRI, Minority, J&K quota seats.
    -- MH (home-university seats) is treated as MS: same Maharashtra state
    -- eligibility, just allocated from the college's home university pool.
    CASE
      WHEN ae.allotted_quota = 'MS'  THEN 'MS'
      WHEN ae.allotted_quota = 'MH'  THEN 'MS'
      WHEN ae.allotted_quota = 'OMS' THEN 'OMS'
    END AS candidature_group
  FROM allotment_entries ae
  WHERE ae.merit_marks > 0
    AND ae.merit_marks <= 100
)

SELECT
  t.course,
  t.year,
  t.college_id,
  MIN(t.college_name)                                                  AS college_name,
  t.division_id,
  MIN(t.division_name)                                                 AS division_name,
  MIN(t.university_name)                                               AS university_name,
  t.category,
  t.candidature_group,
  MIN(t.merit_marks)                                                   AS cutoff_percentile,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY t.merit_marks)         AS median_percentile,
  MAX(t.merit_marks)                                                   AS top_percentile,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY t.merit_marks)         AS p25_percentile,
  COUNT(*)::int                                                         AS waitlist_count
FROM allot_typed t
WHERE t.category IS NOT NULL
  AND t.candidature_group IS NOT NULL
GROUP BY t.course, t.year, t.college_id, t.division_id, t.category, t.candidature_group
HAVING COUNT(*) >= 3;


-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX college_cutoff_stats_pkey
  ON college_cutoff_stats (course, year, college_id, division_id, category, candidature_group);

CREATE INDEX college_cutoff_stats_search_idx
  ON college_cutoff_stats (course, category, candidature_group, cutoff_percentile DESC);

CREATE INDEX college_cutoff_stats_rank_idx
  ON college_cutoff_stats (course, category, candidature_group, median_percentile DESC);

CREATE INDEX IF NOT EXISTS allotment_entries_cutoff_idx
  ON allotment_entries (
    course, year, college_id, division_id, allotted_type, allotted_quota, merit_marks
  );
