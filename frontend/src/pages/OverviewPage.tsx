import { StatCard } from "../components/StatCard";
import { useRecords } from "../data/useRecords";
import {
  bucketDecision,
  calculateEvidenceBasedTransparencyScore,
  calculateWeightedTransparencyIndex,
  getDuplicateCompositeKeys,
  pct,
  safeBool
} from "../lib/metrics";

export function OverviewPage() {
  const { state } = useRecords();

  if (state.status === "loading") return <div className="p-6">Loading data…</div>;
  if (state.status === "error") return <div className="p-6 text-red-700">{state.error}</div>;

  const records = state.records;
  const total = records.length;

  const councils = new Set(records.map((r) => r.council ?? "").filter((c) => c.trim()));
  let approved = 0;
  let refusedDeclined = 0;
  let pendingInProgressUnder = 0;
  let hasDocs = 0;
  let hasProgress = 0;
  let noDocsNoProgress = 0;
  const weightedScores: number[] = [];
  const duplicateKeys = getDuplicateCompositeKeys(records);
  const ebtScores: number[] = [];

  for (const r of records) {
    const b = bucketDecision(r.decision);
    if (b === "Approved") approved++;
    else if (b === "Refused/Declined") refusedDeclined++;
    else if (b === "Pending/In Progress/Under Assessment") pendingInProgressUnder++;

    if (safeBool(r.has_documents)) hasDocs++;
    if (safeBool(r.has_progress_info)) hasProgress++;
    if (!safeBool(r.has_documents) && !safeBool(r.has_progress_info)) noDocsNoProgress++;
    const weighted = calculateWeightedTransparencyIndex(r);
    if (weighted !== null) weightedScores.push(weighted);
    ebtScores.push(calculateEvidenceBasedTransparencyScore(r, duplicateKeys));
  }
  const avgWeighted =
    weightedScores.length > 0
      ? (weightedScores.reduce((a, b) => a + b, 0) / weightedScores.length).toFixed(2)
      : "—";
  const avgEbt =
    ebtScores.length > 0
      ? (ebtScores.reduce((a, b) => a + b, 0) / ebtScores.length).toFixed(1)
      : "—";

  const findings: string[] = [
    `${pct(approved, total)} of applications are currently marked as Approved.`,
    `${pct(refusedDeclined, total)} of applications are Refused/Declined, indicating visible decision diversity.`,
    `${pct(noDocsNoProgress, total)} of applications show neither documents nor progress tracking.`,
    `Coverage differs across ${councils.size} councils, suggesting uneven transparency experiences.`
  ];

  return (
    <div className="space-y-7">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Project Overview</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          This dashboard compares development application transparency across selected NSW councils
          using standardized, real records. It highlights how clearly application status, documents,
          and progress updates are surfaced to end users. The objective is to support evidence-based
          discussion for policy, product, and service improvements.
        </p>
      </section>

      <section className="rounded-xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Scoring Note</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          <p>
            The primary comparative indicator is the{" "}
            <span className="font-semibold">Evidence-Based Transparency Score (0–100)</span>, combining
            status visibility, progress visibility (tracking flag + update rubric), completeness of core
            record fields, and data-quality reliability.{" "}
            <span className="font-semibold">document_completeness_score</span> and{" "}
            <span className="font-semibold">has_documents</span> are excluded from this primary score
            until systematic verified document capture is available (see README).
          </p>
          <p>
            <span className="font-semibold">navigation_ease_score</span> remains as a{" "}
            <span className="font-semibold">baseline usability field</span> only: all records in the current
            snapshot have navigation_ease_score = 2, so it does not differentiate councils here.
          </p>
          <p>
            Rubric-backed scores continue to use a <span className="font-semibold">0-2 scale</span>,
            where higher values indicate stronger visibility and clarity on public portals.
          </p>
          <p>
            Score meanings: <span className="font-semibold">0</span> = not visible/unavailable,{" "}
            <span className="font-semibold">1</span> = partially visible/limited,{" "}
            <span className="font-semibold">2</span> = clearly visible/well surfaced.
          </p>
          <p>
            Some indicators were manually coded from portal evidence and screenshots using a shared
            rubric. These scores are analytical indicators for comparison, not official council
            ratings.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Application Records"
          value={total}
          sub="All normalized cases included in this dashboard"
        />
        <StatCard
          label="Councils Covered"
          value={councils.size}
          sub="Distinct NSW council datasets in scope"
        />
        <StatCard
          label="Approved Outcomes"
          value={approved}
          sub={`${pct(approved, total)} of all cases`}
          hint="Decision values preserved from source data"
        />
        <StatCard
          label="Refused / Declined Outcomes"
          value={refusedDeclined}
          sub={`${pct(refusedDeclined, total)} of all cases`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Pending / In Progress / Under Assessment Cases"
          value={pendingInProgressUnder}
          sub={`${pct(pendingInProgressUnder, total)} of all cases are still active`}
        />
        <StatCard
          label="Document Availability Rate"
          value={pct(hasDocs, total)}
          sub={`${hasDocs} of ${total} cases include documents`}
          hint="Based on has_documents boolean field"
        />
        <StatCard
          label="Progress Information Visibility"
          value={pct(hasProgress, total)}
          sub={`${hasProgress} of ${total} cases expose progress info`}
          hint="Based on has_progress_info boolean field"
        />
        <StatCard
          label="Avg Evidence-Based Transparency Score"
          value={avgEbt}
          sub="Primary model (0–100): status 35%, progress 35%, completeness 20%, reliability 10%"
        />
        <StatCard
          label="Legacy weighted index (reference)"
          value={avgWeighted}
          sub="Not primary; includes docs/navigation rubric weights — report uses EBT as main metric"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Key Findings Preview</h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
          {findings.map((f) => (
            <li key={f} className="rounded-lg bg-slate-50 px-3 py-2">
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Data Interpretation Note</h3>
        <p className="mt-2 text-sm text-slate-700">
          Council portals do not expose information in exactly the same structure. Some transparency
          indicators are derived from visible portal evidence rather than native structured fields.
          Score differences can reflect both actual transparency differences and source presentation
          differences.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Scores are comparative transparency indicators based on visible portal evidence. They do
          not assess the quality of council planning decisions.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Assignment 3 interpretation note: document linkage was not systematically captured in the
          original collection; re-introducing documents into the primary score requires verified document
          data rather than informal flags alone.
        </p>
      </section>
    </div>
  );
}

