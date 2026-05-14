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
  avgDocumentVisibilityScore: number | null;
  avgBasicInformationCompletenessScore: number | null;
  avgDataQualityReliabilityScore: number | null;
  dateAnomalyCount: number;
  reviewRequiredCount: number;
};

export function CouncilComparisonPage() {
  const { state } = useRecords();
  const [sortBy, setSortBy] = useState<"cases" | "ebt" | "legacyTransparency">("ebt");

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
      const avgDocumentVisibilityScore = avg(ebtBreakdowns.map((b) => b.document_visibility_score));
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
        avgDocumentVisibilityScore,
        avgBasicInformationCompletenessScore,
        avgDataQualityReliabilityScore,
        dateAnomalyCount,
        reviewRequiredCount
      };
    });
  }, [state]);

  const ebtSummaryRows = useMemo(() => {
    return [...councilRows].sort(
      (a, b) =>
        (b.avgEvidenceBasedTransparencyScore ?? -1) - (a.avgEvidenceBasedTransparencyScore ?? -1)
    );
  }, [councilRows]);

  const ebtExtrema = useMemo(() => {
    const vals = councilRows
      .map((r) => r.avgEvidenceBasedTransparencyScore)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!vals.length) return { max: null as number | null, min: null as number | null };
    return { max: Math.max(...vals), min: Math.min(...vals) };
  }, [councilRows]);

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

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Council-Level EBT-D Summary</h3>
        <p className="mt-1 text-sm text-slate-600">
          Component averages on 0–100 scale; sorted by EBT-D (highest first).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 md:min-w-[13rem]">
                  Council
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  EBT-D
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Status
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Progress
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Docs
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Fields
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  DQR
                </th>
              </tr>
            </thead>
            <tbody>
              {ebtSummaryRows.map((r, idx) => {
                const e = r.avgEvidenceBasedTransparencyScore;
                const isHigh =
                  ebtExtrema.max !== null && e !== null && Math.abs(e - ebtExtrema.max) < 1e-6;
                const isLow =
                  ebtExtrema.min !== null && e !== null && Math.abs(e - ebtExtrema.min) < 1e-6;
                const fmt = (v: number | null | undefined) =>
                  v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(2);
                return (
                  <tr
                    key={`ebt-sum-${r.council}`}
                    className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                  >
                    <td className="px-3 py-2.5 text-left font-medium text-slate-900">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{getCouncilLabel(r.council)}</span>
                        {isHigh ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                            Highest
                          </span>
                        ) : null}
                        {isLow && !isHigh ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                            Lowest
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-800">{fmt(e)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">
                      {fmt(r.avgStatusVisibilityScore)}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">
                      {fmt(r.avgProgressVisibilityScore)}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">
                      {fmt(r.avgDocumentVisibilityScore)}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">
                      {fmt(r.avgBasicInformationCompletenessScore)}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">
                      {fmt(r.avgDataQualityReliabilityScore)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          This table is generated from the same EBT-D component logic as the Assignment 3 output
          tables. EBT-D is designed for council-level comparison and component-level diagnosis, not
          precise ranking of individual DA cases.
        </p>
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
              <option value="ebt">Avg EBT-D score</option>
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
                  <div className="uppercase tracking-wide text-slate-500">Avg EBT-D</div>
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
        title="EBT-D score by council"
        subtitle="Primary model (0–100): status, progress, document visibility, field completeness, DQR"
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
              <Bar dataKey="ebt" name="Avg EBT-D score" fill="#7c3aed" />
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
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">
            Council-level standardised records comparison
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            Compares standardised DA records across selected NSW councils based on document availability,
            progress visibility, and transparency-related indicators. All rows are derived from each
            council&apos;s own DA tracking portal data after normalisation — not a comparison between
            separate &quot;portal vendor&quot; categories.
          </p>
        </div>
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100">
            <tr className="border-b border-slate-200">
              <th className="p-3 font-semibold">Council</th>
              <th className="p-3 font-semibold">Number of records</th>
              <th className="p-3 font-semibold">Document availability (%)</th>
              <th className="p-3 font-semibold">Progress visibility (%)</th>
              <th className="p-3 font-semibold">Avg assessment / status clarity (0–2)</th>
              <th className="p-3 font-semibold">Avg documentation completeness (0–2)</th>
              <th className="p-3 font-semibold">Avg update visibility (0–2)</th>
              <th className="p-3 font-semibold">Avg navigation ease (0–2)</th>
              <th className="p-3 font-semibold">Avg EBT-D / evidence score (0–100)</th>
              <th className="p-3 font-semibold">Avg status visibility (pillar)</th>
              <th className="p-3 font-semibold">Avg progress visibility (pillar)</th>
              <th className="p-3 font-semibold">Avg document visibility (pillar)</th>
              <th className="p-3 font-semibold">Avg field completeness (pillar)</th>
              <th className="p-3 font-semibold">Avg DQR (pillar)</th>
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
                <td className="p-3">{r.avgDocumentVisibilityScore?.toFixed(2) ?? "—"}</td>
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

