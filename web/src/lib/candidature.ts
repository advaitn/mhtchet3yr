export type CandidatureGroup = "MS" | "OMS";

/** Maharashtra seats: all Type A–E candidatures. OMS is separate. */
export function isMaharashtraCandidature(candidatureType: string): boolean {
  return candidatureType !== "OMS";
}

export function toCandidatureGroup(candidatureType: string): CandidatureGroup {
  return candidatureType === "OMS" ? "OMS" : "MS";
}

export function parseCandidatureGroup(value: string | null | undefined): CandidatureGroup {
  return value === "OMS" ? "OMS" : "MS";
}

export function candidatureSqlCondition(group: CandidatureGroup, alias = "me"): string {
  if (group === "OMS") {
    return `${alias}.candidature_type = 'OMS'`;
  }
  return `${alias}.candidature_type <> 'OMS'`;
}
