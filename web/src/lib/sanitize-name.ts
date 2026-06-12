/** Strip masking asterisks and normalize whitespace from scraped candidate names. */
export function sanitizeCandidateName(name: string): string {
  return name.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}
