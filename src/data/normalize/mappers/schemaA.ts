import {
  REQUIRED_KEYS,
  type IsoDateString,
  type StandardCouncilRecord
} from "../../schemas/standard-schema.js";
import { parseYesNo } from "../boolean.js";
import { compareIsoDates, parseToIsoDate } from "../date.js";
import { normalizeDecision } from "../decision.js";

/** Display / dataset short name (replaces long official council string from source CSV). */
const HUNTERS_HILL_LONG_NAME = "The Council of the Municipality of Hunter's Hill";

export interface AuditIssueBase {
  file: string;
  rowNumber: number; // 1-based in file, including header
  application_no: string | null;
  council: string | null;
}

export type AuditIssue =
  | (AuditIssueBase & {
      type: "date_parse_failed";
      field: "lodged_date" | "decision_date";
      input: string;
      code: string;
    })
  | (AuditIssueBase & {
      type: "decision_before_lodged";
      lodged_date: IsoDateString;
      decision_date: IsoDateString;
    })
  | (AuditIssueBase & {
      type: "missing_key_field";
      field: (typeof REQUIRED_KEYS)[number];
    })
  | (AuditIssueBase & {
      type: "boolean_parse_failed";
      field: "has_progress_info" | "has_documents";
      input: string;
    });

export function mapSchemaARow(args: {
  file: string;
  rowNumber: number;
  row: Record<string, string>;
  issues: AuditIssue[];
}): StandardCouncilRecord {
  const { file, rowNumber, row, issues } = args;

  let council = (row["council"] ?? "").trim() || null;
  if (council === HUNTERS_HILL_LONG_NAME) {
    council = "hunter hills";
  }
  const application_no = (row["application_no"] ?? "").trim() || null;
  const address = (row["address"] ?? "").trim() || null;
  const development_type = (row["development_type"] ?? "").trim() || null;
  const description = (row["description"] ?? "").trim() || null;
  const decision = normalizeDecision(row["decision"]);
  const notes = (row["notes"] ?? "").trim() || null;

  const lodgedRes = parseToIsoDate(row["lodged_date"]);
  const decisionRes = parseToIsoDate(row["decision_date"]);

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

  const hasProgressRes = parseYesNo(row["has_progress_info"]);
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

  if (lodgedRes.value && decisionRes.value) {
    if (compareIsoDates(decisionRes.value, lodgedRes.value) < 0) {
      issues.push({
        type: "decision_before_lodged",
        lodged_date: lodgedRes.value,
        decision_date: decisionRes.value,
        file,
        rowNumber,
        application_no,
        council
      });
    }
  }

  const numOrNull = (s: unknown): number | null => {
    if (s === null || s === undefined) return null;
    const raw = String(s).trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

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
    status_clarity_score: numOrNull(row["status_clarity_score"]),
    document_completeness_score: numOrNull(row["document_completeness_score"]),
    update_visibility_score: numOrNull(row["update_visibility_score"]),
    navigation_ease_score: numOrNull(row["navigation_ease_score"]),
    notes
  };
}

