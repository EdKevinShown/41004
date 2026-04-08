export type BooleanParseErrorCode = "invalid_boolean";

export interface BooleanParseResult {
  value: boolean | null;
  error?: {
    code: BooleanParseErrorCode;
    input: string;
  };
}

export function parseYesNo(input: unknown): BooleanParseResult {
  if (input === null || input === undefined) return { value: null };
  const raw = String(input).trim();
  if (!raw) return { value: null };

  if (raw === "Yes") return { value: true };
  if (raw === "No") return { value: false };

  return { value: null, error: { code: "invalid_boolean", input: raw } };
}

