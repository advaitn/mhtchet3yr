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
  /** Estimated admission chance for this year (0–100). null = no data. */
  yearProb: number | null;
  /** p75 merit percentile — approximates the competitive seat line. */
  cutoff: number;
  /** Median of the full waitlist (context only — not the admission cutoff). */
  median: number;
  /** Highest merit percentile in the matched cohort. */
  top: number;
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
  /** MS OPEN p75 cutoff averaged across years — used for prestige ranking. */
  msOpenCutoff: number;
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
