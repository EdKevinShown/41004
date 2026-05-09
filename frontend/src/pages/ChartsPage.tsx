import { useMemo } from "react";
import { ChartCard } from "../components/ChartCard";
import { useRecords } from "../data/useRecords";
import { getCouncilLabel } from "../lib/councilLabels";
import {
  avg,
  bucketDecision,
  calculateDataQualityFlags,
  calculateEvidenceBasedTransparencyBreakdown,
  calculateSensitivityScores,
  calculateWeightedTransparencyIndex,
  derivePortalSource,
  meanTransparencyScore,
  safeBool,
  uniqueCouncils,
  getDuplicateCompositeKeys
} from "../lib/metrics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function ChartsPage() {
  const { state } = useRecords();

  const byCouncil = useMemo(() => {
    if (state.status !== "ready") return [];
    const records = state.records;
    const duplicateKeys = getDuplicateCompositeKeys(records);
    const councils = uniqueCouncils(records);

    return councils.map((council) => {
      const rs = records.filter((r) => (r.council ?? "").trim() === council);
      const cases = rs.length;
      const docs = rs.filter((r) => safeBool(r.has_documents)).length;
      const prog = rs.filter((r) => safeBool(r.has_progress_info)).length;

      const decisionCounts = {
        approved: 0,
        refusedDeclined: 0,
        pendingInProgressUnder: 0,
        other: 0
      };
      for (const r of rs) {
        const b = bucketDecision(r.decision);
        if (b === "Approved") decisionCounts.approved++;
        else if (b === "Refused/Declined") decisionCounts.refusedDeclined++;
        else if (b === "Pending/In Progress/Under Assessment") decisionCounts.pendingInProgressUnder++;
        else decisionCounts.other++;
      }

      const ebtBreakdowns = rs.map((r) => calculateEvidenceBasedTransparencyBreakdown(r, duplicateKeys));

      return {
        council,
        portalSource: derivePortalSource(council),
        cases,
        documentsPct: cases ? Math.round((docs / cases) * 100) : 0,
        progressPct: cases ? Math.round((prog / cases) * 100) : 0,
        avgEBT: avg(ebtBreakdowns.map((b) => b.evidence_based_transparency_score)) ?? null,
        avgStatusVisibility: avg(ebtBreakdowns.map((b) => b.status_visibility_score)) ?? null,
        avgProgressVisibility: avg(ebtBreakdowns.map((b) => b.progress_visibility_score)) ?? null,
        avgDocumentVisibility: avg(ebtBreakdowns.map((b) => b.document_visibility_score)) ?? null,
        avgBasicCompleteness: avg(ebtBreakdowns.map((b) => b.basic_information_completeness_score)) ?? null,
        avgDataQualityReliability:
          avg(ebtBreakdowns.map((b) => b.data_quality_reliability_score)) ?? null,
        avgTransparency: avg(rs.map((r) => meanTransparencyScore(r))) ?? null,
        avgWeightedTransparency: avg(rs.map((r) => calculateWeightedTransparencyIndex(r))) ?? null,
        dateAnomalyCount: rs.filter((r) => calculateDataQualityFlags(r).dateAnomaly).length,
        reviewRequiredCount: rs.filter(
          (r) => calculateDataQualityFlags(r).dataQualityFlag === "Review required"
        ).length,
        sensitivityEqual: avg(rs.map((r) => calculateSensitivityScores(r).equalWeight)) ?? null,
        sensitivityDoc: avg(rs.map((r) => calculateSensitivityScores(r).documentFocused)) ?? null,
        sensitivityNav: avg(rs.map((r) => calculateSensitivityScores(r).navigationFocused)) ?? null,
        approved: decisionCounts.approved,
        refusedDeclined: decisionCounts.refusedDeclined,
        pendingEtc: decisionCounts.pendingInProgressUnder,
        other: decisionCounts.other
      };
    });
  }, [state]);

  if (state.status === "loading") return <div className="p-6">Loading data…</div>;
  if (state.status === "error") return <div className="p-6 text-red-700">{state.error}</div>;

  const byCouncilForTransparency = byCouncil.map((r) => ({
    ...r,
    avgEBT: r.avgEBT === null ? null : Number(r.avgEBT.toFixed(2)),
    avgTransparency: r.avgTransparency === null ? null : Number(r.avgTransparency.toFixed(2)),
    avgWeightedTransparency:
      r.avgWeightedTransparency === null ? null : Number(r.avgWeightedTransparency.toFixed(2)),
    sensitivityEqual: r.sensitivityEqual === null ? null : Number(r.sensitivityEqual.toFixed(2)),
    sensitivityDoc: r.sensitivityDoc === null ? null : Number(r.sensitivityDoc.toFixed(2)),
    sensitivityNav: r.sensitivityNav === null ? null : Number(r.sensitivityNav.toFixed(2))
  }));

  const portalComparison = [
    "Council-managed portal",
    "NSW Planning Portal"
  ].map((portalSource) => {
    const rows = byCouncil.filter((r) => r.portalSource === portalSource);
    const cases = rows.reduce((sum, r) => sum + r.cases, 0);
    const docsWeighted = cases
      ? Math.round(rows.reduce((sum, r) => sum + r.documentsPct * r.cases, 0) / cases)
      : 0;
    const progressWeighted = cases
      ? Math.round(rows.reduce((sum, r) => sum + r.progressPct * r.cases, 0) / cases)
      : 0;
    return {
      portalSource,
      documentsPct: docsWeighted,
      progressPct: progressWeighted
    };
  });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Scoring Note</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          <p>
            The <span className="font-semibold">Evidence-Based Transparency with Documents (EBT-D, 0–100)</span>{" "}
            is the primary comparative indicator. It combines status visibility, progress visibility, document
            visibility (re-crawl <span className="font-semibold">has_documents</span> plus normalised{" "}
            <span className="font-semibold">document_completeness_score</span>), core field completeness, and
            data-quality reliability.
          </p>
          <p>
            <span className="font-semibold">navigation_ease_score</span> feeds the legacy weighted rubric index
            only; it is not a direct EBT-D component.
          </p>
          <p>
            Supporting rubric scores use a <span className="font-semibold">0-2 scale</span>,
            where higher values indicate stronger visibility and clarity on public portals.
          </p>
          <p>
            Score meanings: <span className="font-semibold">0</span> = not visible/unavailable,{" "}
            <span className="font-semibold">1</span> = partially visible/limited,{" "}
            <span className="font-semibold">2</span> = clearly visible/well surfaced.
          </p>
          <p>
            Some indicators were manually coded from portal evidence and screenshots using a shared
            rubric. These scores are for comparative analysis and should not be treated as official
            council ratings.
          </p>
          <p>
            Scores are comparative transparency indicators based on visible portal evidence. They do
            not assess the quality of council planning decisions.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <ChartCard
        title="Document Availability Across Councils"
        subtitle="Percentage of applications with supporting documents available"
        insight="This chart helps clients compare documentation accessibility across councils at a glance."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCouncil} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="council"
                tickFormatter={(value) => getCouncilLabel(String(value))}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={78}
              />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(v) => `${v}%`}
                labelFormatter={(label) => {
                  const full = String(label);
                  const short = getCouncilLabel(full);
                  return short === full ? full : `${short} (${full})`;
                }}
              />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="documentsPct" name="Documents (%)" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Progress Information Visibility Across Councils"
        subtitle="Percentage of applications showing explicit progress information"
        insight="This chart highlights where applicant journey tracking is more or less visible to the public."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCouncil} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="council"
                tickFormatter={(value) => getCouncilLabel(String(value))}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={78}
              />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(v) => `${v}%`}
                labelFormatter={(label) => {
                  const full = String(label);
                  const short = getCouncilLabel(full);
                  return short === full ? full : `${short} (${full})`;
                }}
              />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="progressPct" name="Progress (%)" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="EBT-D score by council"
        subtitle="Primary model (0–100): status 25%, progress 25%, document 25%, completeness 15%, reliability 10%"
        insight="Document leg uses has_documents (100/0) and document_completeness_score normalised to 0–100, each at half weight inside the document pillar."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCouncilForTransparency} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="council"
                tickFormatter={(value) => getCouncilLabel(String(value))}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={78}
              />
              <YAxis domain={[0, 100]} />
              <Tooltip
                labelFormatter={(label) => {
                  const full = String(label);
                  const short = getCouncilLabel(full);
                  return short === full ? full : `${short} (${full})`;
                }}
              />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="avgEBT" name="Avg EBT-D score" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="EBT-D component averages by council"
        subtitle="Mean pillar scores on 0–100 scale behind council-level EBT-D"
        insight="Document pillar = average of per-record document_visibility_score (has_documents and document completeness blend)."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCouncil} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="council"
                tickFormatter={(value) => getCouncilLabel(String(value))}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={78}
              />
              <YAxis domain={[0, 100]} />
              <Tooltip
                labelFormatter={(label) => {
                  const full = String(label);
                  const short = getCouncilLabel(full);
                  return short === full ? full : `${short} (${full})`;
                }}
              />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="avgStatusVisibility" name="Avg status visibility" fill="#0ea5e9" />
              <Bar dataKey="avgProgressVisibility" name="Avg progress visibility" fill="#22c55e" />
              <Bar dataKey="avgDocumentVisibility" name="Avg document visibility" fill="#a855f7" />
              <Bar dataKey="avgBasicCompleteness" name="Avg field completeness" fill="#f59e0b" />
              <Bar dataKey="avgDataQualityReliability" name="Avg DQR" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Legacy average transparency by council (0–2)"
        subtitle="Reference only — includes document and navigation rubric means"
        insight="Not the primary Assignment 3 indicator."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCouncilForTransparency} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="council"
                tickFormatter={(value) => getCouncilLabel(String(value))}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={78}
              />
              <YAxis domain={[0, 2]} />
              <Tooltip
                labelFormatter={(label) => {
                  const full = String(label);
                  const short = getCouncilLabel(full);
                  return short === full ? full : `${short} (${full})`;
                }}
              />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="avgTransparency" name="Legacy avg transparency" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Legacy weighted transparency index by council"
        subtitle="Reference only — prior default weights incl. documents and navigation"
        insight="Not used as the main Assignment 3 comparative indicator."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCouncilForTransparency} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="council"
                tickFormatter={(value) => getCouncilLabel(String(value))}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={78}
              />
              <YAxis domain={[0, 2]} />
              <Tooltip />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="avgWeightedTransparency" name="Legacy weighted index" fill="#cbd5e1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Decision Distribution by Council"
        subtitle="Stacked counts of Approved, Refused/Declined, Pending/In Progress/Under, and Other"
        insight="This distribution helps clients understand how outcome mix differs between councils."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCouncil} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="council"
                tickFormatter={(value) => getCouncilLabel(String(value))}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={78}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => {
                  const full = String(label);
                  const short = getCouncilLabel(full);
                  return short === full ? full : `${short} (${full})`;
                }}
              />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="approved" name="Approved" stackId="a" fill="#0ea5e9" />
              <Bar dataKey="refusedDeclined" name="Refused/Declined" stackId="a" fill="#ef4444" />
              <Bar dataKey="pendingEtc" name="Pending/In Progress/Under" stackId="a" fill="#f59e0b" />
              <Bar dataKey="other" name="Other" stackId="a" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Data Quality / Missingness by Council"
        subtitle="Date anomalies and records requiring review"
        insight="Review required includes missing required fields, score range issues, or date anomalies."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCouncil} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="council"
                tickFormatter={(value) => getCouncilLabel(String(value))}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={78}
              />
              <YAxis />
              <Tooltip />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="dateAnomalyCount" name="Date anomalies" fill="#f59e0b" />
              <Bar dataKey="reviewRequiredCount" name="Review required" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Portal Source Comparison"
        subtitle="Document and progress visibility by portal source"
        insight="Compares Council-managed portals against NSW Planning Portal experience."
      >
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={portalComparison} margin={{ top: 20, right: 16, left: 4, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="portalSource" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ top: 0 }} />
              <Bar dataKey="documentsPct" name="Documents (%)" fill="#0ea5e9" />
              <Bar dataKey="progressPct" name="Progress (%)" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Legacy sensitivity snapshot (weighted rubric index)
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          For reference only: equal-weight, document-focused, and navigation-focused scenarios apply to the
          legacy weighted transparency index (which includes document and navigation rubric scores). The
          primary Assignment 3 indicator is EBT-D (0–100).
        </p>
        <div className="mt-3 overflow-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2">Council</th>
                <th className="p-2">Default weighted</th>
                <th className="p-2">Equal weight</th>
                <th className="p-2">Document-focused</th>
                <th className="p-2">Navigation-focused</th>
              </tr>
            </thead>
            <tbody>
              {byCouncilForTransparency.map((r) => (
                <tr key={r.council} className="border-t border-slate-100">
                  <td className="p-2">{getCouncilLabel(r.council)}</td>
                  <td className="p-2">{r.avgWeightedTransparency?.toFixed(2) ?? "—"}</td>
                  <td className="p-2">{r.sensitivityEqual?.toFixed(2) ?? "—"}</td>
                  <td className="p-2">{r.sensitivityDoc?.toFixed(2) ?? "—"}</td>
                  <td className="p-2">{r.sensitivityNav?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

