import { type DecisionBucket, type StandardCouncilRecord } from "../types";

export function safeBool(v: boolean | null | undefined): boolean {
  return v === true;
}

export type PortalSource = "Council-managed portal" | "NSW Planning Portal";

export function derivePortalSource(council: string | null | undefined): PortalSource {
  const c = (council ?? "").trim();
  if (c === "Georges River" || c === "North Sydney" || c === "Sutherland Shire") {
    return "Council-managed portal";
  }
  return "NSW Planning Portal";
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

export function calculateTransparencyAverageScore(r: StandardCouncilRecord): number | null {
  const parts = [
    r.status_clarity_score,
    r.document_completeness_score,
    r.update_visibility_score,
    r.navigation_ease_score
  ].filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function meanTransparencyScore(r: StandardCouncilRecord): number | null {
  return calculateTransparencyAverageScore(r);
}

function weightedScore(
  r: StandardCouncilRecord,
  weights: { status: number; doc: number; update: number; nav: number }
): number | null {
  const parts: Array<{ score: number | null; weight: number }> = [
    { score: r.status_clarity_score, weight: weights.status },
    { score: r.document_completeness_score, weight: weights.doc },
    { score: r.update_visibility_score, weight: weights.update },
    { score: r.navigation_ease_score, weight: weights.nav }
  ];
  let weighted = 0;
  let totalWeight = 0;
  for (const p of parts) {
    if (typeof p.score === "number" && Number.isFinite(p.score)) {
      weighted += p.score * p.weight;
      totalWeight += p.weight;
    }
  }
  if (!totalWeight) return null;
  return weighted / totalWeight;
}

export function calculateWeightedTransparencyIndex(r: StandardCouncilRecord): number | null {
  return weightedScore(r, { status: 0.25, doc: 0.3, update: 0.25, nav: 0.2 });
}

export function calculateSensitivityScores(r: StandardCouncilRecord): {
  equalWeight: number | null;
  documentFocused: number | null;
  navigationFocused: number | null;
} {
  return {
    equalWeight: weightedScore(r, { status: 0.25, doc: 0.25, update: 0.25, nav: 0.25 }),
    documentFocused: weightedScore(r, { status: 0.2, doc: 0.4, update: 0.2, nav: 0.2 }),
    navigationFocused: weightedScore(r, { status: 0.25, doc: 0.25, update: 0.2, nav: 0.3 })
  };
}

function parseBooleanLoose(input: unknown): { value: boolean | null; issue: boolean } {
  if (input === null || input === undefined) return { value: null, issue: false };
  if (typeof input === "boolean") return { value: input, issue: false };
  const raw = String(input).trim().toLowerCase();
  if (!raw) return { value: null, issue: false };
  if (["yes", "y", "true", "1"].includes(raw)) return { value: true, issue: false };
  if (["no", "n", "false", "0"].includes(raw)) return { value: false, issue: false };
  return { value: null, issue: true };
}

function scoreInRange(v: number | null): boolean {
  return v === null || (Number.isFinite(v) && v >= 0 && v <= 2);
}

export function calculateDataQualityFlags(r: StandardCouncilRecord): {
  dataQualityFlag: "OK" | "Review required";
  dateAnomaly: boolean;
  missingRequiredFieldsCount: number;
  scoreOutOfRange: boolean;
  booleanParseIssue: boolean;
} {
  const required: Array<keyof StandardCouncilRecord> = [
    "council",
    "application_no",
    "address",
    "development_type",
    "description",
    "lodged_date",
    "decision"
  ];
  const missingRequiredFieldsCount = required.filter((f) => {
    const v = r[f];
    if (v === null || v === undefined) return true;
    return typeof v === "string" ? !v.trim() : false;
  }).length;
  const scoreOutOfRange =
    !scoreInRange(r.status_clarity_score) ||
    !scoreInRange(r.document_completeness_score) ||
    !scoreInRange(r.update_visibility_score) ||
    !scoreInRange(r.navigation_ease_score);
  const docs = parseBooleanLoose(r.has_documents);
  const progress = parseBooleanLoose(r.has_progress_info);
  const booleanParseIssue = docs.issue || progress.issue;
  const dateAnomaly =
    !!(r.lodged_date && r.decision_date && r.decision_date < r.lodged_date) ||
    (Boolean(r.lodged_date) !== Boolean(r.decision_date));
  const dataQualityFlag =
    missingRequiredFieldsCount > 0 || scoreOutOfRange || dateAnomaly || booleanParseIssue
      ? "Review required"
      : "OK";
  return { dataQualityFlag, dateAnomaly, missingRequiredFieldsCount, scoreOutOfRange, booleanParseIssue };
}

/** Composite key for duplicate detection (council + application_no + address). */
export function compositeRecordKey(r: StandardCouncilRecord): string {
  return `${r.council ?? ""}||${r.application_no ?? ""}||${r.address ?? ""}`;
}

export function getDuplicateCompositeKeys(records: StandardCouncilRecord[]): Set<string> {
  const counts = new Map<string, number>();
  for (const r of records) {
    const k = compositeRecordKey(r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const dup = new Set<string>();
  for (const [k, n] of counts) {
    if (n > 1) dup.add(k);
  }
  return dup;
}

export interface EvidenceBasedTransparencyBreakdown {
  status_visibility_score: number;
  progress_visibility_score: number;
  basic_information_completeness_score: number;
  data_quality_reliability_score: number;
  evidence_based_transparency_score: number;
  date_anomaly_flag: boolean;
  duplicate_key_flag: boolean;
}

/**
 * Evidence-Based Transparency Score (0–100). Primary dashboard model.
 * Does not use document_completeness_score or has_documents (see README).
 */
export function calculateEvidenceBasedTransparencyBreakdown(
  r: StandardCouncilRecord,
  duplicateKeys: Set<string>
): EvidenceBasedTransparencyBreakdown {
  const statusRaw = r.status_clarity_score;
  const status_visibility_score =
    typeof statusRaw === "number" && Number.isFinite(statusRaw) ? (statusRaw / 2) * 100 : 0;

  const hasProgressParsed = parseBooleanLoose(r.has_progress_info);
  const has_progress_info_score = hasProgressParsed.value === true ? 100 : 0;

  const updateRaw = r.update_visibility_score;
  const update_visibility_score_normalised =
    typeof updateRaw === "number" && Number.isFinite(updateRaw) ? (updateRaw / 2) * 100 : 0;

  const progress_visibility_score =
    has_progress_info_score * 0.5 + update_visibility_score_normalised * 0.5;

  const required: Array<keyof StandardCouncilRecord> = [
    "council",
    "application_no",
    "address",
    "development_type",
    "description",
    "lodged_date",
    "decision"
  ];
  const len = required.length;
  let filled = 0;
  for (const f of required) {
    const v = r[f];
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && !v.trim()) continue;
    filled++;
  }
  const missingRequiredFieldsCount = len - filled;
  const basic_information_completeness_score = (filled / len) * 100;

  const date_anomaly_flag =
    !!(r.lodged_date && r.decision_date && r.decision_date < r.lodged_date) ||
    Boolean(r.lodged_date) !== Boolean(r.decision_date);

  const score_out_of_range =
    !scoreInRange(r.status_clarity_score) ||
    !scoreInRange(r.document_completeness_score) ||
    !scoreInRange(r.update_visibility_score) ||
    !scoreInRange(r.navigation_ease_score);

  const duplicate_key_flag = duplicateKeys.has(compositeRecordKey(r));

  let data_quality_reliability_score = 100;
  if (date_anomaly_flag) data_quality_reliability_score -= 30;
  if (missingRequiredFieldsCount > 0) data_quality_reliability_score -= 20;
  if (score_out_of_range) data_quality_reliability_score -= 30;
  if (duplicate_key_flag) data_quality_reliability_score -= 30;
  data_quality_reliability_score = Math.max(0, data_quality_reliability_score);

  const evidence_based_transparency_score = Number(
    (
      status_visibility_score * 0.35 +
      progress_visibility_score * 0.35 +
      basic_information_completeness_score * 0.2 +
      data_quality_reliability_score * 0.1
    ).toFixed(2)
  );

  return {
    status_visibility_score: Number(status_visibility_score.toFixed(2)),
    progress_visibility_score: Number(progress_visibility_score.toFixed(2)),
    basic_information_completeness_score: Number(basic_information_completeness_score.toFixed(2)),
    data_quality_reliability_score: Number(data_quality_reliability_score.toFixed(2)),
    evidence_based_transparency_score,
    date_anomaly_flag,
    duplicate_key_flag
  };
}

export function calculateEvidenceBasedTransparencyScore(
  r: StandardCouncilRecord,
  duplicateKeys: Set<string>
): number {
  return calculateEvidenceBasedTransparencyBreakdown(r, duplicateKeys).evidence_based_transparency_score;
}

