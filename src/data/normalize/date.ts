import { type IsoDateString } from "../schemas/standard-schema.js";

export type DateParseErrorCode =
  | "invalid_format"
  | "invalid_calendar_date"
  | "out_of_range";

export interface DateParseResult {
  value: IsoDateString | null;
  error?: {
    code: DateParseErrorCode;
    input: string;
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isValidYMD(y: number, m: number, d: number): boolean {
  if (y < 1000 || y > 9999) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function parseToIsoDate(
  input: unknown,
  opts?: { minYear?: number; maxYear?: number }
): DateParseResult {
  if (input === null || input === undefined) return { value: null };
  const raw = String(input).trim();
  if (!raw) return { value: null };

  // ISO: YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (!isValidYMD(y, m, d)) {
      return { value: null, error: { code: "invalid_calendar_date", input: raw } };
    }
    if (
      (opts?.minYear !== undefined && y < opts.minYear) ||
      (opts?.maxYear !== undefined && y > opts.maxYear)
    ) {
      return { value: null, error: { code: "out_of_range", input: raw } };
    }
    return { value: raw as IsoDateString };
  }

  // AU-ish: D/M/YYYY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (!isValidYMD(y, m, d)) {
      return { value: null, error: { code: "invalid_calendar_date", input: raw } };
    }
    if (
      (opts?.minYear !== undefined && y < opts.minYear) ||
      (opts?.maxYear !== undefined && y > opts.maxYear)
    ) {
      return { value: null, error: { code: "out_of_range", input: raw } };
    }
    const isoValue = `${y}-${pad2(m)}-${pad2(d)}` as IsoDateString;
    return { value: isoValue };
  }

  return { value: null, error: { code: "invalid_format", input: raw } };
}

export function compareIsoDates(a: IsoDateString, b: IsoDateString): number {
  // Lexicographic compare is valid for YYYY-MM-DD
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

