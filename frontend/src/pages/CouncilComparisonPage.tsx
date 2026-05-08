import { useMemo, useState } from "react";
import { ChartCard } from "../components/ChartCard";
import { StatCard } from "../components/StatCard";
import { useRecords } from "../data/useRecords";
import { getCouncilLabel } from "../lib/councilLabels";
import {
  avg,
  calculateDataQualityFlags,
  calculateEvidenceBasedTransparencyBreakdown,
  calculateWeightedTransparencyIndex,
  derivePortalSource,
  meanTransparencyScore,
  pct,
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

type CouncilRow = {
  council: string;
  portalSource: string;
  cases: number;
  hasDocumentsPct: number;
  hasProgressPct: number;
  avgStatusClarity: number | null;
  avgDocCompleteness: number | null;
  avgUpdateVisibility: number | null;
  avgNavigationEase: number | null;
  avgTransparency: number | null;
  avgWeightedTransparencyIndex: number | null;
  avgEvidenceBasedTransparencyScore: number | null;
  avgStatusVisibilityScore: number | null;
  avgProgressVisibilityScore: number | null;
  avgBasicInformationCompletenessScore: number | null;
  avgDataQualityReliabilityScore: number | null;
  dateAnomalyCount: number;
  reviewRequiredCount: number;
};

export function CouncilComparisonPage() {
  const { state } = useRecords();
  const [sortBy, setSortBy] = useState<"cases" | "ebt" | "legacyTransparency">("cases");

  const councilRows = useMemo((): CouncilRow[] => {
    if (state.status !== "ready") return [];
    const records = state.records;
    const duplicateKeys = getDuplicateCompositeKeys(records);
    const councils = uniqueCouncils(records);

    return councils.map((council) => {
      const rs = records.filter((r) => (r.council ?? "").trim() === council);
      const cases = rs.length;
      const docs = rs.filter((r) => safeBool(r.has_documents)).length;
      const prog = rs.filter((r) => safeBool(r.has_progress_info)).length;

      const avgStatusClarity = avg(rs.map((r) => r.status_clarity_score));
      const avgDocCompleteness = avg(rs.map((r) => r.document_completeness_score));
      const avgUpdateVisibility = avg(rs.map((r) => r.update_visibility_score));
      const avgNavigationEase = avg(rs.map((r) => r.navigation_ease_score));
      const avgTransparency = avg(rs.map((r) => meanTransparencyScore(r)));
      const avgWeightedTransparencyIndex = avg(rs.map((r) => calculateWeightedTransparencyIndex(r)));
      const ebtBreakdowns = rs.map((r) => calculateEvidenceBasedTransparencyBreakdown(r, duplicateKeys));
      const avgEvidenceBasedTransparencyScore = avg(
        ebtBreakdowns.map((b) => b.evidence_based_transparency_score)
      );
      const avgStatusVisibilityScore = avg(ebtBreakdowns.map((b) => b.status_visibility_score));
      const avgProgressVisibilityScore = avg(ebtBreakdowns.map((b) => b.progress_visibility_score));
      const avgBasicInformationCompletenessScore = avg(
        ebtBreakdowns.map((b) => b.basic_information_completeness_score)
      );
      const avgDataQualityReliabilityScore = avg(
        ebtBreakdowns.map((b) => b.data_quality_reliability_score)
      );
      const dateAnomalyCount = rs.filter((r) => calculateDataQualityFlags(r).dateAnomaly).length;
      const reviewRequiredCount = rs.filter(
        (r) => calculateDataQualityFlags(r).dataQualityFlag === "Review required"
      ).length;

      return {
        council,
        portalSource: derivePortalSource(council),
        cases,
        hasDocumentsPct: cases ? docs / cases : 0,
        hasProgressPct: cases ? prog / cases : 0,
        avgStatusClarity,
        avgDocCompleteness,
        avgUpdateVisibility,
        avgNavigationEase,
        avgTransparency,
        avgWeightedTransparencyIndex,
        avgEvidenceBasedTransparencyScore,
        avgStatusVisibilityScore,
        avgProgressVisibilityScore,
        avgBasicInformationCompletenessScore,
        avgDataQualityReliabilityScore,
        dateAnomalyCount,
        reviewRequiredCount
      };
    });
  }, [state]);

  if (state.status === "loading") return <div className="p-6">Loading data…</div>;
  if (state.status === "error") return <div className="p-6 text-red-700">{state.error}</div>;

  const sortedRows = [...councilRows].sort((a, b) => {
    if (sortBy === "cases") return b.cases - a.cases;
    if (sortBy === "ebt") {
      return (
        (b.avgEvidenceBasedTransparencyScore ?? -1) - (a.avgEvidenceBasedTransparencyScore ?? -1)
      );
    }
    return (b.avgTransparency ?? -1) - (a.avgTransparency ?? -1);
  });

  const totalCouncils = sortedRows.length;
  const totalCases = councilRows.reduce((a, b) => a + b.cases, 0);

  const docsWeighted =
    totalCases === 0
      ? 0
      : councilRows.reduce((a, b) => a + b.hasDocumentsPct * b.cases, 0) / totalCases;
  const progWeighted =
    totalCases === 0
      ? 0
      : councilRows.reduce((a, b) => a + b.hasProgressPct * b.cases, 0) / totalCases;

  const chartData = sortedRows.map((r) => ({
    council: r.council,
    documents: Math.round(r.hasDocumentsPct * 100),
    progress: Math.round(r.hasProgressPct * 100),
    ebt:
      r.avgEvidenceBasedTransparencyScore === null
        ? null
        : Number(r.avgEvidenceBasedTransparencyScore.toFixed(2)),
    transparency: r.avgTransparency === null ? null : Number(r.avgTransparency.toFixed(2))
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        Different councils display meaningful variation in transparency and information visibility,
        which can affect how easily residents track application progress and outcomes.
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Councils" value={totalCouncils} />
        <StatCard label="Total cases" value={totalCases} />
        <StatCard
          label="Overall docs/progress"
          value={`${Math.round(docsWeighted * 100)}% / ${Math.round(progWeighted * 100)}%`}
          sub="Weighted by case count"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Council Snapshot Cards</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Sort by:</span>
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "cases" | "ebt" | "legacyTransparency")
              }
            >
              <option value="cases">Case count</option>
              <option value="ebt">Avg evidence-based transparency score</option>
              <option value="legacyTransparency">Legacy avg transparency (0–2)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedRows.map((r) => (
            <div key={r.council} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-900">{getCouncilLabel(r.council)}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <div className="uppercase tracking-wide text-slate-500">Cases</div>
                  <div className="text-sm font-semibold text-slate-900">{r.cases}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wide text-slate-500">Avg EBT score</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {r.avgEvidenceBasedTransparencyScore?.toFixed(1) ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wide text-slate-500">Documents</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {Math.round(r.hasDocumentsPct * 100)}%
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wide text-slate-500">Progress</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {Math.round(r.hasProgressPct * 100)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ChartCard
        title="Documents availability by council"
        subtitle="Percent of cases with has_documents = true"
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
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
              <Bar dataKey="documents" name="Documents (%)" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Progress visibility by council"
        subtitle="Percent of cases with has_progress_info = true"
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
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
              <Bar dataKey="progress" name="Progress (%)" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Evidence-Based Transparency Score by council"
        subtitle="Primary model (0–100): status + progress + field completeness + data-quality reliability"
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
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
              <Bar dataKey="ebt" name="Avg EBT score" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Legacy average transparency (0–2)"
        subtitle="Reference only — includes document/navigation rubric means; not the Assignment 3 primary model"
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 16, left: 4, bottom: 80 }}>
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
              <Bar dataKey="transparency" name="Legacy avg transparency" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100">
            <tr className="border-b border-slate-200">
              <th className="p-3 font-semibold">Council</th>
              <th className="p-3 font-semibold">Portal source</th>
              <th className="p-3 font-semibold">Cases</th>
              <th className="p-3 font-semibold">Docs</th>
              <th className="p-3 font-semibold">Progress</th>
              <th className="p-3 font-semibold">Avg status clarity</th>
              <th className="p-3 font-semibold">Avg doc completeness</th>
              <th className="p-3 font-semibold">Avg update visibility</th>
              <th className="p-3 font-semibold">Avg navigation ease</th>
              <th className="p-3 font-semibold">Avg EBT (0–100)</th>
              <th className="p-3 font-semibold">Avg status vis.</th>
              <th className="p-3 font-semibold">Avg progress vis.</th>
              <th className="p-3 font-semibold">Avg field completeness</th>
              <th className="p-3 font-semibold">Avg DQR</th>
              <th className="p-3 font-semibold">Legacy weighted index</th>
              <th className="p-3 font-semibold">Date anomalies</th>
              <th className="p-3 font-semibold">Review required</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, idx) => (
              <tr
                key={r.council}
                className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-sky-50`}
              >
                <td className="p-3">{getCouncilLabel(r.council)}</td>
                <td className="p-3">{r.portalSource}</td>
                <td className="p-3">{r.cases}</td>
                <td className="p-3">{pct(Math.round(r.hasDocumentsPct * r.cases), r.cases)}</td>
                <td className="p-3">{pct(Math.round(r.hasProgressPct * r.cases), r.cases)}</td>
                <td className="p-3">{r.avgStatusClarity?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgDocCompleteness?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgUpdateVisibility?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgNavigationEase?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgEvidenceBasedTransparencyScore?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgStatusVisibilityScore?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgProgressVisibilityScore?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgBasicInformationCompletenessScore?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgDataQualityReliabilityScore?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.avgWeightedTransparencyIndex?.toFixed(2) ?? "—"}</td>
                <td className="p-3">{r.dateAnomalyCount}</td>
                <td className="p-3">{r.reviewRequiredCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

