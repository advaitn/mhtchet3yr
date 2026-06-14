import type { CandidateProfile } from "@/types/merit";

export type ProfileSqlParts = {
  where: string[];
  params: unknown[];
};

export type ProfileSqlOptions = {
  /** 2023/2024 rows use legacy encodings for PH/orphan/ex-servicemen — skip those filters. */
  includeDemographics?: boolean;
};

export function buildProfileSql(
  profile: CandidateProfile,
  startIndex: number,
  alias = "me",
  options: ProfileSqlOptions = {},
): ProfileSqlParts {
  const includeDemographics = options.includeDemographics ?? true;
  const where: string[] = [];
  const params: unknown[] = [];
  let paramIndex = startIndex;

  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${paramIndex}`));
    paramIndex += 1;
  };

  add(`${alias}.category = ?`, profile.category);
  add(`${alias}.candidature_type = ?`, profile.candidatureType);

  if (includeDemographics) {
    add(`${alias}.differently_abled_ph = ?`, profile.differentlyAbled);
    add(`${alias}.orphan = ?`, profile.orphan);
    add(`${alias}.ex_servicemen = ?`, profile.exServicemen);
  }

  if (profile.minority === "none") {
    where.push(
      `(${alias}.minority_details IS NULL OR TRIM(${alias}.minority_details) IN ('', '-'))`,
    );
  } else {
    add(`${alias}.minority_details ILIKE ?`, `%${profile.minority}%`);
  }

  if (profile.divisionGender === "coed") {
    where.push(`${alias}.division_name ILIKE '%Co-Education%'`);
  } else if (profile.divisionGender === "women") {
    where.push(
      `(${alias}.division_name ILIKE '%Women%' OR ${alias}.division_name ILIKE '%Woman%')`,
    );
  }

  return { where, params };
}

export function profileFingerprint(profile: CandidateProfile): string {
  return [
    profile.course,
    profile.category,
    profile.candidatureType,
    profile.differentlyAbled,
    profile.orphan,
    profile.exServicemen,
    profile.divisionGender,
    profile.minority,
  ].join("|");
}
