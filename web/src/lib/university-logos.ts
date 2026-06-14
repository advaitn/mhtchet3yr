const LOGO_MAP: Array<{ match: string; src: string }> = [
  { match: "University of Mumbai", src: "/university-logos/mumbai.svg" },
  { match: "Savitribai Phule Pune University", src: "/university-logos/pune.png" },
  { match: "Nagpur University", src: "/university-logos/nagpur.jpg" },
  { match: "Rastrasant Tukdoji Maharaj Nagpur", src: "/university-logos/nagpur.jpg" },
  { match: "Rashtrasant Tukadoji", src: "/university-logos/nagpur.jpg" },
  { match: "Sant Gadge Baba", src: "/university-logos/amravati.png" },
  { match: "Amaravati", src: "/university-logos/amravati.png" },
  { match: "Babasaheb Ambedkar Marathwada", src: "/university-logos/aurangabad.png" },
  { match: "Shivaji University", src: "/university-logos/shivaji.jpeg" },
  { match: "Solapur University", src: "/university-logos/solapur.jpg" },
  { match: "Punyashlok Ahilyadevi", src: "/university-logos/solapur.jpg" },
  { match: "North Maharashtra", src: "/university-logos/north-maharashtra.png" },
  { match: "Kavayitri Bahinabai", src: "/university-logos/north-maharashtra.png" },
  { match: "Gondwana", src: "/university-logos/gondwana.png" },
  { match: "Nathibai", src: "/university-logos/sndt.jpeg" },
  { match: "SNDT", src: "/university-logos/sndt.jpeg" },
  { match: "Swami Ramanand Teerth", src: "/university-logos/nanded.webp" },
  { match: "Nanded", src: "/university-logos/nanded.webp" },
];

export function universityLogo(universityName: string): string | null {
  const entry = LOGO_MAP.find((e) =>
    universityName.toLowerCase().includes(e.match.toLowerCase()),
  );
  return entry?.src ?? null;
}

/** Strip city suffix like ", Mumbai" or ", Pune" from university name */
export function shortUniversityName(name: string): string {
  return name.replace(/,\s*[A-Z][a-z]+$/, "").trim();
}
