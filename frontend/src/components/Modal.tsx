import { useEffect } from "react";
import type { ReactNode } from "react";

export function Modal(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    if (props.open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/40"
        aria-label="Close modal"
        onClick={props.onClose}
      />
      <div className="relative w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">{props.title}</div>
            <div className="text-xs text-slate-500">Press Esc to close</div>
          </div>
          <button
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">{props.children}</div>
      </div>
    </div>
  );
}

