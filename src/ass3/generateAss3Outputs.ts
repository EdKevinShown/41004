import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type StandardCouncilRecord } from "../data/schemas/standard-schema.js";

type PortalSource = "Council-managed portal" | "NSW Planning Portal";

interface Ass3Record extends StandardCouncilRecord {
  portal_source: PortalSource;
  has_documents_bool: boolean | null;
  has_progress_info_bool: boolean | null;
  transparency_average_score: number | null;
  weighted_transparency_index: number | null;
  transparency_index_equal_weight: number | null;
  transparency_index_document_focused: number | null;
  transparency_index_navigation_focused: number | null;
  missing_required_fields_count: number;
  missing_required_fields_rate: number;
  approval_duration_days: number | null;
  date_anomaly_flag: boolean;
  data_quality_flag: "OK" | "Review required";
  score_out_of_range_flag: boolean;
  boolean_parse_issue_flag: boolean;
  duplicate_key_flag: boolean;
  status_visibility_score: number;
  progress_visibility_score: number;
  basic_information_completeness_score: number;
  data_quality_reliability_score: number;
  evidence_based_transparency_score: number;
}

const REQUIRED_FIELDS: Array<keyof StandardCouncilRecord> = [
  "council",
  "application_no",
  "address",
  "development_type",
  "description",
  "lodged_date",
  "decision"
];

function derivePortalSource(council: string | null): PortalSource {
  const c = (council ?? "").trim();
  if (c === "Georges River" || c === "North Sydney" || c === "Sutherland Shire") {
    return "Council-managed portal";
  }
  return "NSW Planning Portal";
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

function parseIsoDateSafe(input: string | null): Date | null {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function scoreInRange(v: number | null): boolean {
  return v === null || (Number.isFinite(v) && v >= 0 && v <= 2);
}

function weightedScore(
  record: StandardCouncilRecord,
  weights: { status: number; doc: number; update: number; nav: number }
): number | null {
  const parts: Array<{ score: number | null; weight: number }> = [
    { score: record.status_clarity_score, weight: weights.status },
    { score: record.document_completeness_score, weight: weights.doc },
    { score: record.update_visibility_score, weight: weights.update },
    { score: record.navigation_ease_score, weight: weights.nav }
  ];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const p of parts) {
    if (typeof p.score === "number" && Number.isFinite(p.score)) {
      weightedSum += p.score * p.weight;
      totalWeight += p.weight;
    }
  }
  if (!totalWeight) return null;
  return weightedSum / totalWeight;
}

function averageScores(record: StandardCouncilRecord): number | null {
  const vals = [
    record.status_clarity_score,
    record.document_completeness_score,
    record.update_visibility_score,
    record.navigation_ease_score
  ].filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function toFixedOrNull(v: number | null, digits = 4): number | null {
  return v === null ? null : Number(v.toFixed(digits));
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function avg(nums: Array<number | null>): number | null {
  const xs = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function compositeRecordKey(r: StandardCouncilRecord): string {
  return `${r.council ?? ""}||${r.application_no ?? ""}||${r.address ?? ""}`;
}

function getDuplicateCompositeKeys(records: StandardCouncilRecord[]): Set<string> {
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

/** Evidence-Based Transparency Score (0–100); aligns with dashboard `metrics.ts` logic. */
function computeEvidenceBasedTransparency(args: {
  record: StandardCouncilRecord;
  duplicateKeys: Set<string>;
  missingRequiredFieldsCount: number;
  dateAnomaly: boolean;
  scoreOutOfRange: boolean;
}): {
  status_visibility_score: number;
  progress_visibility_score: number;
  basic_information_completeness_score: number;
  data_quality_reliability_score: number;
  evidence_based_transparency_score: number;
  duplicate_key_flag: boolean;
} {
  const { record: r, duplicateKeys, missingRequiredFieldsCount, dateAnomaly, scoreOutOfRange } =
    args;

  const statusRaw = r.status_clarity_score;
  const status_visibility_score =
    typeof statusRaw === "number" && Number.isFinite(statusRaw) ? (statusRaw / 2) * 100 : 0;

  const hp = parseBooleanLoose(r.has_progress_info);
  const has_progress_info_score = hp.value === true ? 100 : 0;

  const updRaw = r.update_visibility_score;
  const update_visibility_score_normalised =
    typeof updRaw === "number" && Number.isFinite(updRaw) ? (updRaw / 2) * 100 : 0;

  const progress_visibility_score =
    has_progress_info_score * 0.5 + update_visibility_score_normalised * 0.5;

  const filled = REQUIRED_FIELDS.length - missingRequiredFieldsCount;
  const basic_information_completeness_score =
    (filled / REQUIRED_FIELDS.length) * 100;

  const duplicate_key_flag = duplicateKeys.has(compositeRecordKey(r));

  let data_quality_reliability_score = 100;
  if (dateAnomaly) data_quality_reliability_score -= 30;
  if (missingRequiredFieldsCount > 0) data_quality_reliability_score -= 20;
  if (scoreOutOfRange) data_quality_reliability_score -= 30;
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
    duplicate_key_flag
  };
}

async function run(): Promise<void> {
  const cwd = process.cwd();
  const inputPath = resolve(cwd, "normalized-records.json");
  const outputsRoot = resolve(cwd, "outputs");
  const reportTables = resolve(outputsRoot, "report_tables");
  const modelOutputs = resolve(outputsRoot, "model_outputs");
  await mkdir(reportTables, { recursive: true });
  await mkdir(modelOutputs, { recursive: true });

  const input = JSON.parse(await readFile(inputPath, "utf8")) as StandardCouncilRecord[];

  const duplicateKeys = getDuplicateCompositeKeys(input);

  const ass3Records: Ass3Record[] = input.map((r) => {
    const hasDocs = parseBooleanLoose(r.has_documents);
    const hasProgress = parseBooleanLoose(r.has_progress_info);
    const missingRequired = REQUIRED_FIELDS.filter((f) => {
      const val = r[f];
      if (val === null || val === undefined) return true;
      if (typeof val === "string") return !val.trim();
      return false;
    }).length;

    const scoreOutOfRange =
      !scoreInRange(r.status_clarity_score) ||
      !scoreInRange(r.document_completeness_score) ||
      !scoreInRange(r.update_visibility_score) ||
      !scoreInRange(r.navigation_ease_score);

    const lodged = parseIsoDateSafe(r.lodged_date);
    const decided = parseIsoDateSafe(r.decision_date);
    let approvalDurationDays: number | null = null;
    let dateAnomaly = false;
    if (lodged && decided) {
      const diff = Math.round((decided.getTime() - lodged.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0) dateAnomaly = true;
      else approvalDurationDays = diff;
    } else if (r.lodged_date || r.decision_date) {
      dateAnomaly = true;
    }

    const dataQualityFlag =
      missingRequired > 0 || scoreOutOfRange || dateAnomaly || hasDocs.issue || hasProgress.issue
        ? "Review required"
        : "OK";

    const ebt = computeEvidenceBasedTransparency({
      record: r,
      duplicateKeys,
      missingRequiredFieldsCount: missingRequired,
      dateAnomaly,
      scoreOutOfRange: scoreOutOfRange
    });

    return {
      ...r,
      portal_source: derivePortalSource(r.council),
      has_documents_bool: hasDocs.value,
      has_progress_info_bool: hasProgress.value,
      transparency_average_score: toFixedOrNull(averageScores(r)),
      weighted_transparency_index: toFixedOrNull(
        weightedScore(r, { status: 0.25, doc: 0.3, update: 0.25, nav: 0.2 })
      ),
      transparency_index_equal_weight: toFixedOrNull(
        weightedScore(r, { status: 0.25, doc: 0.25, update: 0.25, nav: 0.25 })
      ),
      transparency_index_document_focused: toFixedOrNull(
        weightedScore(r, { status: 0.2, doc: 0.4, update: 0.2, nav: 0.2 })
      ),
      transparency_index_navigation_focused: toFixedOrNull(
        weightedScore(r, { status: 0.25, doc: 0.25, update: 0.2, nav: 0.3 })
      ),
      missing_required_fields_count: missingRequired,
      missing_required_fields_rate: Number((missingRequired / REQUIRED_FIELDS.length).toFixed(4)),
      approval_duration_days: approvalDurationDays,
      date_anomaly_flag: dateAnomaly,
      data_quality_flag: dataQualityFlag,
      score_out_of_range_flag: scoreOutOfRange,
      boolean_parse_issue_flag: hasDocs.issue || hasProgress.issue,
      duplicate_key_flag: ebt.duplicate_key_flag,
      status_visibility_score: ebt.status_visibility_score,
      progress_visibility_score: ebt.progress_visibility_score,
      basic_information_completeness_score: ebt.basic_information_completeness_score,
      data_quality_reliability_score: ebt.data_quality_reliability_score,
      evidence_based_transparency_score: ebt.evidence_based_transparency_score
    };
  });

  const councils = [...new Set(ass3Records.map((r) => r.council).filter(Boolean))] as string[];

  const councilSummary = councils
    .map((council) => {
      const rows = ass3Records.filter((r) => r.council === council);
      const total = rows.length;
      const docs = rows.filter((r) => r.has_documents_bool === true).length;
      const progress = rows.filter((r) => r.has_progress_info_bool === true).length;
      return {
        council,
        portal_source: derivePortalSource(council),
        total_records: total,
        document_available_count: docs,
        progress_visible_count: progress,
        document_availability_rate: Number((docs / total).toFixed(4)),
        progress_visibility_rate: Number((progress / total).toFixed(4)),
        avg_status_clarity: toFixedOrNull(avg(rows.map((r) => r.status_clarity_score))),
        avg_document_completeness: toFixedOrNull(avg(rows.map((r) => r.document_completeness_score))),
        avg_update_visibility: toFixedOrNull(avg(rows.map((r) => r.update_visibility_score))),
        avg_navigation_ease: toFixedOrNull(avg(rows.map((r) => r.navigation_ease_score))),
        avg_transparency_average_score: toFixedOrNull(avg(rows.map((r) => r.transparency_average_score))),
        avg_weighted_transparency_index: toFixedOrNull(
          avg(rows.map((r) => r.weighted_transparency_index))
        ),
        avg_evidence_based_transparency_score: toFixedOrNull(
          avg(rows.map((r) => r.evidence_based_transparency_score))
        ),
        avg_status_visibility_score: toFixedOrNull(avg(rows.map((r) => r.status_visibility_score))),
        avg_progress_visibility_score: toFixedOrNull(avg(rows.map((r) => r.progress_visibility_score))),
        avg_basic_information_completeness_score: toFixedOrNull(
          avg(rows.map((r) => r.basic_information_completeness_score))
        ),
        avg_data_quality_reliability_score: toFixedOrNull(
          avg(rows.map((r) => r.data_quality_reliability_score))
        ),
        avg_missing_required_fields: toFixedOrNull(avg(rows.map((r) => r.missing_required_fields_count))),
        date_anomaly_count: rows.filter((r) => r.date_anomaly_flag).length,
        avg_approval_duration_days: toFixedOrNull(avg(rows.map((r) => r.approval_duration_days)))
      };
    })
    .sort((a, b) => a.council.localeCompare(b.council));

  const portalGroups = ["Council-managed portal", "NSW Planning Portal"] as const;
  const portalComparison = portalGroups.map((portal_source) => {
    const rows = ass3Records.filter((r) => r.portal_source === portal_source);
    const total = rows.length;
    const docs = rows.filter((r) => r.has_documents_bool === true).length;
    const progress = rows.filter((r) => r.has_progress_info_bool === true).length;
    return {
      portal_source,
      total_records: total,
      council_count: new Set(rows.map((r) => r.council).filter(Boolean)).size,
      document_availability_rate: total ? Number((docs / total).toFixed(4)) : 0,
      progress_visibility_rate: total ? Number((progress / total).toFixed(4)) : 0,
      avg_status_clarity: toFixedOrNull(avg(rows.map((r) => r.status_clarity_score))),
      avg_document_completeness: toFixedOrNull(avg(rows.map((r) => r.document_completeness_score))),
      avg_update_visibility: toFixedOrNull(avg(rows.map((r) => r.update_visibility_score))),
      avg_navigation_ease: toFixedOrNull(avg(rows.map((r) => r.navigation_ease_score))),
      avg_weighted_transparency_index: toFixedOrNull(avg(rows.map((r) => r.weighted_transparency_index))),
      avg_evidence_based_transparency_score: toFixedOrNull(
        avg(rows.map((r) => r.evidence_based_transparency_score))
      ),
      date_anomaly_count: rows.filter((r) => r.date_anomaly_flag).length
    };
  });

  const duplicateKeyCount = [...duplicateKeys].length;

  const dataQualityReport = [
    {
      total_records: ass3Records.length,
      total_councils: councils.length,
      missing_required_fields_total: ass3Records.reduce(
        (sum, r) => sum + r.missing_required_fields_count,
        0
      ),
      records_with_missing_required_fields: ass3Records.filter(
        (r) => r.missing_required_fields_count > 0
      ).length,
      score_out_of_range_count: ass3Records.filter((r) => r.score_out_of_range_flag).length,
      date_anomaly_count: ass3Records.filter((r) => r.date_anomaly_flag).length,
      duplicate_key_count: duplicateKeyCount,
      boolean_parse_issue_count: ass3Records.filter((r) => r.boolean_parse_issue_flag).length,
      records_requiring_review: ass3Records.filter((r) => r.data_quality_flag === "Review required")
        .length,
      data_quality_notes:
        "Review required indicates missing required fields, score out-of-range, date anomaly, or boolean parse issue."
    }
  ];

  const sensitivitySummary = councilSummary.map((s) => {
    const rows = ass3Records.filter((r) => r.council === s.council);
    return {
      council: s.council,
      portal_source: s.portal_source,
      weighted_default: toFixedOrNull(avg(rows.map((r) => r.weighted_transparency_index))),
      equal_weight: toFixedOrNull(avg(rows.map((r) => r.transparency_index_equal_weight))),
      document_focused: toFixedOrNull(avg(rows.map((r) => r.transparency_index_document_focused))),
      navigation_focused: toFixedOrNull(avg(rows.map((r) => r.transparency_index_navigation_focused)))
    };
  });

  const bestDoc = [...councilSummary].sort(
    (a, b) => b.document_availability_rate - a.document_availability_rate
  )[0];
  const lowDoc = [...councilSummary].sort(
    (a, b) => a.document_availability_rate - b.document_availability_rate
  )[0];
  const highProg = [...councilSummary].sort(
    (a, b) => b.progress_visibility_rate - a.progress_visibility_rate
  )[0];
  const lowProg = [...councilSummary].sort(
    (a, b) => a.progress_visibility_rate - b.progress_visibility_rate
  )[0];

  const bestEbt = [...councilSummary].sort(
    (a, b) =>
      (b.avg_evidence_based_transparency_score ?? -1) - (a.avg_evidence_based_transparency_score ?? -1)
  )[0];
  const lowEbt = [...councilSummary].sort(
    (a, b) =>
      (a.avg_evidence_based_transparency_score ?? 999) - (b.avg_evidence_based_transparency_score ?? 999)
  )[0];

  const executiveSummaryMetrics = {
    total_records: ass3Records.length,
    total_councils: councils.length,
    overall_document_availability_rate: Number(
      (
        ass3Records.filter((r) => r.has_documents_bool === true).length / ass3Records.length
      ).toFixed(4)
    ),
    overall_progress_visibility_rate: Number(
      (
        ass3Records.filter((r) => r.has_progress_info_bool === true).length / ass3Records.length
      ).toFixed(4)
    ),
    overall_avg_weighted_transparency_index: toFixedOrNull(
      avg(ass3Records.map((r) => r.weighted_transparency_index))
    ),
    overall_avg_evidence_based_transparency_score: toFixedOrNull(
      avg(ass3Records.map((r) => r.evidence_based_transparency_score))
    ),
    best_evidence_based_transparency_council: bestEbt?.council ?? null,
    lowest_evidence_based_transparency_council: lowEbt?.council ?? null,
    best_document_availability_council: bestDoc?.council ?? null,
    lowest_document_availability_council: lowDoc?.council ?? null,
    highest_progress_visibility_council: highProg?.council ?? null,
    lowest_progress_visibility_council: lowProg?.council ?? null,
    key_interpretation_notes: [
      "Primary comparative metric is Evidence-Based Transparency Score (0–100): status, progress, field completeness, and data-quality reliability.",
      "Scores are comparative transparency indicators based on visible portal evidence.",
      "These indicators do not assess the quality of council planning decisions.",
      "Legacy weighted transparency index (0–2 rubric mix incl. documents/navigation) is retained for reference only."
    ]
  };

  const explanation = {
    evidence_based_transparency_score: {
      scale: "0-100",
      interpretation_boundary:
        "Comparative public-facing DA information transparency indicator only; not an official council rating.",
      formula:
        "status_visibility*0.35 + progress_visibility*0.35 + basic_information_completeness*0.20 + data_quality_reliability*0.10",
      components: {
        status_visibility_score: "(status_clarity_score / 2) * 100",
        progress_visibility_score:
          "has_progress_info_score*0.5 + (update_visibility_score/2*100)*0.5; has_progress true=100 else 0; null=0",
        basic_information_completeness_score:
          "(non-missing required fields / 7) * 100 for council, application_no, address, development_type, description, lodged_date, decision",
        data_quality_reliability_score:
          "Start 100; -30 date anomaly; -20 any missing required field; -30 score out of range (0–2 rubric fields); -30 duplicate composite key; min 0"
      },
      exclusions:
        "document_completeness_score and has_documents are excluded from this primary score until verified systematic document capture is available.",
      navigation_ease_note:
        "navigation_ease_score is retained as a baseline usability field only (current snapshot is constant at 2 across records)."
    },
    model_name: "Rule-based multi-criteria transparency index",
    interpretation_boundary:
      "Comparative transparency indicator only; not an official council rating and not a planning decision quality assessment.",
    default_weights: {
      status_clarity_score: 0.25,
      document_completeness_score: 0.3,
      update_visibility_score: 0.25,
      navigation_ease_score: 0.2
    },
    rationale:
      "document_completeness_score has a slightly higher weight because supporting documents are critical for public transparency and evidence verification.",
    sensitivity_scenarios: {
      equal_weight: {
        status_clarity_score: 0.25,
        document_completeness_score: 0.25,
        update_visibility_score: 0.25,
        navigation_ease_score: 0.25
      },
      document_focused: {
        status_clarity_score: 0.2,
        document_completeness_score: 0.4,
        update_visibility_score: 0.2,
        navigation_ease_score: 0.2
      },
      navigation_focused: {
        status_clarity_score: 0.25,
        document_completeness_score: 0.25,
        update_visibility_score: 0.2,
        navigation_ease_score: 0.3
      }
    }
  };

  await writeFile(
    resolve(reportTables, "combined_records_with_ass3_metrics.json"),
    JSON.stringify(ass3Records, null, 2),
    "utf8"
  );
  await writeFile(
    resolve(reportTables, "council_transparency_summary.json"),
    JSON.stringify(councilSummary, null, 2),
    "utf8"
  );
  await writeFile(resolve(reportTables, "council_transparency_summary.csv"), toCsv(councilSummary), "utf8");
  await writeFile(
    resolve(reportTables, "portal_source_comparison.json"),
    JSON.stringify(portalComparison, null, 2),
    "utf8"
  );
  await writeFile(resolve(reportTables, "portal_source_comparison.csv"), toCsv(portalComparison), "utf8");
  await writeFile(
    resolve(reportTables, "data_quality_report.json"),
    JSON.stringify(dataQualityReport, null, 2),
    "utf8"
  );
  await writeFile(resolve(reportTables, "data_quality_report.csv"), toCsv(dataQualityReport), "utf8");
  await writeFile(
    resolve(reportTables, "executive_summary_metrics.json"),
    JSON.stringify(executiveSummaryMetrics, null, 2),
    "utf8"
  );
  await writeFile(
    resolve(modelOutputs, "transparency_index_sensitivity_summary.json"),
    JSON.stringify(sensitivitySummary, null, 2),
    "utf8"
  );
  await writeFile(
    resolve(modelOutputs, "transparency_index_sensitivity_summary.csv"),
    toCsv(sensitivitySummary),
    "utf8"
  );
  await writeFile(
    resolve(modelOutputs, "transparency_index_explanation.json"),
    JSON.stringify(explanation, null, 2),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        input: inputPath,
        outputsRoot,
        reportTables,
        modelOutputs,
        generatedFiles: 11
      },
      null,
      2
    )
  );
}

await run();

