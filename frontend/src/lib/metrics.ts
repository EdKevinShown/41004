import { type DecisionBucket, type StandardCouncilRecord } from "../types";

export function safeBool(v: boolean | null | undefined): boolean {
  return v === true;
}

export function bucketDecision(decision: string | null | undefined): DecisionBucket {
  const d = (decision ?? "").trim();
  if (!d) return "Other/Unknown";
  if (d === "Approved") return "Approved";
  if (d === "Refused" || d === "Declined") return "Refused/Declined";
  if (d === "Pending" || d === "In Progress" || d === "Under Assessment") {
    return "Pending/In Progress/Under Assessment";
  }
  return "Other/Unknown";
}

export function uniqueCouncils(records: StandardCouncilRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) {
    const c = (r.council ?? "").trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function pct(numer: number, denom: number): string {
  if (!denom) return "0%";
  return `${Math.round((numer / denom) * 100)}%`;
}

export function avg(nums: Array<number | null | undefined>): number | null {
  const xs = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function meanTransparencyScore(r: StandardCouncilRecord): number | null {
  const parts = [
    r.status_clarity_score,
    r.document_completeness_score,
    r.update_visibility_score,
    r.navigation_ease_score
  ].filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

