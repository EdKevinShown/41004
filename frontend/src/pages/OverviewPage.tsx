import { StatCard } from "../components/StatCard";
import { useRecords } from "../data/useRecords";
import { bucketDecision, pct, safeBool } from "../lib/metrics";

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

  for (const r of records) {
    const b = bucketDecision(r.decision);
    if (b === "Approved") approved++;
    else if (b === "Refused/Declined") refusedDeclined++;
    else if (b === "Pending/In Progress/Under Assessment") pendingInProgressUnder++;

    if (safeBool(r.has_documents)) hasDocs++;
    if (safeBool(r.has_progress_info)) hasProgress++;
    if (!safeBool(r.has_documents) && !safeBool(r.has_progress_info)) noDocsNoProgress++;
  }

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
            Transparency-related scores in this dashboard use a <span className="font-semibold">0-2 scale</span>,
            where higher values indicate stronger visibility, clarity, and ease of access.
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      </section>
    </div>
  );
}

