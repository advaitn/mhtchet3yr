import type {
  CandidatureType,
  DivisionGender,
  MinorityOption,
  YesNo,
} from "@/lib/candidate-profile";
import type { Category } from "@/lib/constants";
import type { Course } from "@/generated/prisma/client";

export type CandidateProfile = {
  course: Course;
  category: Category;
  percentile: number;
  candidatureType: CandidatureType;
  differentlyAbled: YesNo;
  orphan: YesNo;
  exServicemen: YesNo;
  divisionGender: DivisionGender;
  minority: MinorityOption;
};

/** @deprecated Use CandidateProfile — kept for rankings pages. */
export type FinderFilters = CandidateProfile;

/** Probability label derived from chancePercent. */
export type MatchLabel = "safe" | "good" | "borderline" | "reach" | "unlikely" | "unknown";

/** Whether the college is getting easier or harder to enter for this profile over time. */
export type Trend = "improving" | "declining" | "stable" | "unknown";

export type YearCutoff = {
  year: number;
  /**
   * Fraction of the matched cohort whose merit percentile is ≤ yours (0–100).
   * Represents the actual probability of being ranked above most admitted students.
   * null = no data for this year.
   */
  yearProb: number | null;
  /** Median merit percentile in the cohort (pool difficulty context). */
  median: number;
  /** Highest merit percentile in the cohort (ceiling context). */
  top: number;
  /** Number of cohort rows used for this estimate. */
  waitlistCount: number;
  hasData: boolean;
};

export type CollegeMatch = {
  collegeId: string;
  collegeName: string;
  divisionId: string;
  divisionName: string;
  universityName: string;
  years: YearCutoff[];
  /** Average yearProb across years that have data (0–100). */
  chancePercent: number;
  matchLabel: MatchLabel;
  trend: Trend;
  avgMedian: number;
  bestMedian: number;
  msOpenRank: number;
  msOpenMedian: number;
};

export type RankedCollege = {
  collegeId: string;
  collegeName: string;
  divisionId: string;
  divisionName: string;
  universityName: string;
  year: number;
  cutoff: number;
  median: number;
  top: number;
  waitlistCount: number;
};
