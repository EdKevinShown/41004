import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "../components/ChartCard";
import { StatCard } from "../components/StatCard";
import { useRecords } from "../data/useRecords";
import { getCouncilLabel } from "../lib/councilLabels";
import {
  aggregateDashboardDataQuality,
  avg,
  bucketDecision,
  calculateDataQualityFlags,
  calculateEvidenceBasedTransparencyBreakdown,
  calculateSensitivityScores,
  calculateWeightedTransparencyIndex,
  getDuplicateCompositeKeys,
  meanTransparencyScore,
  safeBool,
  uniqueCouncils
} from "../lib/metrics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function heatCellStyle(score: number | null): { backgroundColor: string; color: string } {
  if (score === null || !Number.isFinite(score)) {
    return { backgroundColor: "#f8fafc", color: "#64748b" };
  }
  const t = Math.max(0, Math.min(1, score / 100));
  const r = Math.round(248 + (14 - 248) * t);
  const g = Math.round(250 + (165 - 250) * t);
  const b = Math.round(252 + (233 - 252) * t);
  return { backgroundColor: `rgb(${r},${g},${b})`, color: t > 0.52 ? "#f8fafc" : "#0f172a" };
}

export function ChartsPage() {
  const { state } = useRecords();
  const [radarCouncil, setRadarCouncil] = useState("");

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

  const councilList = useMemo(() => {
    if (state.status !== "ready") return [];
    return uniqueCouncils(state.records);
  }, [state]);

  useEffect(() => {
    if (councilList.length && !radarCouncil) setRadarCouncil(councilList[0]!);
  }, [councilList, radarCouncil]);

  const byCouncilSortedEbt = useMemo(() => {
    return [...byCouncil].sort((a, b) => (b.avgEBT ?? -1) - (a.avgEBT ?? -1));
  }, [byCouncil]);

  const horizontalBarData = useMemo(() => {
    return byCouncilSortedEbt.map((r) => ({
      council: r.council,
      councilShort: getCouncilLabel(r.council),
      avgEBT: r.avgEBT === null ? 0 : Number(r.avgEBT.toFixed(2))
    }));
  }, [byCouncilSortedEbt]);

  const heatmapRows = useMemo(() => {
    return byCouncilSortedEbt.map((r) => ({
      council: r.council,
      councilShort: getCouncilLabel(r.council),
      status: r.avgStatusVisibility,
      progress: r.avgProgressVisibility,
      docs: r.avgDocumentVisibility,
      fields: r.avgBasicCompleteness,
      dqr: r.avgDataQualityReliability
    }));
  }, [byCouncilSortedEbt]);

  const scatterPoints = useMemo(() => {
    return byCouncil.map((r) => ({
      council: r.council,
      councilShort: getCouncilLabel(r.council),
      x: r.avgDocumentVisibility ?? 0,
      y: r.avgProgressVisibility ?? 0,
      ebt: r.avgEBT,
      status: r.avgStatusVisibility,
      progress: r.avgProgressVisibility,
      document: r.avgDocumentVisibility,
      fields: r.avgBasicCompleteness,
      dqr: r.avgDataQualityReliability
    }));
  }, [byCouncil]);

  const histogramData = useMemo(() => {
    if (state.status !== "ready") return [];
    const dk = getDuplicateCompositeKeys(state.records);
    const bucketSize = 5;
    const bins = new Map<number, number>();
    for (const r of state.records) {
      const s = calculateEvidenceBasedTransparencyBreakdown(r, dk).evidence_based_transparency_score;
      const idx = Math.min(19, Math.max(0, Math.floor(Math.min(s, 99.999) / bucketSize)));
      const lo = idx * bucketSize;
      bins.set(lo, (bins.get(lo) ?? 0) + 1);
    }
    const rows: { label: string; lo: number; count: number }[] = [];
    for (let lo = 0; lo < 100; lo += bucketSize) {
      rows.push({
        label: `${lo}–${lo + bucketSize}`,
        lo,
        count: bins.get(lo) ?? 0
      });
    }
    return rows;
  }, [state]);

  const radarRow = byCouncil.find((r) => r.council === radarCouncil);
  const radarData =
    radarRow &&
    radarRow.avgStatusVisibility !== null &&
    radarRow.avgProgressVisibility !== null &&
    radarRow.avgDocumentVisibility !== null &&
    radarRow.avgBasicCompleteness !== null &&
    radarRow.avgDataQualityReliability !== null
      ? [
          { axis: "Status", value: Number(radarRow.avgStatusVisibility.toFixed(2)) },
          { axis: "Progress", value: Number(radarRow.avgProgressVisibility.toFixed(2)) },
          { axis: "Docs", value: Number(radarRow.avgDocumentVisibility.toFixed(2)) },
          { axis: "Fields", value: Number(radarRow.avgBasicCompleteness.toFixed(2)) },
          { axis: "DQR", value: Number(radarRow.avgDataQualityReliability.toFixed(2)) }
        ]
      : [];

  const dqAgg =
    state.status === "ready" ? aggregateDashboardDataQuality(state.records) : null;

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

  if (state.status === "loading") return <div className="p-6">Loading data…</div>;
  if (state.status === "error") return <div className="p-6 text-red-700">{state.error}</div>;

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
            Scores are comparative transparency indicators based on visible portal evidence. They do
            not assess the quality of council planning decisions.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-900">Primary visual analysis</h2>

        <ChartCard
          title="EBT-D rank profile (horizontal bars)"
          subtitle="Council-level average EBT-D (0–100), sorted high to low"
          insight="This chart shows the council-level EBT-D ranking."
        >
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={horizontalBarData}
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="councilShort"
                  width={118}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <Tooltip
                  formatter={(value) => {
                    const v = typeof value === "number" ? value : Number(value);
                    if (!Number.isFinite(v)) return ["—", "Avg EBT-D"];
                    return [v.toFixed(2), "Avg EBT-D"];
                  }}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { council?: string; councilShort?: string } | undefined;
                    return p?.council ?? "";
                  }}
                />
                <Bar dataKey="avgEBT" name="Avg EBT-D" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Component heatmap"
          subtitle="Mean pillar scores (0–100) by council"
          insight="This heatmap shows which transparency component is strong or weak for each council."
        >
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="whitespace-nowrap px-2 py-2 text-left font-semibold text-slate-700 md:min-w-[10rem]">
                    Council
                  </th>
                  {["Status", "Progress", "Docs", "Fields", "DQR"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-2 py-2 text-center font-semibold text-slate-700"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapRows.map((row, idx) => (
                  <tr key={row.council} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="border-b border-slate-100 px-2 py-1.5 font-medium text-slate-800">
                      {row.councilShort}
                    </td>
                    {(["status", "progress", "docs", "fields", "dqr"] as const).map((k) => {
                      const v = row[k];
                      const st = heatCellStyle(v);
                      const txt =
                        v === null || !Number.isFinite(v)
                          ? "—"
                          : v >= 100
                            ? v.toFixed(0)
                            : v.toFixed(1);
                      return (
                        <td
                          key={k}
                          className="border-b border-slate-100 px-1 py-1 text-center font-medium tabular-nums"
                          style={st}
                        >
                          {txt}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard
          title="Council component radar"
          subtitle="Five EBT-D pillars for one council (averages on 0–100)"
          insight="This radar chart shows the transparency profile of a selected council."
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-600" htmlFor="radar-council">
              Council
            </label>
            <select
              id="radar-council"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={radarCouncil}
              onChange={(e) => setRadarCouncil(e.target.value)}
            >
              {councilList.map((c) => (
                <option key={c} value={c}>
                  {getCouncilLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="h-[360px]">
            {radarData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#475569" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name={getCouncilLabel(radarCouncil)}
                    dataKey="value"
                    stroke="#0ea5e9"
                    fill="#38bdf8"
                    fillOpacity={0.35}
                  />
                  <Tooltip
                    formatter={(value) => {
                      const v = typeof value === "number" ? value : Number(value);
                      return Number.isFinite(v) ? v.toFixed(2) : "—";
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No radar data for this selection.
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard
          title="Document vs progress scatter"
          subtitle="Council averages: document visibility (x) vs progress visibility (y)"
          insight="This scatter chart separates document visibility from progress visibility."
        >
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 16, bottom: 48, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Document visibility"
                  domain={[0, 100]}
                  label={{ value: "Avg document visibility", position: "bottom", offset: 28, fill: "#64748b" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Progress visibility"
                  domain={[0, 100]}
                  label={{
                    value: "Avg progress visibility",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#64748b"
                  }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as {
                      councilShort: string;
                      council: string;
                      ebt: number | null;
                      status: number | null;
                      progress: number | null;
                      document: number | null;
                      fields: number | null;
                      dqr: number | null;
                    };
                    const fmt = (v: number | null | undefined) =>
                      v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(2);
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                        <div className="font-semibold text-slate-900">{p.councilShort}</div>
                        <div className="mt-1 text-slate-600">{p.council}</div>
                        <div className="mt-2 space-y-0.5 tabular-nums text-slate-700">
                          <div>EBT-D: {fmt(p.ebt)}</div>
                          <div>Status: {fmt(p.status)}</div>
                          <div>Progress: {fmt(p.progress)}</div>
                          <div>Document: {fmt(p.document)}</div>
                          <div>Fields: {fmt(p.fields)}</div>
                          <div>DQR: {fmt(p.dqr)}</div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter name="Councils" data={scatterPoints} fill="#7c3aed" fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="EBT-D score distribution (case-level)"
          subtitle="Histogram of evidence_based_transparency_score across all cases"
          insight="Because EBT-D uses coded 0–2 and yes/no fields, repeated case-level scores are expected. The model is mainly for council-level comparison and component-level diagnosis."
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 12, right: 12, left: 4, bottom: 36 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} label={{ value: "Cases", angle: -90, position: "insideLeft" }} />
                <Tooltip
                  formatter={(value) => {
                    const v = typeof value === "number" ? value : Number(value);
                    if (!Number.isFinite(v)) return [0, "Cases"];
                    return [v, "Cases"];
                  }}
                  labelFormatter={(l) => `EBT-D ${l}`}
                />
                <Bar dataKey="count" name="Cases" fill="#0d9488" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Data quality summary</h3>
          <p className="mt-1 text-sm text-slate-600">
            This section explains the reliability and limitations of the dataset.
          </p>
          {dqAgg ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Missing required field instances"
                value={dqAgg.missingRequiredFieldsTotal}
                sub="Sum of per-record missing required slots"
              />
              <StatCard
                label="Records with missing required fields"
                value={dqAgg.recordsWithMissingRequiredFields}
              />
              <StatCard label="Date anomalies" value={dqAgg.dateAnomalyCount} />
              <StatCard label="Records requiring review" value={dqAgg.recordsRequiringReview} />
              <StatCard label="Boolean parse issue count" value={dqAgg.booleanParseIssueCount} />
              <StatCard label="Duplicate key groups" value={dqAgg.duplicateKeyCount} />
            </div>
          ) : null}
        </div>
      </section>

      <h2 className="text-lg font-semibold text-slate-900">Supplementary bar charts</h2>

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
          title="EBT-D score by council (vertical bars)"
          subtitle="Primary model (0–100): status 25%, progress 25%, document 25%, completeness 15%, reliability 10%"
          insight="Document pillar uses has_documents (100/0) and document_completeness_score normalised to 0–100, each at half weight inside the document pillar."
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
