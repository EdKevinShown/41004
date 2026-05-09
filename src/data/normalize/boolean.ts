export type BooleanParseErrorCode = "invalid_boolean";

export interface BooleanParseResult {
  value: boolean | null;
  error?: {
    code: BooleanParseErrorCode;
    /** Trimmed raw cell text (not lowercased), for audit trails */
    input: string;
  };
}

const TRUE_TOKENS = new Set(["yes", "y", "true", "1"]);
const FALSE_TOKENS = new Set(["no", "n", "false", "0"]);

/**
 * Normalises optional yes/no style fields from CSV.
 * - null / undefined → null
 * - trim后空字符串 → null（无 error）
 * - 无法识别 → null + error（供 mapper 记 boolean_parse_failed）
 * - 不把 null 当作 false；false 仅来自明确的 false 类词
 */
export function parseYesNo(input: unknown): BooleanParseResult {
  if (input === null || input === undefined) return { value: null };

  const trimmed = String(input).trim();
  if (!trimmed) return { value: null };

  const lower = trimmed.toLowerCase();

  if (TRUE_TOKENS.has(lower)) return { value: true };
  if (FALSE_TOKENS.has(lower)) return { value: false };

  return { value: null, error: { code: "invalid_boolean", input: trimmed } };
}
