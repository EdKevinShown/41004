import { useEffect, useMemo, useState } from "react";
import { type StandardCouncilRecord } from "../types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; records: StandardCouncilRecord[] };

export function useRecords() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/normalized-records.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load normalized-records.json (${res.status})`);
        const data = (await res.json()) as unknown;
        if (!Array.isArray(data)) throw new Error("normalized-records.json is not an array");
        const records = data as StandardCouncilRecord[];
        if (!cancelled) setState({ status: "ready", records });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setState({ status: "error", error: msg });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    const councils = new Set(
      state.records.map((r) => r.council).filter((c): c is string => Boolean(c && c.trim()))
    );
    return { councilCount: councils.size };
  }, [state]);

  return { state, derived };
}

