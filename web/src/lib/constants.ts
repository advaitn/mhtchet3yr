export const CATEGORIES = [
  "OPEN",
  "OPEN-EWS",
  "SC",
  "ST",
  "OBC",
  "SEBC",
  "SBC",
  "NT 1 (NT-B)",
  "NT 2 (NT-C)",
  "NT 3 (NT-D)",
  "DT / VJ",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const COURSE_OPTIONS = [
  { value: "LLB_3" as const, label: "LLB 3-Year", short: "3Y" },
  { value: "LLB_5" as const, label: "LLB 5-Year", short: "5Y" },
];

export const CANDIDATURE_OPTIONS = [
  {
    value: "MS" as const,
    label: "Maharashtra Seat (MS)",
    description: "Type A–E Maharashtra candidature",
  },
  {
    value: "OMS" as const,
    label: "Outside Maharashtra (OMS)",
    description: "All India / OMS candidature only",
  },
];

export const YEARS = [2023, 2024, 2025] as const;

export const CATEGORY_LABELS: Record<Category, string> = {
  OPEN: "Open",
  "OPEN-EWS": "EWS",
  SC: "SC",
  ST: "ST",
  OBC: "OBC",
  SEBC: "SEBC",
  SBC: "SBC",
  "NT 1 (NT-B)": "NT-B",
  "NT 2 (NT-C)": "NT-C",
  "NT 3 (NT-D)": "NT-D",
  "DT / VJ": "DT/VJ",
};
