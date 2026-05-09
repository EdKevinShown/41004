export const COUNCIL_LABELS: Record<string, string> = {
  Burwood_Council: "Burwood",
  Campbelltown_City_Council: "Campbelltown",
  City_of_Parramatta_Council: "Parramatta",
  Council_of_the_City_of_Sydney: "City of Sydney",
  "Georges River": "Georges River",
  Inner_West_Council: "Inner West",
  Liverpool_City_Council: "Liverpool",
  "North Sydney": "North Sydney",
  Ryde_City_Council: "Ryde",
  "Sutherland Shire": "Sutherland",
  /** Matches normalized `council` from pipeline */
  "hunter hills": "hunter hills",
  "The Council of the Municipality of Hunter's Hill": "hunter hills",
  The_Council_of_the_Municipality_of_Hunters_Hill: "hunter hills",
  "The_Council_of_the_Municipality_of_Hunter's_Hill": "hunter hills",
  Willoughby_City_Council: "Willoughby"
};

function normalizeToKey(name: string): string {
  return name.trim().replace(/\s+/g, "_");
}

export function getCouncilLabel(name: string): string {
  const raw = name.trim();
  if (!raw) return raw;
  return COUNCIL_LABELS[raw] ?? COUNCIL_LABELS[normalizeToKey(raw)] ?? raw;
}

