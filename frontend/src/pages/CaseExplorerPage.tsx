import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { useRecords } from "../data/useRecords";
import {
  calculateDataQualityFlags,
  calculateEvidenceBasedTransparencyBreakdown,
  calculateWeightedTransparencyIndex,
  derivePortalSource,
  getDuplicateCompositeKeys,
  safeBool,
  uniqueCouncils
} from "../lib/metrics";
import { type StandardCouncilRecord } from "../types";

type Filters = {
  q: string;
  council: string;
  decision: string;
  development_type: string;
  portal_source: "" | "Council-managed portal" | "NSW Planning Portal";
  data_quality_flag: "" | "OK" | "Review required";
  has_documents: "" | "true" | "false";
  has_progress_info: "" | "true" | "false";
};

function uniq(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function CaseExplorerPage() {
  const { state } = useRecords();
  const [filters, setFilters] = useState<Filters>({
    q: "",
    council: "",
    decision: "",
    development_type: "",
    portal_source: "",
    data_quality_flag: "",
    has_documents: "",
    has_progress_info: ""
  });
  const [selected, setSelected] = useState<StandardCouncilRecord | null>(null);

  const duplicateKeys = useMemo(() => {
    if (state.status !== "ready") return new Set<string>();
    return getDuplicateCompositeKeys(state.records);
  }, [state]);

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    const records = state.records;
    const councils = uniqueCouncils(records);
    const decisions = uniq(records.map((r) => r.decision));
    const devTypes = uniq(records.map((r) => r.development_type));
    return { councils, decisions, devTypes };
  }, [state]);

  const filtered = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = filters.q.trim().toLowerCase();
    return state.records.filter((r) => {
      if (filters.council && (r.council ?? "") !== filters.council) return false;
      if (filters.decision && (r.decision ?? "") !== filters.decision) return false;
      if (filters.development_type && (r.development_type ?? "") !== filters.development_type)
        return false;
      if (filters.portal_source && derivePortalSource(r.council) !== filters.portal_source) return false;
      if (filters.data_quality_flag) {
        const q = calculateDataQualityFlags(r).dataQualityFlag;
        if (q !== filters.data_quality_flag) return false;
      }

      if (filters.has_documents) {
        const want = filters.has_documents === "true";
        if (safeBool(r.has_documents) !== want) return false;
      }
      if (filters.has_progress_info) {
        const want = filters.has_progress_info === "true";
        if (safeBool(r.has_progress_info) !== want) return false;
      }

      if (!q) return true;
      const hay = [
        r.application_no,
        r.address,
        r.description
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [state, filters]);

  if (state.status === "loading") return <div className="p-6">Loading data…</div>;
  if (state.status === "error") return <div className="p-6 text-red-700">{state.error}</div>;

  const modalEbt = selected
    ? calculateEvidenceBasedTransparencyBreakdown(selected, duplicateKeys)
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Case Explorer</h2>
        <p className="mt-1 text-sm text-slate-600">
          Search and filter individual cases, then open a full record panel for detailed review.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-8">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600">Search</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="application_no / address / description"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Council</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={filters.council}
              onChange={(e) => setFilters((f) => ({ ...f, council: e.target.value }))}
            >
              <option value="">All</option>
              {derived?.councils.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Decision</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={filters.decision}
              onChange={(e) => setFilters((f) => ({ ...f, decision: e.target.value }))}
            >
              <option value="">All</option>
              {derived?.decisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Development type</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={filters.development_type}
              onChange={(e) => setFilters((f) => ({ ...f, development_type: e.target.value }))}
            >
              <option value="">All</option>
              {derived?.devTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">has_documents</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={filters.has_documents}
              onChange={(e) =>
                setFilters((f) => ({ ...f, has_documents: e.target.value as Filters["has_documents"] }))
              }
            >
              <option value="">All</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">portal_source</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={filters.portal_source}
              onChange={(e) =>
                setFilters((f) => ({ ...f, portal_source: e.target.value as Filters["portal_source"] }))
              }
            >
              <option value="">All</option>
              <option value="Council-managed portal">Council-managed portal</option>
              <option value="NSW Planning Portal">NSW Planning Portal</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">data_quality_flag</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={filters.data_quality_flag}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  data_quality_flag: e.target.value as Filters["data_quality_flag"]
                }))
              }
            >
              <option value="">All</option>
              <option value="OK">OK</option>
              <option value="Review required">Review required</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">has_progress_info</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              value={filters.has_progress_info}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  has_progress_info: e.target.value as Filters["has_progress_info"]
                }))
              }
            >
              <option value="">All</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Showing <span className="font-medium text-slate-700">{filtered.length}</span> of{" "}
          <span className="font-medium text-slate-700">{state.records.length}</span> cases
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1200px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100">
            <tr className="border-b border-slate-200">
              <th className="p-3 font-semibold">Council</th>
              <th className="p-3 font-semibold">Application</th>
              <th className="p-3 font-semibold">Address</th>
              <th className="p-3 font-semibold">Development type</th>
              <th className="p-3 font-semibold">Decision</th>
              <th className="p-3 font-semibold">Lodged</th>
              <th className="p-3 font-semibold">Decision date</th>
              <th className="p-3 font-semibold">Portal source</th>
              <th className="p-3 font-semibold">EBT-D (0–100)</th>
              <th className="p-3 font-semibold">Legacy weighted idx</th>
              <th className="p-3 font-semibold">Data quality</th>
              <th className="p-3 font-semibold">Docs</th>
              <th className="p-3 font-semibold">Progress</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr
                key={`${r.application_no ?? "row"}-${idx}`}
                className={`cursor-pointer border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-sky-50`}
                onClick={() => setSelected(r)}
              >
                <td className="p-3">{r.council ?? "—"}</td>
                <td className="p-3 font-medium text-slate-900">{r.application_no ?? "—"}</td>
                <td className="p-3">{r.address ?? "—"}</td>
                <td className="p-3">{r.development_type ?? "—"}</td>
                <td className="p-3">{r.decision ?? "—"}</td>
                <td className="p-3">{r.lodged_date ?? "—"}</td>
                <td className="p-3">{r.decision_date ?? "—"}</td>
                <td className="p-3">{derivePortalSource(r.council)}</td>
                <td className="p-3">
                  {calculateEvidenceBasedTransparencyBreakdown(r, duplicateKeys).evidence_based_transparency_score.toFixed(
                    1
                  )}
                </td>
                <td className="p-3">
                  {calculateWeightedTransparencyIndex(r)?.toFixed(2) ?? "—"}
                </td>
                <td className="p-3">{calculateDataQualityFlags(r).dataQualityFlag}</td>
                <td className="p-3">{String(safeBool(r.has_documents))}</td>
                <td className="p-3">{String(safeBool(r.has_progress_info))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected?.application_no ?? "Case Details"}
        onClose={() => setSelected(null)}
      >
        {selected && modalEbt ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">Council</div>
              <div className="mt-1 text-sm">{selected.council ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">Application No</div>
              <div className="mt-1 text-sm">{selected.application_no ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">Decision</div>
              <div className="mt-1 text-sm">{selected.decision ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">Development type</div>
              <div className="mt-1 text-sm">{selected.development_type ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3 md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">Address</div>
              <div className="mt-1 text-sm">{selected.address ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3 md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">Description</div>
              <div className="mt-1 text-sm">{selected.description ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">Lodged date</div>
              <div className="mt-1 text-sm">{selected.lodged_date ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">Decision date</div>
              <div className="mt-1 text-sm">{selected.decision_date ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">has_documents</div>
              <div className="mt-1 text-sm">{String(safeBool(selected.has_documents))}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">has_progress_info</div>
              <div className="mt-1 text-sm">{String(safeBool(selected.has_progress_info))}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">portal_source</div>
              <div className="mt-1 text-sm">{derivePortalSource(selected.council)}</div>
            </div>
            <div className="rounded-md border border-violet-200 bg-violet-50 p-3 md:col-span-2">
              <div className="text-xs font-semibold text-slate-700">
                evidence_based_transparency_score (EBT-D, primary)
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {modalEbt.evidence_based_transparency_score.toFixed(2)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-5">
                <div>Status vis.: {modalEbt.status_visibility_score.toFixed(1)}</div>
                <div>Progress vis.: {modalEbt.progress_visibility_score.toFixed(1)}</div>
                <div>Document vis.: {modalEbt.document_visibility_score.toFixed(1)}</div>
                <div>Field completeness: {modalEbt.basic_information_completeness_score.toFixed(1)}</div>
                <div>DQR: {modalEbt.data_quality_reliability_score.toFixed(1)}</div>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">legacy weighted_transparency_index</div>
              <div className="mt-1 text-sm">
                {calculateWeightedTransparencyIndex(selected)?.toFixed(4) ?? "—"}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">data_quality_flag</div>
              <div className="mt-1 text-sm">{calculateDataQualityFlags(selected).dataQualityFlag}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">status_clarity_score</div>
              <div className="mt-1 text-sm">{selected.status_clarity_score ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">
                document_completeness_score
              </div>
              <div className="mt-1 text-sm">{selected.document_completeness_score ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-600">update_visibility_score</div>
              <div className="mt-1 text-sm">{selected.update_visibility_score ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3 md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">
                navigation_ease_score (legacy weighted index rubric only)
              </div>
              <div className="mt-1 text-sm">{selected.navigation_ease_score ?? "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3 md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{selected.notes ?? "—"}</div>
            </div>
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3 md:col-span-2">
              <div className="text-xs font-semibold text-slate-700">Transparency Scoring Reminder</div>
              <div className="mt-1 text-sm text-slate-700">
                The primary comparative metric is EBT-D (0–100): status, progress, document visibility
                (has_documents plus document completeness rubric), core field completeness, and
                data-quality reliability. Rubric scores use a 0–2 scale where applicable. These indicators
                describe public-facing DA information transparency, not council planning decision quality.
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

