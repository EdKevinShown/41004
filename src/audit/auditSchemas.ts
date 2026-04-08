import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadAllCouncilsFromCwd } from "../data/load/loadAllCouncils.js";
import { type AuditIssue } from "../data/normalize/mappers/schemaA.js";

export interface AuditReport {
  generatedAt: string;
  perFile: Array<{
    file: string;
    schemaType: string;
    recordCount: number;
  }>;
  totals: {
    totalRecords: number;
    totalIssues: number;
  };
  dateParseFailures: AuditIssue[];
  decisionBeforeLodged: AuditIssue[];
  missingKeyFields: AuditIssue[];
  booleanParseFailures: AuditIssue[];
}

function groupIssues(issues: AuditIssue[]): AuditReport {
  const dateParseFailures = issues.filter((i) => i.type === "date_parse_failed");
  const decisionBeforeLodged = issues.filter((i) => i.type === "decision_before_lodged");
  const missingKeyFields = issues.filter((i) => i.type === "missing_key_field");
  const booleanParseFailures = issues.filter((i) => i.type === "boolean_parse_failed");

  return {
    generatedAt: new Date().toISOString(),
    perFile: [],
    totals: {
      totalRecords: 0,
      totalIssues: issues.length
    },
    dateParseFailures,
    decisionBeforeLodged,
    missingKeyFields,
    booleanParseFailures
  };
}

export async function runAuditFromCwd(): Promise<AuditReport> {
  const { records, issues, perFile } = await loadAllCouncilsFromCwd();
  const report = groupIssues(issues);
  report.perFile = perFile;
  report.totals.totalRecords = records.length;
  return report;
}

function isDirectRun(): boolean {
  // tsx sets argv[1] to the entry file path
  const entry = process.argv[1] ?? "";
  return /auditSchemas\.(ts|js)$/.test(entry.replace(/\\/g, "/"));
}

if (isDirectRun()) {
  const report = await runAuditFromCwd();
  const outPath = resolve(process.cwd(), "audit-report.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        outFile: outPath,
        totals: report.totals,
        perFile: report.perFile
      },
      null,
      2
    )
  );
}

