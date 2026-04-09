import { REQUIRED_KEYS, type StandardCouncilRecord } from "../../schemas/standard-schema.js";
import { parseYesNo } from "../boolean.js";
import { parseToIsoDate } from "../date.js";
import { normalizeDecision } from "../decision.js";
import { type AuditIssue } from "./schemaA.js";

/** Same parsing as schemaA: trim, empty -> null, non-finite -> null */
function numOrNull(s: unknown): number | null {
  if (s === null || s === undefined) return null;
  const raw = String(s).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** First non-null numeric among candidate column keys (canonical name first, then aliases). */
function scoreFromRow(row: Record<string, string>, keys: string[]): number | null {
  for (const k of keys) {
    const v = numOrNull(row[k]);
    if (v !== null) return v;
  }
  return null;
}

const STATUS_CLARITY_KEYS = [
  "status_clarity_score",
  "status_clarity",
  "clarity_score"
];
const DOC_COMPLETENESS_KEYS = [
  "document_completeness_score",
  "document_completeness",
  "doc_completeness_score"
];
const UPDATE_VISIBILITY_KEYS = ["update_visibility_score", "update_visibility"];
const NAVIGATION_EASE_KEYS = ["navigation_ease_score", "navigation_ease"];

export function mapNorthSydneyRow(args: {
  file: string;
  rowNumber: number;
  row: Record<string, string>;
  issues: AuditIssue[];
}): StandardCouncilRecord {
  const { file, rowNumber, row, issues } = args;

  const council = (row["council"] ?? "").trim() || null;
  const application_no = (row["application_no"] ?? "").trim() || null;
  const address = (row["address"] ?? "").trim() || null;
  const development_type = (row["application_type"] ?? "").trim() || null;
  const description = (row["description"] ?? "").trim() || null;
  const notes = (row["notes"] ?? "").trim() || null;

  const lodgedRes = parseToIsoDate(row["submitted_date"]);
  const decisionRes = parseToIsoDate(row["determination_date"]);

  if (lodgedRes.error) {
    issues.push({
      type: "date_parse_failed",
      field: "lodged_date",
      input: lodgedRes.error.input,
      code: lodgedRes.error.code,
      file,
      rowNumber,
      application_no,
      council
    });
  }
  if (decisionRes.error) {
    issues.push({
      type: "date_parse_failed",
      field: "decision_date",
      input: decisionRes.error.input,
      code: decisionRes.error.code,
      file,
      rowNumber,
      application_no,
      council
    });
  }

  const hasProgressRes = parseYesNo(row["has_tracking"]);
  const hasDocsRes = parseYesNo(row["has_documents"]);
  if (hasProgressRes.error) {
    issues.push({
      type: "boolean_parse_failed",
      field: "has_progress_info",
      input: hasProgressRes.error.input,
      file,
      rowNumber,
      application_no,
      council
    });
  }
  if (hasDocsRes.error) {
    issues.push({
      type: "boolean_parse_failed",
      field: "has_documents",
      input: hasDocsRes.error.input,
      file,
      rowNumber,
      application_no,
      council
    });
  }

  for (const k of REQUIRED_KEYS) {
    const v =
      k === "council"
        ? council
        : k === "application_no"
          ? application_no
          : k === "address"
            ? address
            : null;
    if (!v) {
      issues.push({
        type: "missing_key_field",
        field: k,
        file,
        rowNumber,
        application_no,
        council
      });
    }
  }

  // Decision rule per user: keep original terms; normalize only "Application Approved".
  const decisionRaw =
    (row["determination_type"] ?? "").trim() ||
    (row["application_status"] ?? "").trim() ||
    "";
  const decision = normalizeDecision(decisionRaw);

  return {
    council,
    application_no,
    address,
    development_type,
    description,
    lodged_date: lodgedRes.value,
    decision,
    decision_date: decisionRes.value,
    has_progress_info: hasProgressRes.value,
    has_documents: hasDocsRes.value,
    status_clarity_score: scoreFromRow(row, STATUS_CLARITY_KEYS),
    document_completeness_score: scoreFromRow(row, DOC_COMPLETENESS_KEYS),
    update_visibility_score: scoreFromRow(row, UPDATE_VISIBILITY_KEYS),
    navigation_ease_score: scoreFromRow(row, NAVIGATION_EASE_KEYS),
    notes
  };
}

