import type { ReactNode } from "react";

export function StatCard(props: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{props.value}</div>
      {props.sub ? <div className="mt-1 text-sm text-slate-600">{props.sub}</div> : null}
      {props.hint ? <div className="mt-2 text-xs text-slate-500">{props.hint}</div> : null}
    </div>
  );
}

