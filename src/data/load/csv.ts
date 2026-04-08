import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { type SchemaType } from "../schemas/standard-schema.js";

export interface CsvLoadResult {
  filePath: string;
  headers: string[];
  rows: Array<Record<string, string>>;
  schemaType: SchemaType;
}

const SCHEMA_A_HEADERS = [
  "council",
  "application_no",
  "address",
  "development_type",
  "description",
  "lodged_date",
  "decision",
  "decision_date",
  "has_progress_info",
  "has_documents",
  "status_clarity_score",
  "document_completeness_score",
  "update_visibility_score",
  "navigation_ease_score",
  "notes"
];

const NORTH_SYDNEY_HEADERS = [
  "council",
  "application_no",
  "address",
  "application_type",
  "description",
  "submitted_date",
  "application_status",
  "determination_date",
  "determination_type",
  "has_tracking",
  "has_documents",
  "notes"
];

function sameHeaders(actual: string[], expected: string[]): boolean {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

export function detectSchemaType(headers: string[]): SchemaType {
  if (sameHeaders(headers, SCHEMA_A_HEADERS)) return "schemaA";
  if (sameHeaders(headers, NORTH_SYDNEY_HEADERS)) return "northSydney";
  return "unknown";
}

export async function loadCsv(filePath: string): Promise<CsvLoadResult> {
  const content = await readFile(filePath, "utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true
  }) as Array<Record<string, string>>;

  const rawHeaderLine = content.split(/\r?\n/, 1)[0] ?? "";
  const headers = rawHeaderLine
    .replace(/^\uFEFF/, "")
    .split(",")
    .map((h) => h.trim());

  return {
    filePath,
    headers,
    rows: records,
    schemaType: detectSchemaType(headers)
  };
}

