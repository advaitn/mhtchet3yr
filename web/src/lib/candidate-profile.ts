export const CANDIDATURE_TYPES = [
  "Maharashtra - Type A",
  "Maharashtra - Type B",
  "Maharashtra - Type C",
  "Maharashtra - Type D",
  "Maharashtra - Type E",
  "OMS",
  "J & K Migrant",
] as const;

export type CandidatureType = (typeof CANDIDATURE_TYPES)[number];

export const DIVISION_GENDER_OPTIONS = [
  { value: "any" as const, label: "Any division" },
  { value: "coed" as const, label: "Co-Education" },
  { value: "women" as const, label: "Women's college" },
] as const;

export type DivisionGender = (typeof DIVISION_GENDER_OPTIONS)[number]["value"];

export const MINORITY_OPTIONS = [
  { value: "none" as const, label: "No minority claim" },
  { value: "Religious Minority - Muslim" as const, label: "Religious — Muslim" },
  { value: "Religious Minority - Buddhist" as const, label: "Religious — Buddhist" },
  { value: "Religious Minority - Jain" as const, label: "Religious — Jain" },
  { value: "Religious Minority - Christian" as const, label: "Religious — Christian" },
  { value: "Linguistic Minority - Hindi" as const, label: "Linguistic — Hindi" },
  { value: "Linguistic Minority - Urdu" as const, label: "Linguistic — Urdu" },
  { value: "Linguistic Minority - Gujarathi" as const, label: "Linguistic — Gujarati" },
  { value: "Linguistic Minority - Sindhi" as const, label: "Linguistic — Sindhi" },
] as const;

export type MinorityOption = (typeof MINORITY_OPTIONS)[number]["value"];

export const YES_NO = ["No", "Yes"] as const;
export type YesNo = (typeof YES_NO)[number];

/** Minimum waitlist rows required before we trust a cutoff for a college division. */
export const MIN_COHORT_SIZE = 3;

