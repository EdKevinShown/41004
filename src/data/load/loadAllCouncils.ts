import { resolve } from "node:path";
import { loadCsv } from "./csv.js";
import { type StandardCouncilRecord } from "../schemas/standard-schema.js";
import { mapSchemaARow, type AuditIssue } from "../normalize/mappers/schemaA.js";
import { mapNorthSydneyRow } from "../normalize/mappers/northSydney.js";

export const COUNCIL_CSV_FILES = [
  "Burwood_Council.csv",
  "Campbelltown_City_Council.csv",
  "City_of_Parramatta_Council.csv",
  "Council_of_the_City_of_Sydney.csv",
  "Georges River.csv",
  "Inner_West_Council.csv",
  "Liverpool_City_Council.csv",
  "North Sydney.csv",
  "Ryde_City_Council.csv",
  "Sutherland Shire.csv",
  "The_Council_of_the_Municipality_of_Hunters_Hill.csv",
  "Willoughby_City_Council.csv"
] as const;

export interface LoadAllResult {
  records: StandardCouncilRecord[];
  issues: AuditIssue[];
  perFile: Array<{
    file: string;
    schemaType: string;
    recordCount: number;
  }>;
}

export async function loadAllCouncilsFromCwd(): Promise<LoadAllResult> {
  const records: StandardCouncilRecord[] = [];
  const issues: AuditIssue[] = [];
  const perFile: LoadAllResult["perFile"] = [];

  const cwd = process.cwd();
  for (const file of COUNCIL_CSV_FILES) {
    const filePath = resolve(cwd, file);
    const loaded = await loadCsv(filePath);

    perFile.push({
      file,
      schemaType: loaded.schemaType,
      recordCount: loaded.rows.length
    });

    if (loaded.schemaType === "schemaA") {
      for (let i = 0; i < loaded.rows.length; i++) {
        const row = loaded.rows[i]!;
        const rowNumber = i + 2; // header is row 1
        records.push(mapSchemaARow({ file, rowNumber, row, issues }));
      }
      continue;
    }

    if (loaded.schemaType === "northSydney") {
      for (let i = 0; i < loaded.rows.length; i++) {
        const row = loaded.rows[i]!;
        const rowNumber = i + 2;
        records.push(mapNorthSydneyRow({ file, rowNumber, row, issues }));
      }
      continue;
    }

    // Unknown schema: still record issues as missing keys per row
    for (let i = 0; i < loaded.rows.length; i++) {
      const rowNumber = i + 2;
      issues.push({
        type: "missing_key_field",
        field: "council",
        file,
        rowNumber,
        application_no: null,
        council: null
      });
    }
  }

  return { records, issues, perFile };
}

