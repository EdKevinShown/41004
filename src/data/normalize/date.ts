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

/** English month tokens (lowercase), including common abbreviations (Sep/Sept). */
const ENGLISH_MONTH_TO_NUM: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

function monthNumFromEnglishToken(token: string): number | null {
  const key = token.trim().toLowerCase();
  if (!key) return null;
  const n = ENGLISH_MONTH_TO_NUM[key];
  return n === undefined ? null : n;
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

  // Year-first with slashes: YYYY/M/D or YYYY/MM/DD (e.g. some North Sydney CSV exports)
  const ymdSlash = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) {
    const y = Number(ymdSlash[1]);
    const m = Number(ymdSlash[2]);
    const d = Number(ymdSlash[3]);
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

  // English month: "D Mon YYYY" / "DD Month YYYY" (e.g. 08 May 2026, 8 January 2026)
  const dMonY = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dMonY) {
    const d = Number(dMonY[1]);
    const m = monthNumFromEnglishToken(dMonY[2]!);
    const y = Number(dMonY[3]);
    if (m === null) {
      return { value: null, error: { code: "invalid_format", input: raw } };
    }
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

