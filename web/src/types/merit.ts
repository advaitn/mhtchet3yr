import type { Category } from "@/lib/constants";
import type { CandidatureGroup } from "@/lib/candidature";
import type { Course } from "@/generated/prisma/client";

export type FinderFilters = {
  course: Course;
  category: Category;
  percentile: number;
  candidatureGroup: CandidatureGroup;
  differentlyAbled?: boolean;
  orphan?: boolean;
  exServicemen?: boolean;
};

export type YearCutoff = {
  year: number;
  cutoff: number;
  median: number;
  top: number;
  waitlistCount: number;
  qualifies: boolean;
};

export type CollegeMatch = {
  collegeId: string;
  collegeName: string;
  divisionId: string;
  divisionName: string;
  universityName: string;
  years: YearCutoff[];
  yearsQualified: number;
  avgMedian: number;
  bestMedian: number;
  msOpenRank: number;
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
