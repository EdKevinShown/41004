import { useMemo } from "react";
import { ChartCard } from "../components/ChartCard";
import { useRecords } from "../data/useRecords";
import { getCouncilLabel } from "../lib/councilLabels";
import { avg, bucketDecision, meanTransparencyScore, safeBool, uniqueCouncils } from "../lib/metrics";
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

      return {
        council,
        cases,
        documentsPct: cases ? Math.round((docs / cases) * 100) : 0,
        progressPct: cases ? Math.round((prog / cases) * 100) : 0,
        avgTransparency: avg(rs.map((r) => meanTransparencyScore(r))) ?? null,
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
    avgTransparency: r.avgTransparency === null ? null : Number(r.avgTransparency.toFixed(2))
  }));

  return (
    <div className="space-y-6">
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
            rubric. These scores are for comparative analysis and should not be treated as official
            council ratings.
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
        title="Average Transparency Score by Council"
        subtitle="Mean of status clarity, document completeness, update visibility, and navigation ease (0-2 scale)"
        insight="This provides a compact benchmark of overall transparency quality at council level. Scores are shown on a 0-2 rubric-based scale."
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
              <Bar dataKey="avgTransparency" name="Avg transparency" fill="#a855f7" />
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
      </div>
    </div>
  );
}

