import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadAllCouncilsFromCwd } from "./data/load/loadAllCouncils.js";
import { runAuditFromCwd } from "./audit/auditSchemas.js";
import { syncFrontendDataFromRoot } from "./syncFrontendData.js";

const { records, perFile } = await loadAllCouncilsFromCwd();
const audit = await runAuditFromCwd();

const normalizedOut = resolve(process.cwd(), "normalized-records.json");
await writeFile(normalizedOut, JSON.stringify(records, null, 2), "utf8");
const syncResult = await syncFrontendDataFromRoot(process.cwd());

console.log(
  JSON.stringify(
    {
      normalizedOut,
      totalRecords: records.length,
      perFile,
      auditTotals: audit.totals,
      auditOut: resolve(process.cwd(), "audit-report.json"),
      frontendCopy: syncResult.target
    },
    null,
    2
  )
);

