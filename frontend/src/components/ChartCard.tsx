import type { ReactNode } from "react";

export function ChartCard(props: {
  title: string;
  children: ReactNode;
  subtitle?: string;
  insight?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{props.title}</div>
          {props.subtitle ? <div className="text-sm text-slate-600">{props.subtitle}</div> : null}
        </div>
      </div>
      <div className="mt-3">{props.children}</div>
      {props.insight ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{props.insight}</div>
      ) : null}
    </div>
  );
}

